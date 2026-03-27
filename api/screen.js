/**
 * POST /api/screen
 * Typeform screening webhook handler.
 * Fires on every screening form submission (pass AND fail).
 * On FAIL: sends operator notification email via Resend.
 * On PASS: logs for record-keeping (athlete is redirected automatically by Typeform).
 *
 * Required env vars:
 *   RESEND_API_KEY          — re_... from resend.com
 *   INTERNAL_ALERT_EMAIL    — your email (bek@...) for operator notifications
 *   TYPEFORM_WEBHOOK_SECRET — from Typeform → Connect → Webhooks → signing secret
 *
 * Typeform webhook setup:
 *   URL: https://www.rikathletica.com/api/screen
 *   Enable signing (gives you TYPEFORM_WEBHOOK_SECRET)
 *   Connect to: the Screening Form
 *
 * Determining pass/fail:
 *   Typeform sends the `form_response.landed_at` and the list of answers.
 *   The screening form has a PASS ending and multiple FAIL endings.
 *   We detect FAIL by checking for a `hidden` field "screen_result" set to "fail"
 *   in the Typeform ending screen config — OR by checking which ending was reached
 *   via form_response.calculated.score (if scoring is used).
 *
 *   SIMPLEST APPROACH (used here): read the "screen_result" hidden field value.
 *   In Typeform, set the hidden field "screen_result" to "pass" on the PASS ending
 *   and "fail" on each FAIL ending via Logic Jumps. The webhook payload includes
 *   hidden field values in form_response.hidden.
 *
 *   If hidden fields aren't configured yet, the handler defaults to logging only.
 *   This is safe — the PASS redirect already happened client-side before webhook fires.
 */

import crypto from 'crypto';

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
      console.warn('[screen] Invalid Typeform signature');
      return res.status(403).json({ error: 'Invalid signature' });
    }
  }

  const form = req.body?.form_response || {};
  const hidden = form.hidden || {};
  const answers = form.answers || [];

  // Extract key fields from answers
  const getName = () => answers.find(a => a.field?.ref === 'name')?.text || hidden.name || 'Unknown';
  const getEmail = () => answers.find(a => a.field?.ref === 'email')?.email || hidden.email || '';

  const name = getName();
  const email = getEmail();
  const screenResult = hidden.screen_result || 'unknown'; // 'pass' | 'fail' | 'unknown'
  const failReason = hidden.fail_reason || screenResult; // set per-ending in Typeform hidden fields
  const submittedAt = form.submitted_at || new Date().toISOString();

  console.log(`[screen] result=${screenResult} name=${name} email=${email} reason=${failReason} ts=${submittedAt}`);

  // --- Send operator notification only for FAIL ---
  if (screenResult === 'fail') {
    const apiKey = process.env.RESEND_API_KEY;
    const alertEmail = process.env.INTERNAL_ALERT_EMAIL;

    if (apiKey && alertEmail) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'RIK Athletica <hello@rikathletica.com>',
            to: [alertEmail],
            subject: `[RIK Sprint] Screening blocked: ${name}`,
            html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Helvetica,Arial,sans-serif;padding:32px;max-width:560px;">
  <h2 style="color:#0a0a0a;margin:0 0 16px;">Sprint Screening — Blocked</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:8px 0;color:#888;width:120px;">Name</td><td style="padding:8px 0;color:#111;">${name}</td></tr>
    <tr><td style="padding:8px 0;color:#888;">Email</td><td style="padding:8px 0;color:#111;">${email || '—'}</td></tr>
    <tr><td style="padding:8px 0;color:#888;">Reason</td><td style="padding:8px 0;color:#c0392b;font-weight:600;">${failReason}</td></tr>
    <tr><td style="padding:8px 0;color:#888;">Submitted</td><td style="padding:8px 0;color:#111;">${submittedAt}</td></tr>
  </table>
  <p style="font-size:12px;color:#aaa;margin-top:24px;">This athlete did not proceed to sign-up. No action needed unless they reach out.</p>
</body>
</html>`,
          }),
        });

        if (!r.ok) {
          console.error('[screen] Resend error:', r.status, await r.text());
        }
      } catch (err) {
        console.error('[screen] Unexpected Resend error:', err);
      }
    }
  }

  return res.status(200).json({ ok: true });
}
