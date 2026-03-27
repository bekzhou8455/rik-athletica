/**
 * POST /api/intake
 * Typeform Full Intake webhook handler.
 * Fires when an athlete submits the full intake form after payment.
 * Sends two immediate emails via Resend:
 *   1. Internal alert: "Race Pack for [name] — race [date] — ship by [date - 10 days]"
 *   2. Athlete confirmation: "We have your intake. Your Race Pack ships ~10 days before your race."
 *
 * Required env vars:
 *   RESEND_API_KEY            — re_... from resend.com
 *   INTERNAL_ALERT_EMAIL      — your email for Race Pack ship reminders
 *   TYPEFORM_WEBHOOK_SECRET   — from Typeform → Connect → Webhooks (intake form)
 *
 * Typeform webhook setup:
 *   URL: https://www.rikathletica.com/api/intake
 *   Enable signing
 *   Connect to: Full Intake Form
 *
 * IMPORTANT — Typeform field refs:
 *   After adding race_date, race_distance, email, name fields to the Typeform intake form,
 *   find each field's `ref` value in Typeform Builder → click field → Settings → Ref.
 *   Replace the placeholder values below with the actual ref strings.
 *
 *   TODO: replace these refs with actual values from your Typeform dashboard:
 */

// ─── TYPEFORM FIELD REFS (replace before deploying) ─────────────────────────
const FIELD_REFS = {
  name:          'athlete_name',     // TODO: replace with actual ref
  email:         'athlete_email',    // TODO: replace with actual ref
  race_date:     'race_date',        // TODO: replace with actual ref
  race_distance: 'race_distance',    // TODO: replace with actual ref
};
// ────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto';

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatDate(dateStr) {
  if (!dateStr) return 'unknown date';
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- Verify Typeform HMAC signature ---
  const secret = process.env.TYPEFORM_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers['typeform-signature'] || '';
    const payload = JSON.stringify(req.body);
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('base64');
    if (sig !== expected) {
      console.warn('[intake] Invalid Typeform signature');
      return res.status(403).json({ error: 'Invalid signature' });
    }
  }

  const form = req.body?.form_response || {};
  const answers = form.answers || [];

  // Extract fields by ref
  const findAnswer = (ref) => answers.find(a => a.field?.ref === ref);
  const name      = findAnswer(FIELD_REFS.name)?.text || 'Athlete';
  const email     = findAnswer(FIELD_REFS.email)?.email || '';
  const raceDate  = findAnswer(FIELD_REFS.race_date)?.date || '';  // 'YYYY-MM-DD'
  const distance  = findAnswer(FIELD_REFS.race_distance)?.choice?.label || '';

  const shipByDate    = raceDate ? addDays(raceDate, -10) : '';
  const raceDateFmt   = formatDate(raceDate);
  const shipByFmt     = formatDate(shipByDate);
  const submittedAt   = form.submitted_at || new Date().toISOString();

  console.log(`[intake] name=${name} email=${email} race=${raceDate} distance=${distance} shipBy=${shipByDate} ts=${submittedAt}`);

  const apiKey     = process.env.RESEND_API_KEY;
  const alertEmail = process.env.INTERNAL_ALERT_EMAIL;

  if (!apiKey) {
    // Key not set — acknowledge webhook, log for manual follow-up
    console.warn('[intake] RESEND_API_KEY not set — emails not sent');
    return res.status(200).json({ ok: true, sent: false });
  }

  // Send both emails concurrently
  const sendEmail = async (to, subject, html) => {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'RIK Athletica <hello@rikathletica.com>',
          to: [to],
          subject,
          html,
        }),
      });
      if (!r.ok) {
        console.error(`[intake] Resend error for ${to}:`, r.status, await r.text());
        return false;
      }
      return true;
    } catch (err) {
      console.error(`[intake] Resend exception for ${to}:`, err);
      return false;
    }
  };

  const emails = [];

  // Email 1: Internal Race Pack ship alert
  if (alertEmail) {
    emails.push(sendEmail(
      alertEmail,
      `[RACE PACK] Ship for ${name} — race ${raceDate}`,
      `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Helvetica,Arial,sans-serif;padding:32px;max-width:560px;">
  <h2 style="color:#0a0a0a;margin:0 0 4px;">Race Pack Ship Reminder</h2>
  <p style="font-size:13px;color:#aaa;margin:0 0 24px;">Intake submitted — action needed</p>
  <table style="width:100%;border-collapse:collapse;font-size:15px;">
    <tr><td style="padding:10px 0;color:#888;width:140px;border-bottom:1px solid #eee;">Athlete</td><td style="padding:10px 0;font-weight:600;border-bottom:1px solid #eee;">${name}</td></tr>
    <tr><td style="padding:10px 0;color:#888;border-bottom:1px solid #eee;">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;">${email || '—'}</td></tr>
    <tr><td style="padding:10px 0;color:#888;border-bottom:1px solid #eee;">Distance</td><td style="padding:10px 0;border-bottom:1px solid #eee;">${distance || '—'}</td></tr>
    <tr><td style="padding:10px 0;color:#888;border-bottom:1px solid #eee;">Race Date</td><td style="padding:10px 0;font-weight:600;color:#2D5A3D;border-bottom:1px solid #eee;">${raceDateFmt}</td></tr>
    <tr><td style="padding:10px 0;color:#888;">📦 Ship Race Pack by</td><td style="padding:10px 0;font-weight:700;font-size:18px;color:#c0392b;">${shipByFmt}</td></tr>
  </table>
  <div style="background:#fff5f5;border:1px solid #f5c6c6;border-radius:8px;padding:16px;margin-top:24px;">
    <p style="margin:0;font-size:13px;color:#c0392b;font-weight:600;">Action: Submit Race Pack pick list to ShipWizard before ${shipByFmt}.</p>
    <p style="margin:8px 0 0;font-size:12px;color:#888;">Race Pack contents: see Sprint v2 plan doc. Set a calendar reminder if needed.</p>
  </div>
</body>
</html>`,
    ));
  }

  // Email 2: Athlete Race Pack confirmation
  if (email) {
    emails.push(sendEmail(
      email,
      'Your intake is in — here\'s what happens next',
      `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F5F1;font-family:Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">

  <div style="margin-bottom:32px;">
    <img src="https://cdn.jsdelivr.net/gh/bekzhou8455/rik-athletica@main/assets/media/rik-logo.png" alt="RIK Athletica" style="height:40px;width:auto;">
  </div>

  <h1 style="font-size:24px;font-weight:600;color:#111410;letter-spacing:-0.03em;margin:0 0 10px;">
    Intake received, ${name}.
  </h1>
  <p style="font-size:15px;color:#6B6860;line-height:1.65;margin:0 0 28px;">
    We're building your fueling protocol now. Here's what's happening next.
  </p>

  <div style="height:1px;background:#E4E1DA;margin:0 0 28px;"></div>

  <div style="margin-bottom:20px;">
    <div style="font-size:11px;font-weight:700;color:#2D5A3D;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">Training Box</div>
    <p style="font-size:14px;color:#6B6860;line-height:1.6;margin:0;">
      Shipping within 5 days. Your RIK Bundle + Layer 1 training products, packed to your protocol.
    </p>
  </div>

  <div style="margin-bottom:20px;">
    <div style="font-size:11px;font-weight:700;color:#2D5A3D;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">3 Protocol Iterations</div>
    <p style="font-size:14px;color:#6B6860;line-height:1.6;margin:0;">
      Log session feedback each week. We refine. By Week 4, your race-day plan is locked in.
    </p>
  </div>

  <div style="margin-bottom:36px;">
    <div style="font-size:11px;font-weight:700;color:#2D5A3D;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">Race Pack</div>
    <p style="font-size:14px;color:#6B6860;line-height:1.6;margin:0;">
      ${raceDate
        ? `Your Race Pack — race-day products selected to your final protocol — ships approximately 10 days before your race on <strong style="color:#111410;">${raceDateFmt}</strong>.`
        : `Your Race Pack ships approximately 10 days before your race once your race date is confirmed.`
      }
    </p>
  </div>

  <div style="height:1px;background:#E4E1DA;margin:0 0 20px;"></div>
  <p style="font-size:11px;color:#9C9890;line-height:1.6;margin:0;">
    Questions? Reply to this email or WhatsApp us.
    &nbsp;·&nbsp; <a href="https://www.rikathletica.com/privacy" style="color:#9C9890;">Privacy</a>
    &nbsp;·&nbsp; RIK Athletic Nutrition Inc.
  </p>

</div>
</body>
</html>`,
    ));
  }

  await Promise.all(emails);

  return res.status(200).json({ ok: true, sent: emails.length > 0 });
}
