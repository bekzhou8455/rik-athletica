// RIK Audit — Email alerts via Gmail SMTP.
// All alerts go to BEK_NOTIFY_EMAIL. Push notifications come from Gmail/Apple Mail.

import nodemailer from 'nodemailer';

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set');
  }
  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return _transporter;
}

function adminUrl(path = '/admin/audit-queue.html') {
  const origin = process.env.SITE_ORIGIN ?? 'https://rikathletica.com';
  const token = process.env.ADMIN_TOKEN ?? '';
  const sep = path.includes('?') ? '&' : '?';
  return `${origin}${path}${sep}t=${encodeURIComponent(token)}`;
}

async function sendAlert({ subject, html, text }) {
  const to = process.env.BEK_NOTIFY_EMAIL;
  if (!to) {
    console.warn('[email-alerts] BEK_NOTIFY_EMAIL not set — skipping');
    return;
  }
  const from = process.env.GMAIL_USER;
  const t = getTransporter();
  await t.sendMail({
    from: `RIK Audit Alerts <${from}>`,
    to,
    subject,
    text: text ?? subject,
    html: html ?? `<p>${subject}</p>`,
  });
}

// === New audit submitted (AI draft ready) ===
export async function alertNewDraft({ audit, engine, drafts }) {
  const tier = engine.tier_recommendation?.label ?? 'unknown';
  const distance = engine.inputs_summary?.race_distance ?? '?';
  const weeksOut = engine.inputs_summary?.weeks_out ?? '?';
  const url = adminUrl(`/admin/audit-queue.html?id=${audit.id}`);
  const html = `
    <h2 style="font-family:system-ui;margin:0 0 8px">🟢 New audit drafted: ${escapeHtml(audit.first_name)}</h2>
    <p style="font-family:system-ui;color:#555;margin:0 0 16px">${escapeHtml(distance)} · ${escapeHtml(String(weeksOut))} weeks out · routed to <strong>${escapeHtml(tier)}</strong></p>
    <h3 style="font-family:system-ui;font-size:14px;margin:16px 0 4px">AI draft preview</h3>
    <p style="font-family:system-ui;font-size:13px;background:#f6f5f4;padding:12px;border-radius:8px;white-space:pre-wrap">${escapeHtml(drafts?.what_i_noticed ?? '(no draft)')}</p>
    <p style="margin:24px 0">
      <a href="${url}" style="background:#0a0a0a;color:#fff;padding:14px 24px;border-radius:8px;text-decoration:none;font-family:system-ui;display:inline-block">Open in admin →</a>
    </p>
    <p style="font-family:system-ui;color:#888;font-size:12px">Email: ${escapeHtml(audit.email)} · ID: ${audit.id}</p>
  `;
  await sendAlert({ subject: `🟢 New audit drafted: ${audit.first_name} (${distance}, ${weeksOut}w)`, html });
}

// === Queue reminder (≥3 audits pending, oldest > N hours) ===
export async function alertQueueReminder({ pendingRows }) {
  const url = adminUrl();
  const list = pendingRows.map(r => `
    <li style="font-family:system-ui;font-size:13px;margin:4px 0">
      ${escapeHtml(r.first_name)} (${escapeHtml(r.email)}) — ${Math.round(r.hours_old)}h old
    </li>`).join('');
  const html = `
    <h2 style="font-family:system-ui;margin:0 0 12px">🟡 Queue reminder: ${pendingRows.length} audits pending</h2>
    <ul style="padding-left:20px">${list}</ul>
    <p style="margin:24px 0">
      <a href="${url}" style="background:#0a0a0a;color:#fff;padding:14px 24px;border-radius:8px;text-decoration:none;font-family:system-ui;display:inline-block">Open queue →</a>
    </p>
  `;
  await sendAlert({ subject: `🟡 ${pendingRows.length} audits pending — oldest ${Math.round(pendingRows[0].hours_old)}h`, html });
}

