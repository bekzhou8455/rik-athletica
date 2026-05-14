// POST /api/audit/submit
// Public endpoint, called by audit.html submit handler.
// 1. Validate body
// 2. Run deterministic engine
// 3. AI drafts 3 personalization blocks (with fallback)
// 4. Insert row with status='drafted'
// 5. Tag athlete in Kit (audit-submitted) → triggers E0 in Kit
//   PLUS send our own E0 from Gmail SMTP for guaranteed delivery
// 6. Send Bek alert email with draft preview + admin link

import { z } from 'zod';
import { runEngine } from '../../lib/routing.js';
import { draftBlocks, fallbackDrafts } from '../../lib/ai-drafter.js';
import { insertAudit } from '../../lib/db.js';
import { tagAuditSubmitted } from '../../lib/kit.js';
import { alertNewDraft, alertError, emailE0Confirmation } from '../../lib/email-alerts.js';

const AnswersSchema = z.object({
  raceDistance: z.string().nullable().optional(),
  raceDate: z.string().nullable().optional(),
  targetTime: z.string().nullable().optional(),
  weeklyHours: z.string().nullable().optional(),
  brands: z.array(z.string()).optional(),
  carbsPerHour: z.string().nullable().optional(),
  giHistory: z.string().nullable().optional(),
  giNotes: z.string().nullable().optional(),
  bodyWeight: z.union([z.string(), z.number()]).nullable().optional(),
  weightUnit: z.string().optional(),
  sweatRate: z.string().nullable().optional(),
  hasCoach: z.string().nullable().optional(),
  coachName: z.string().nullable().optional(),
  specificConcern: z.string().nullable().optional(),
  firstName: z.string().min(1, 'First name required'),
  email: z.string().email('Invalid email'),
  referredBy: z.string().max(120).nullable().optional(),
  consent: z.boolean(),
  clubRef: z.string().nullable().optional(),
  referredBySlug: z.string().regex(/^[A-Za-z0-9_-]{6,12}$/).nullable().optional(),
  utmSource: z.string().nullable().optional(),
  utmMedium: z.string().nullable().optional(),
  utmCampaign: z.string().nullable().optional(),
  submittedAt: z.string().optional(),
  userAgent: z.string().optional(),
});

export default async function handler(req, res) {
  // CORS for the form (same-origin in prod, but be permissive)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let answers;
  try {
    answers = AnswersSchema.parse(req.body);
  } catch (err) {
    return res.status(400).json({ error: 'invalid payload', details: err.issues });
  }

  if (!answers.consent) {
    return res.status(400).json({ error: 'consent required' });
  }

  // Run engine (sync, deterministic, never throws under valid input)
  let engine;
  try {
    engine = runEngine(answers);
  } catch (err) {
    console.error('[submit] engine error:', err);
    await alertError({ where: 'api/audit/submit (engine)', error: err }).catch(() => {});
    return res.status(500).json({ error: 'engine failure' });
  }

  // AI drafts (with fallback so the queue is never blocked)
  let drafts;
  try {
    drafts = await draftBlocks({ answers, engine });
  } catch (err) {
    console.error('[submit] AI drafter failed, using fallback:', err);
    drafts = fallbackDrafts({ answers, engine });
    drafts._meta = { ...(drafts._meta ?? {}), ai_error: String(err?.message ?? err) };
    // Alert Bek but don't block the user
    alertError({ where: 'api/audit/submit (ai-drafter)', error: err }).catch(() => {});
  }

  // Insert into Postgres
  let row;
  try {
    row = await insertAudit({
      email: answers.email,
      firstName: answers.firstName,
      answers,
      engine,
      drafts,
      utmSource: answers.utmSource ?? null,
      utmMedium: answers.utmMedium ?? null,
      utmCampaign: answers.utmCampaign ?? null,
      clubRef: answers.clubRef ?? null,
      referredBySlug: answers.referredBySlug ?? null,
    });
  } catch (err) {
    console.error('[submit] db insert failed:', err);
    await alertError({ where: 'api/audit/submit (db.insertAudit)', error: err }).catch(() => {});
    return res.status(500).json({ error: 'db failure' });
  }

  // Side effects — MUST await on Vercel serverless or function exits before they complete.
  // Adds ~1-2s to response time but guarantees emails actually send.
  await Promise.allSettled([
    tagAuditSubmitted(answers.email, answers.firstName, {
      audit_id: row.id,
      race_distance: answers.raceDistance ?? '',
      tier_recommended: engine.tier_recommendation?.tier ?? '',
    }).catch(err => alertError({ where: 'api/audit/submit (kit.tagAuditSubmitted)', error: err, auditId: row.id })),

    emailE0Confirmation({ to: answers.email, firstName: answers.firstName })
      .catch(err => alertError({ where: 'api/audit/submit (E0 email)', error: err, auditId: row.id })),

    alertNewDraft({ audit: row, engine, drafts, answers })
      .catch(err => alertError({ where: 'api/audit/submit (alertNewDraft)', error: err, auditId: row.id })),
  ]);

  return res.status(200).json({ ok: true, id: row.id });
}
