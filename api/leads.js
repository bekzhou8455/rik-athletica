/**
 * POST /api/leads
 * Captures calculator email gate submissions, adds contact to Resend Audience,
 * sends E0 immediately, and schedules E1-E3 follow-up emails.
 *
 * Required env vars (Vercel dashboard → Settings → Environment Variables):
 *   RESEND_API_KEY       — your key from resend.com (starts with re_...)
 *   RESEND_AUDIENCE_ID   — audience ID from Resend dashboard (aud_...)
 *
 * Without the key the endpoint still returns 200 so the gate unblocks — it just
 * won't send emails or create contacts. Add the keys and redeploy to activate.
 */

import { E1, E2, E3 } from './email-templates.js';

const FROM = 'RIK Athletica <hello@rikathletica.com>';

// ─── E0 template (sent immediately) ───
const E0_SUBJECT = 'Your IRONMAN nutrition loss — full breakdown';
const E0_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F5F1;font-family:Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">

  <div style="margin-bottom:36px;">
    <img src="https://cdn.jsdelivr.net/gh/bekzhou8455/rik-athletica@main/assets/media/rik-logo-cropped.png" alt="RIK Athletica" style="height:40px;width:auto;">
  </div>

  <h1 style="font-size:26px;font-weight:600;color:#111410;letter-spacing:-0.03em;line-height:1.2;margin:0 0 12px;">
    You calculated your nutrition loss.
  </h1>
  <p style="font-size:15px;color:#6B6860;line-height:1.65;margin:0 0 28px;">
    Most athletes leave 20–40 minutes on course from three preventable nutrition gaps.* Here's where the time goes — and what to do about it.
  </p>

  <div style="height:1px;background:#E4E1DA;margin:0 0 28px;"></div>

  <div style="margin-bottom:20px;">
    <div style="font-size:13px;font-weight:700;color:#C4500F;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">GI Distress</div>
    <p style="font-size:14px;color:#6B6860;line-height:1.6;margin:0;">
      Untrained gut = race-ending nausea. Athletes who gut-train before race day may significantly reduce GI risk.* Most skip this entirely.
    </p>
  </div>

  <div style="margin-bottom:20px;">
    <div style="font-size:13px;font-weight:700;color:#2D5A3D;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">Carb Deficit</div>
    <p style="font-size:14px;color:#6B6860;line-height:1.6;margin:0;">
      Higher carbohydrate intake correlates with faster Ironman finish times (Pfeiffer et al., 2012). Every 10 g/hr under your target may cost minutes at race pace.*
    </p>
  </div>

  <div style="margin-bottom:36px;">
    <div style="font-size:13px;font-weight:700;color:#2A5080;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">Second-Half Collapse</div>
    <p style="font-size:14px;color:#6B6860;line-height:1.6;margin:0;">
      Pace fade after km 80 on the bike, or the run/walk inflection point. Almost always a fueling signal — not a fitness ceiling.
    </p>
  </div>

  <div style="margin-bottom:40px;">
    <a href="https://www.rikathletica.com/sprint"
       style="display:inline-block;background:#2D5A3D;color:#fff;text-decoration:none;font-size:14px;font-weight:500;padding:13px 28px;border-radius:36px;">
      See how Sprint closes the gap →
    </a>
  </div>

  <div style="height:1px;background:#E4E1DA;margin:0 0 20px;"></div>
  <p style="font-size:11px;color:#9C9890;line-height:1.6;margin:0;">
    *Estimates based on peer-reviewed research. Individual results vary. You're receiving this because you used the RIK Nutrition Calculator.
    <a href="https://www.rikathletica.com/privacy" style="color:#9C9890;">Privacy</a>
    &nbsp;&middot;&nbsp; RIK Athletic Nutrition Inc.
  </p>

</div>
</body>
</html>`;

// ─── Helper: call Resend API ───
async function resendFetch(apiKey, path, body) {
  const r = await fetch(`https://api.resend.com${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, status: r.status, data: r.ok ? await r.json() : await r.text() };
}

