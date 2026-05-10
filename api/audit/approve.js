// POST /api/audit/approve
// Admin-only. Called by admin queue when Bek clicks "Approve & Send".
// Body: { id, drafts: { what_i_noticed, why_this_tier, specific_question_answer } }
// 1. Verify admin token
// 2. Fetch audit row
// 3. Generate slug
// 4. Render HTML → PDF → upload to Vercel Blob
// 5. Mark delivered in db (status='delivered', slug, pdf_url, drafts_final)
// 6. Email athlete via Gmail SMTP (delivery email + page link + PDF link)
// 7. Tag athlete in Kit (audit-delivered + tier-specific) → triggers A16 nurture
// 8. Send Bek alert (✉️ delivered)

import { getAuditById, markDelivered, newSlug } from '../../lib/db.js';
import { tagAuditDelivered, tierTagIdFor, addNurtureTag } from '../../lib/kit.js';
import { alertDelivered, alertError, emailAuditToAthlete } from '../../lib/email-alerts.js';

function checkAdmin(req) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const provided = req.headers['x-admin-token'] ?? req.query?.t;
  return provided === token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!checkAdmin(req)) return res.status(401).json({ error: 'unauthorized' });

  const { id, drafts } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'id required' });
  if (!drafts || typeof drafts !== 'object') return res.status(400).json({ error: 'drafts required' });

  // Fetch row
  const row = await getAuditById(id);
  if (!row) return res.status(404).json({ error: 'audit not found' });
  if (row.status === 'delivered') {
    return res.status(409).json({ error: 'already delivered', slug: row.slug });
  }

  // Use admin's edited drafts as drafts_final
  const draftsFinal = {
    what_i_noticed: String(drafts.what_i_noticed ?? '').trim(),
    why_this_tier: String(drafts.why_this_tier ?? '').trim(),
    specific_question_answer: String(drafts.specific_question_answer ?? '').trim(),
    _approved_at: new Date().toISOString(),
  };

  if (!draftsFinal.what_i_noticed || !draftsFinal.why_this_tier || !draftsFinal.specific_question_answer) {
    return res.status(400).json({ error: 'all 3 personalization blocks required' });
  }

  const slug = newSlug();
  const pdfUrl = null; // PDFs generated client-side via window.print() on the page

  // Mark delivered
  try {
    await markDelivered(id, { slug, pdfUrl, draftsFinal });
  } catch (err) {
    console.error('[approve] db mark delivered failed:', err);
    await alertError({ where: 'api/audit/approve (db.markDelivered)', error: err, auditId: id }).catch(() => {});
    return res.status(500).json({ error: 'db failure' });
  }

  const tierKey = row.engine?.tier_recommendation?.tier ?? 'sprint';
  const tierLabel = row.engine?.tier_recommendation?.label ?? 'Sprint';

  // Side effects — MUST await on Vercel serverless or function exits before they complete.
  await Promise.allSettled([
    emailAuditToAthlete({
      to: row.email,
      firstName: row.first_name,
      slug,
      pdfUrl,
      tierLabel,
    }).catch(err => alertError({ where: 'api/audit/approve (athlete email)', error: err, auditId: id })),

    tagAuditDelivered(row.email, row.first_name, {
      tierTagId: tierTagIdFor(tierKey),
      fields: {
        audit_id: id,
        audit_slug: slug,
        audit_pdf_url: pdfUrl,
        audit_tier: tierKey,
      },
    }).catch(err => alertError({ where: 'api/audit/approve (kit.tagAuditDelivered)', error: err, auditId: id })),

    // Tag post-audit-nurture → triggers Kit sequence (PA1 → PA3 → PA4)
    // audit_summary_oneliner: first sentence of what_i_noticed, capped at 120 chars.
    // This populates the personalised pull-quote in PA1 ("the thing it surfaced — X — isn't unusual").
    addNurtureTag(row.email, row.first_name, 'post-audit-nurture', {
      audit_url: `https://www.rikathletica.com/a/${slug}`,
      audit_summary_oneliner: draftsFinal.what_i_noticed
        .replace(/\s+/g, ' ')
        .split(/[.!?]/)[0]
        .trim()
        .slice(0, 120),
    }).catch(err => alertError({ where: 'api/audit/approve (kit.addNurtureTag post-audit-nurture)', error: err, auditId: id })),

    alertDelivered({ audit: row, tierLabel, slug })
      .catch(err => alertError({ where: 'api/audit/approve (alertDelivered)', error: err, auditId: id })),
  ]);

  return res.status(200).json({ ok: true, slug, pdfUrl });
}