// === Audit delivered (confirmation to Bek) ===
export async function alertDelivered({ audit, tierLabel, slug }) {
  const url = `${process.env.SITE_ORIGIN ?? 'https://rikathletica.com'}/a/${slug}`;
  const html = `
    <p style="font-family:system-ui">✉️ <strong>Sent to ${escapeHtml(audit.first_name)}</strong> (${escapeHtml(audit.email)})</p>
    <p style="font-family:system-ui;color:#555">Recommended: ${escapeHtml(tierLabel)}</p>
    <p style="font-family:system-ui"><a href="${url}">${url}</a></p>
  `;
  await sendAlert({ subject: `✉️ Sent: ${audit.first_name} → ${tierLabel}`, html });
}

// === Stripe webhook conversion ===
export async function alertConversion({ row, tier, amount, daysToConvert }) {
  const html = `
    <h2 style="font-family:system-ui;margin:0 0 8px">💰 Conversion: ${escapeHtml(row.first_name)}</h2>
    <p style="font-family:system-ui">Tier: <strong>${escapeHtml(tier)}</strong> ($${amount})</p>
    <p style="font-family:system-ui">Email: ${escapeHtml(row.email)}</p>
    <p style="font-family:system-ui;color:#555">Audit was delivered ${daysToConvert} day${daysToConvert === 1 ? '' : 's'} ago.</p>
  `;
  await sendAlert({ subject: `💰 ${row.first_name} → ${tier} ($${amount})`, html });
}

// === Direct purchase (no matching audit found) ===
export async function alertDirectPurchase({ email, tier, amount }) {
  const html = `
    <p style="font-family:system-ui">💰 <strong>Direct purchase</strong> (no audit on file)</p>
    <p style="font-family:system-ui">Tier: ${escapeHtml(tier)} ($${amount})</p>
    <p style="font-family:system-ui">Email: ${escapeHtml(email)}</p>
  `;
  await sendAlert({ subject: `💰 Direct: ${email} → ${tier}`, html });
}

// === Daily summary (cron 09:00) ===
export async function alertDailySummary({ stats }) {
  const cohortConversion = stats.delivered_14d_cohort > 0
    ? Math.round((stats.conversions_14d / stats.delivered_14d_cohort) * 100)
    : 0;
  const html = `
    <h2 style="font-family:system-ui;margin:0 0 16px">📊 RIK Audit — Daily Summary</h2>
    <table style="font-family:system-ui;font-size:14px;border-collapse:collapse">
      <tr><td style="padding:6px 16px 6px 0;color:#555">Pending in queue</td><td><strong>${stats.pending_count}</strong></td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#555">Delivered today</td><td><strong>${stats.delivered_today}</strong></td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#555">Delivered (last 7 days)</td><td><strong>${stats.delivered_7d}</strong></td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#555">Conversions (14d cohort)</td><td><strong>${stats.conversions_14d} / ${stats.delivered_14d_cohort} (${cohortConversion}%)</strong></td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#555">Revenue (14d)</td><td><strong>$${stats.revenue_14d}</strong></td></tr>
    </table>
    <p style="margin-top:24px"><a href="${adminUrl()}" style="background:#0a0a0a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-family:system-ui;display:inline-block">Open admin</a></p>
  `;
  await sendAlert({ subject: `📊 RIK Audit daily — ${stats.delivered_today} sent, ${stats.conversions_14d} conv`, html });
}

// === Generic error alert ===
export async function alertError({ where, error, auditId }) {
  const url = auditId ? adminUrl(`/admin/audit-queue.html?id=${auditId}`) : adminUrl();
  const html = `
    <h2 style="font-family:system-ui;margin:0 0 8px">🔴 Audit error</h2>
    <p style="font-family:system-ui"><strong>Where:</strong> ${escapeHtml(where)}</p>
    <p style="font-family:system-ui;background:#fff5f5;padding:12px;border-radius:8px;font-family:monospace;font-size:12px">${escapeHtml(String(error?.message ?? error))}</p>
    ${auditId ? `<p><a href="${url}">Open audit ${auditId} →</a></p>` : ''}
  `;
  await sendAlert({ subject: `🔴 Audit error in ${where}`, html });
}

