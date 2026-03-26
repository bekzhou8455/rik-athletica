/**
 * POST /api/leads
 * Captures calculator email gate submissions and sends a follow-up via Resend.
 *
 * Required env var (set in Vercel dashboard → Settings → Environment Variables):
 *   RESEND_API_KEY  — your key from resend.com (starts with re_...)
 *
 * Without the key the endpoint still returns 200 so the gate unblocks — it just
 * won't send an email. Add the key and redeploy to activate sending.
 */
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
  if (!apiKey) {
    // No key yet — gate unblocks, email not sent
    return res.status(200).json({ ok: true, sent: false });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'RIK Athletica <hello@rikathletica.com>',
        to: [cleaned],
        subject: 'Your IRONMAN nutrition loss — full breakdown',
        html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F5F1;font-family:Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">

  <div style="margin-bottom:36px;">
    <img src="https://cdn.jsdelivr.net/gh/bekzhou8455/rik-athletica@main/assets/media/rik-logo.png" alt="RIK Athletica" style="height:40px;width:auto;">
  </div>

  <h1 style="font-size:26px;font-weight:600;color:#111410;letter-spacing:-0.03em;line-height:1.2;margin:0 0 12px;">
    You calculated your nutrition loss.
  </h1>
  <p style="font-size:15px;color:#6B6860;line-height:1.65;margin:0 0 28px;">
    Most athletes leave 20–40 minutes on course from three preventable nutrition gaps. Here's where the time goes — and what to do about it.
  </p>

  <div style="height:1px;background:#E4E1DA;margin:0 0 28px;"></div>

  <div style="margin-bottom:20px;">
    <div style="font-size:13px;font-weight:700;color:#C4500F;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">GI Distress</div>
    <p style="font-size:14px;color:#6B6860;line-height:1.6;margin:0;">
      Untrained gut = race-ending nausea. Athletes who gut-train in the 8 weeks before race day have 2× lower GI risk. Most skip this entirely.
    </p>
  </div>

  <div style="margin-bottom:20px;">
    <div style="font-size:13px;font-weight:700;color:#2D5A3D;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">Carb Deficit</div>
    <p style="font-size:14px;color:#6B6860;line-height:1.6;margin:0;">
      r = −0.55 correlation between carb intake and finish time across 221 IRONMAN athletes (Pfeiffer et al., 2012). Every 10 g/hr under your target costs minutes at race pace.
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
      See how Sprint Protocol closes the gap →
    </a>
  </div>

  <div style="height:1px;background:#E4E1DA;margin:0 0 20px;"></div>
  <p style="font-size:11px;color:#9C9890;line-height:1.6;margin:0;">
    You're receiving this because you used the RIK Nutrition Calculator at rikathletica.com. No spam — ever.
    <a href="https://www.rikathletica.com/privacy" style="color:#9C9890;">Privacy</a>
    &nbsp;·&nbsp; RIK Athletic Nutrition Inc., 477 Madison Ave, New York, NY 10022
  </p>

</div>
</body>
</html>`,
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('[lead] Resend error:', r.status, err);
      return res.status(200).json({ ok: true, sent: false });
    }

    return res.status(200).json({ ok: true, sent: true });

  } catch (err) {
    console.error('[lead] Unexpected error:', err);
    return res.status(200).json({ ok: true, sent: false });
  }
}
