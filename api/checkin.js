/**
 * POST /api/checkin
 * Typeform session check-in webhook handler.
 * Fires after each athlete check-in submission.
 * Sends:
 *   1. Internal alert to founder with full session data
 *   2. Brief confirmation to athlete
 *
 * Required env vars:
 *   TYPEFORM_CHECKIN_SECRET   — signing secret from Typeform checkin form webhook
 *   INTERNAL_ALERT_EMAIL      — founder email
 *   GMAIL_USER / GMAIL_APP_PASSWORD — via mailer.js
 *
 * Typeform hidden fields (pre-filled via URL params):
 *   email        — athlete email
 *   athlete_name — athlete name (optional but recommended)
 *
 * Pre-filled URL format:
 *   https://form.typeform.com/to/[FORM_ID]?email=athlete@email.com&athlete_name=John
 *
 * Typeform field refs (set in Typeform Builder → Block → Settings → Ref):
 */

// ─── TYPEFORM FIELD REFS ─────────────────────────────────────────────────────
const FIELD_REFS = {
  athlete_email:      'athlete_email',
  athlete_name_q:     'athlete_name_q',
  session_type:       'session_type',
  protocol_adherence: 'protocol_adherence',
  protocol_deviation: 'protocol_deviation',
  energy_rating:      'energy_rating',
  recovery_rating:    'recovery_rating',
  notable_notes:      'notable_notes',
  pb_comparison:      'pb_comparison',
  session_screenshot: 'session_screenshot',
};
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import { sendMail, mailerReady } from './mailer.js';

// ─── Render a 1–5 dot rating as coloured circles ───
function ratingDots(score, max = 5) {
  const filled   = '●';
  const empty    = '○';
  const color    = score >= 4 ? '#2D5A3D' : score >= 3 ? '#C4500F' : '#c0392b';
  const dots     = filled.repeat(score) + empty.repeat(max - score);
  return `<span style="color:${color};font-size:16px;letter-spacing:2px;">${dots}</span>
          <span style="font-size:13px;color:#888;margin-left:6px;">${score}/${max}</span>`;
}

// ─── Is the PB value substantive enough to celebrate? ───
function isRealPB(value) {
  if (!value) return false;
  const trivial = ['no', 'n/a', 'na', 'n.a.', 'none', 'nope', 'nothing', 'not yet', 'nah', '-', '—', 'no pb'];
  return !trivial.includes(value.trim().toLowerCase());
}