// === Athlete-facing: send the delivered audit (via Gmail, not Kit transactional, to keep it free) ===
export async function emailAuditToAthlete({ to, firstName, slug, pdfUrl, tierLabel }) {
  const origin = process.env.SITE_ORIGIN ?? 'https://rikathletica.com';
  const pageUrl = `${origin}/a/${slug}`;
  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;color:#0a0a0a;max-width:560px;line-height:1.65;padding:32px 24px">

      <div style="font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#2D5A3D;margin-bottom:8px">RIK Athletica · Personal Audit</div>

      <h1 style="font-size:24px;font-weight:600;letter-spacing:-0.02em;line-height:1.25;margin:0 0 24px">Your fueling audit is ready, ${escapeHtml(firstName)}.</h1>

      <p style="font-size:16px;color:#1a1a1a;margin:0 0 8px">I read your responses and put together a 4-page prescription showing exactly where the minutes are leaking — and the next step that closes the gap.</p>
      <p style="font-size:16px;color:#1a1a1a;margin:0 0 32px">Recommended next step: <strong>${escapeHtml(tierLabel)}</strong>. The audit explains why.</p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 32px">
        <tr>
          <td style="background:#2D5A3D;border-radius:36px;text-align:center">
            <a href="${pageUrl}" style="display:inline-block;padding:18px 36px;color:#fff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.3px;line-height:1">Open My Fueling Audit →</a>
          </td>
        </tr>
        <tr>
          <td style="padding-top:8px;text-align:center;font-size:12px;color:#888;letter-spacing:0.4px">4-page personalized prescription · printable PDF inside</td>
        </tr>
      </table>

      <p style="font-size:14px;color:#555;margin:0 0 8px;border-top:1px solid #eee;padding-top:24px">If anything in the audit feels off or unclear, hit reply — I read every response personally.</p>

      <p style="font-size:15px;color:#1a1a1a;margin:24px 0 0">— Bek<br><span style="color:#888;font-size:13px">Founder, RIK Athletica</span></p>

      <p style="font-size:11px;color:#aaa;margin-top:32px;border-top:1px solid #f0f0f0;padding-top:16px;line-height:1.5">
        This audit was prepared specifically for you based on your race profile and current fueling. It's an educational fueling overview, not medical advice. Methodology reviewed by a Registered Dietitian Nutritionist (CDR registered, USA).
      </p>

    </div>
  `;
  const t = getTransporter();
  await t.sendMail({
    from: `Bek (RIK Athletica) <${process.env.GMAIL_USER}>`,
    to,
    replyTo: process.env.GMAIL_USER,
    subject: `Your fueling audit is ready, ${firstName}`,
    html,
    text: `Hi ${firstName},\n\nYour 4-page personalized fueling audit is ready:\n${pageUrl}\n\nRecommended next step: ${tierLabel}.\nThe audit explains why and gives you the protocol numbers, gut-training schedule, and top 3 actions for this week.\n\nA print-friendly PDF version is available from the audit page (click "Print as PDF" at the top).\n\nReply if anything's unclear — I read every email.\n\n— Bek\nFounder, RIK Athletica`,
  });
}

// === E0 confirmation to athlete (immediate, post-submit) ===
export async function emailE0Confirmation({ to, firstName }) {
  const html = `
    <div style="font-family:system-ui;color:#0a0a0a;max-width:560px;line-height:1.6">
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>Got your audit submission. I personally review every one — within <strong>2 business days</strong>, your prescriptive PDF + audit page lands in your inbox.</p>
      <p>If you have a question that didn't fit the form, just reply to this email.</p>
      <p>— Bek<br><span style="color:#888;font-size:13px">Founder, RIK Athletica</span></p>
    </div>
  `;
  const t = getTransporter();
  await t.sendMail({
    from: `Bek (RIK Athletica) <${process.env.GMAIL_USER}>`,
    to,
    replyTo: process.env.GMAIL_USER,
    subject: `Your audit is in, ${firstName}`,
    html,
    text: `Hi ${firstName},\n\nGot your submission. I review every audit personally — within 2 business days you'll have your prescriptive PDF and audit page.\n\nReply if you have any questions.\n— Bek`,
  });
}

// === Helpers ===
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}