// ─── Helper: schedule an email for later ───
function scheduleAt(hoursFromNow) {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  return d.toISOString();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, source } = req.body || {};
  const cleaned = (email || '').trim().toLowerCase();

  if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const src = (source || 'calculator').replace(/[^a-z0-9_-]/gi, '');
  const ts  = new Date().toISOString();
  console.log(`[lead] ${cleaned} | source=${src} | ts=${ts}`);

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;

  if (!apiKey) {
    return res.status(200).json({ ok: true, sent: false, reason: 'no_api_key' });
  }

  const results = { contact: false, e0: false, e1: false, e2: false, e3: false };

  try {
    // ─── 1. Add contact to Resend Audience ───
    if (audienceId) {
      const contact = await resendFetch(apiKey, '/contacts', {
        email: cleaned,
        audience_id: audienceId,
        unsubscribed: false,
        properties: { source: src, captured_at: ts },
      });
      results.contact = contact.ok;
      if (!contact.ok) console.error('[lead] Contact creation failed:', contact.data);
      else console.log('[lead] Contact created:', contact.data);
    }

    // ─── 2. Send E0 immediately ───
    const e0 = await resendFetch(apiKey, '/emails', {
      from: FROM,
      to: [cleaned],
      subject: E0_SUBJECT,
      html: E0_HTML,
    });
    results.e0 = e0.ok;
    if (!e0.ok) console.error('[lead] E0 send failed:', e0.data);

    // ─── 3. Schedule E1 (Day 2) ───
    const e1 = await resendFetch(apiKey, '/emails', {
      from: FROM,
      to: [cleaned],
      subject: E1.subject,
      html: E1.html(),
      scheduled_at: scheduleAt(E1.delay_hours),
    });
    results.e1 = e1.ok;
    if (!e1.ok) console.error('[lead] E1 schedule failed:', e1.data);

    // ─── 4. Schedule E2 (Day 5) ───
    const e2 = await resendFetch(apiKey, '/emails', {
      from: FROM,
      to: [cleaned],
      subject: E2.subject,
      html: E2.html(),
      scheduled_at: scheduleAt(E2.delay_hours),
    });
    results.e2 = e2.ok;
    if (!e2.ok) console.error('[lead] E2 schedule failed:', e2.data);

    // ─── 5. Schedule E3 (Day 7) ───
    const e3 = await resendFetch(apiKey, '/emails', {
      from: FROM,
      to: [cleaned],
      subject: E3.subject,
      html: E3.html(),
      scheduled_at: scheduleAt(E3.delay_hours),
    });
    results.e3 = e3.ok;
    if (!e3.ok) console.error('[lead] E3 schedule failed:', e3.data);

    // ─── 6. Internal notification to founder ───
    const alertEmail = process.env.INTERNAL_ALERT_EMAIL;
    if (alertEmail) {
      await resendFetch(apiKey, '/emails', {
        from: FROM,
        to: [alertEmail],
        subject: `New lead: ${cleaned} (${src})`,
        html: `<div style="font-family:sans-serif;padding:20px;">
          <h2 style="margin:0 0 12px;">New Lead Captured</h2>
          <p><strong>Email:</strong> ${cleaned}</p>
          <p><strong>Source:</strong> ${src}</p>
          <p><strong>Time:</strong> ${ts}</p>
          <p><strong>Sequence:</strong> E0 sent immediately. E1 scheduled Day 2. E2 Day 5. E3 Day 7.</p>
          <hr style="border:none;border-top:1px solid #ddd;margin:16px 0;">
          <p style="font-size:12px;color:#888;">RIK Athletica Lead Notification</p>
        </div>`,
      }).catch(() => {});
    }

    console.log('[lead] Results:', JSON.stringify(results));
    return res.status(200).json({ ok: true, ...results });

  } catch (err) {
    console.error('[lead] Unexpected error:', err);
    return res.status(200).json({ ok: true, sent: false, error: err.message });
  }
}