// ─── Adherence badge ───
function adherenceBadge(value) {
  const map = {
    'Yes, exactly': { bg: '#e6f4ec', border: '#a8d5b5', text: '#1a6b3a', label: 'Yes, exactly' },
    'Mostly':       { bg: '#fff8e6', border: '#f5d87a', text: '#8a6000', label: 'Mostly'        },
    'No':           { bg: '#fdecea', border: '#f5b8b0', text: '#a0291f', label: 'No'             },
  };
  const s = map[value] || { bg: '#f3f3f3', border: '#ccc', text: '#555', label: value || '—' };
  return `<span style="display:inline-block;background:${s.bg};border:1px solid ${s.border};
    color:${s.text};font-size:13px;font-weight:600;padding:3px 12px;border-radius:20px;">
    ${s.label}</span>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── Verify Typeform HMAC signature ───
  const secret = process.env.TYPEFORM_CHECKIN_SECRET;
  if (secret) {
    const sig      = req.headers['typeform-signature'] || '';
    const payload  = JSON.stringify(req.body);
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('base64');
    if (sig !== expected) {
      console.warn('[checkin] Invalid Typeform signature');
      return res.status(403).json({ error: 'Invalid signature' });
    }
  }

  // ─── Skip partial responses ───
  if (req.body?.event_type === 'form_response_partial') {
    console.log('[checkin] Skipping partial response');
    return res.status(200).json({ ok: true, skipped: 'partial' });
  }

  const form    = req.body?.form_response || {};
  const answers = form.answers || [];
  const hidden  = form.hidden  || {};

  // ─── Field extractors ───
  const findAnswer = (ref) => answers.find(a => a.field?.ref === ref);
  const ch   = (ref) => findAnswer(ref)?.choice?.label || findAnswer(ref)?.choices?.labels?.join(', ') || '';
  const txt  = (ref) => findAnswer(ref)?.text || '';
  const num  = (ref) => findAnswer(ref)?.number ?? null;
  const file = (ref) => findAnswer(ref)?.file_url || '';

  // ─── Extract fields ───
  const sessionType       = ch(FIELD_REFS.session_type);
  const adherence         = ch(FIELD_REFS.protocol_adherence);
  const deviation         = txt(FIELD_REFS.protocol_deviation);
  const energyRating      = num(FIELD_REFS.energy_rating);
  const recoveryRating    = num(FIELD_REFS.recovery_rating);
  const notableNotes      = txt(FIELD_REFS.notable_notes);
  const pbComparison      = txt(FIELD_REFS.pb_comparison);
  const screenshotUrl     = file(FIELD_REFS.session_screenshot);

  // ─── Athlete identity — read from visible answers first, fall back to hidden ───
  const athleteEmail = em(FIELD_REFS.athlete_email)   || txt(FIELD_REFS.athlete_email)   || hidden.email        || '';
  const athleteName  = txt(FIELD_REFS.athlete_name_q) || hidden.athlete_name || 'Athlete';
  const submittedAt  = form.submitted_at   || new Date().toISOString();

  console.log(`[checkin] ${athleteName} | ${sessionType} | adherence=${adherence} | energy=${energyRating} | recovery=${recoveryRating} | ts=${submittedAt}`);

  if (!mailerReady()) {
    console.warn('[checkin] Gmail credentials not set — emails not sent');
    return res.status(200).json({ ok: true, sent: false });
  }

  const alertEmail = process.env.INTERNAL_ALERT_EMAIL;
  const results    = { alert: false, confirmation: false };

  // ─── 1. Internal founder alert ───
  if (alertEmail) {
    try {
      await sendMail({
        to:      alertEmail,
        subject: `Check-in: ${athleteName} — ${sessionType} — adherence: ${adherence}`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Helvetica,Arial,sans-serif;padding:32px;max-width:600px;color:#111;background:#fff;">

  <h2 style="margin:0 0 4px;color:#2D5A3D;">Session Check-in</h2>
  <p style="font-size:13px;color:#aaa;margin:0 0 28px;">${submittedAt.replace('T',' ').slice(0,16)} UTC</p>

  <!-- Athlete + session -->
  <table style="font-size:14px;border-collapse:collapse;width:100%;margin-bottom:24px;">
    <tr>
      <td style="padding:7px 16px 7px 0;color:#888;width:140px;">Athlete</td>
      <td style="padding:7px 0;font-weight:600;">${athleteName}</td>
    </tr>
    <tr>
      <td style="padding:7px 16px 7px 0;color:#888;">Email</td>
      <td style="padding:7px 0;">${athleteEmail || '—'}</td>
    </tr>
    <tr>
      <td style="padding:7px 16px 7px 0;color:#888;">Session</td>
      <td style="padding:7px 0;font-weight:600;">${sessionType || '—'}</td>
    </tr>
    <tr>
      <td style="padding:7px 16px 7px 0;color:#888;vertical-align:middle;">Protocol</td>
      <td style="padding:7px 0;">${adherenceBadge(adherence)}</td>
    </tr>
  </table>

  ${deviation ? `
  <div style="background:#fff8e6;border:1px solid #f5d87a;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
    <p style="margin:0 0 4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#8a6000;">Deviation</p>
    <p style="margin:0;font-size:14px;color:#111;line-height:1.6;">${deviation}</p>
  </div>` : ''}

  <!-- Ratings -->
  <h3 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#2D5A3D;margin:0 0 12px;">Outcome Ratings</h3>
  <table style="font-size:14px;border-collapse:collapse;width:100%;margin-bottom:24px;">
    <tr>
      <td style="padding:8px 16px 8px 0;color:#888;width:140px;">Energy (final third)</td>
      <td style="padding:8px 0;">${energyRating !== null ? ratingDots(energyRating) : '—'}</td>
    </tr>
    <tr>
      <td style="padding:8px 16px 8px 0;color:#888;">Recovery (morning after)</td>
      <td style="padding:8px 0;">${recoveryRating !== null ? ratingDots(recoveryRating) : '—'}</td>
    </tr>
  </table>

  ${notableNotes ? `
  <h3 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#2D5A3D;margin:0 0 8px;">Notable</h3>
  <p style="font-size:14px;color:#111;line-height:1.6;margin:0 0 24px;">${notableNotes}</p>` : ''}

  ${pbComparison ? `
  <div style="background:#e6f4ec;border:1px solid #a8d5b5;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
    <p style="margin:0 0 4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#1a6b3a;">PB / Notable Result</p>
    <p style="margin:0;font-size:15px;font-weight:600;color:#111;">${pbComparison}</p>
  </div>` : ''}

  ${screenshotUrl ? `
  <h3 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#2D5A3D;margin:0 0 8px;">Session Data</h3>
  <p style="margin:0 0 24px;">
    <a href="${screenshotUrl}" style="font-size:14px;color:#2D5A3D;font-weight:500;">View session screenshot →</a>
  </p>` : ''}

  <div style="border-top:1px solid #eee;padding-top:16px;margin-top:8px;">
    <p style="font-size:12px;color:#aaa;margin:0;">RIK Athletica · Session Check-in Alert</p>
  </div>

</body>
</html>`,
      });
      results.alert = true;
    } catch (err) {
      console.error('[checkin] Alert email failed:', err.message);
    }
  }

  // ─── 2. Athlete confirmation ───
  if (athleteEmail) {
    try {
      await sendMail({
        to:      athleteEmail,
        subject: `Check-in received — ${sessionType}`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F5F1;font-family:Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">

  <div style="margin-bottom:32px;">
    <img src="https://cdn.jsdelivr.net/gh/bekzhou8455/rik-athletica@main/assets/media/rik-logo-cropped.png" alt="RIK Athletica" style="height:36px;width:auto;">
  </div>

  <h1 style="font-size:22px;font-weight:600;color:#111410;letter-spacing:-0.03em;margin:0 0 10px;">
    Got your check-in, ${athleteName}.
  </h1>
  <p style="font-size:15px;color:#6B6860;line-height:1.65;margin:0 0 24px;">
    We've logged your <strong style="color:#111410;">${sessionType || 'session'}</strong> data and will factor it into your next protocol update.
  </p>

  ${isRealPB(pbComparison) ? `
  <div style="background:#e6f4ec;border:1px solid #a8d5b5;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
    <p style="margin:0 0 2px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#1a6b3a;">Result logged</p>
    <p style="margin:0;font-size:15px;font-weight:600;color:#111410;">${pbComparison}</p>
  </div>` : ''}

  <div style="height:1px;background:#E4E1DA;margin:0 0 20px;"></div>
  <p style="font-size:11px;color:#9C9890;line-height:1.6;margin:0;">
    Questions? Reply to this email.
    &nbsp;·&nbsp; <a href="https://www.rikathletica.com/privacy" style="color:#9C9890;">Privacy</a>
    &nbsp;·&nbsp; RIK Athletic Nutrition Inc.
  </p>

</div>
</body>
</html>`,
      });
      results.confirmation = true;
    } catch (err) {
      console.error('[checkin] Confirmation email failed:', err.message);
    }
  }

  console.log('[checkin] Results:', JSON.stringify(results));
  return res.status(200).json({ ok: true, ...results });
}
