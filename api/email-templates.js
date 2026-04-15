/**
 * Email templates for the RIK Athletica drip sequence.
 * E0 is in leads.js (sent immediately).
 * E1-E3 are scheduled sends via Resend.
 */

const BRAND = {
  logo: 'https://cdn.jsdelivr.net/gh/bekzhou8455/rik-athletica@main/assets/media/rik-logo-cropped.png',
  green: '#2D5A3D',
  teal: '#1a7a6e',
  orange: '#C4500F',
  bg: '#F7F5F1',
  text: '#111410',
  muted: '#6B6860',
  subtle: '#9C9890',
  border: '#E4E1DA',
  site: 'https://www.rikathletica.com',
};

function wrap(content) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <div style="margin-bottom:36px;">
    <img src="${BRAND.logo}" alt="RIK Athletica" style="height:40px;width:auto;">
  </div>
  ${content}
  <div style="height:1px;background:${BRAND.border};margin:28px 0 20px;"></div>
  <p style="font-size:11px;color:${BRAND.subtle};line-height:1.6;margin:0;">
    You're receiving this because you used the RIK Nutrition Calculator.
    <a href="${BRAND.site}/privacy" style="color:${BRAND.subtle};">Privacy</a>
    &nbsp;&middot;&nbsp; RIK Athletic Nutrition Inc.
  </p>
</div>
</body>
</html>`;
}

function cta(text, url) {
  return `<div style="margin:28px 0 36px;">
    <a href="${url}" style="display:inline-block;background:${BRAND.green};color:#fff;text-decoration:none;font-size:14px;font-weight:500;padding:13px 28px;border-radius:36px;">
      ${text}
    </a>
  </div>`;
}

// ─── E1: Day 2 — L-Glutamine differentiator ───
export const E1 = {
  subject: 'The ingredient no mainstream gel includes',
  delay_hours: 48,
  html: () => wrap(`
  <h1 style="font-size:24px;font-weight:600;color:${BRAND.text};letter-spacing:-0.03em;line-height:1.2;margin:0 0 16px;">
    Most gels solve half the problem.
  </h1>
  <p style="font-size:15px;color:${BRAND.muted};line-height:1.65;margin:0 0 20px;">
    Traditional endurance gels deliver carbohydrates. That's Layer 1. Necessary, but it's table stakes. Every brand does it.
  </p>
  <p style="font-size:15px;color:${BRAND.muted};line-height:1.65;margin:0 0 20px;">
    What nobody else offers is Layer 2: session enhancement, gut protection, and accelerated recovery. That's what RIK built.
  </p>

  <div style="background:rgba(45,90,61,0.08);border:1px solid rgba(45,90,61,0.15);border-radius:12px;padding:20px 24px;margin:24px 0;">
    <p style="font-size:14px;font-weight:600;color:${BRAND.green};margin:0 0 8px;">
      1g L-Glutamine per Refuel sachet
    </p>
    <p style="font-size:13px;color:${BRAND.muted};line-height:1.6;margin:0;">
      Supports gut integrity during extended effort.&dagger; Most GI issues at km 25-30 of the Ironman run aren't fitness problems. They're intestinal barrier challenges. No mainstream gel addresses this.
    </p>
  </div>

  <p style="font-size:15px;color:${BRAND.muted};line-height:1.65;margin:20px 0;">
    Euphoria (pre-session) + Refuel (intra + recovery). The enhancement layer you can try on your own terms.
  </p>

  ${cta('Try the Enhancement Layer — $119 →', BRAND.site + '/bundle')}

  <p style="font-size:12px;color:${BRAND.subtle};margin:0;">
    &dagger; These statements have not been evaluated by the FDA. This product is not intended to diagnose, treat, cure, or prevent any disease. Individual results may vary.
  </p>
  `),
};

// ─── E2: Day 5 — What a Sprint protocol looks like ───
export const E2 = {
  subject: 'What a personalized fueling protocol actually looks like',
  delay_hours: 120,
  html: () => wrap(`
  <h1 style="font-size:24px;font-weight:600;color:${BRAND.text};letter-spacing:-0.03em;line-height:1.2;margin:0 0 16px;">
    This is what you get with Sprint.
  </h1>
  <p style="font-size:15px;color:${BRAND.muted};line-height:1.65;margin:0 0 24px;">
    Not a PDF template. Not generic advice. A fueling system built from your data, delivered to your door, and revised weekly until your body responds.
  </p>

  <div style="margin:0 0 16px;">
    <div style="background:${BRAND.text};border-radius:12px;overflow:hidden;margin-bottom:10px;">
      <img src="https://cdn.jsdelivr.net/gh/bekzhou8455/rik-athletica@main/assets/media/comp-week-grid.jpg" alt="Week Grid" style="width:100%;height:auto;display:block;">
      <div style="padding:16px 24px;">
        <p style="font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.35);margin:0 0 6px;">Document 01</p>
        <p style="font-size:18px;font-weight:500;color:#fff;margin:0 0 4px;">Week Grid</p>
        <p style="font-size:13px;color:rgba(255,255,255,0.45);margin:0;">Your full training week with carb targets, product timing, and fluid goals per session.</p>
      </div>
    </div>
    <div style="background:${BRAND.text};border-radius:12px;overflow:hidden;margin-bottom:10px;">
      <img src="https://cdn.jsdelivr.net/gh/bekzhou8455/rik-athletica@main/assets/media/comp-session-protocol.jpg" alt="Session Protocol" style="width:100%;height:auto;display:block;">
      <div style="padding:16px 24px;">
        <p style="font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.35);margin:0 0 6px;">Document 02</p>
        <p style="font-size:18px;font-weight:500;color:#fff;margin:0 0 4px;">Session Protocol</p>
        <p style="font-size:13px;color:rgba(255,255,255,0.45);margin:0;">Minute-by-minute fueling timeline. Pre-session, intra, recovery. Every product placed.</p>
      </div>
    </div>
    <div style="background:${BRAND.text};border-radius:12px;overflow:hidden;">
      <img src="https://cdn.jsdelivr.net/gh/bekzhou8455/rik-athletica@main/assets/media/comp-performance-report.jpg" alt="Performance Report" style="width:100%;height:auto;display:block;">
      <div style="padding:16px 24px;">
        <p style="font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.35);margin:0 0 6px;">Document 03</p>
        <p style="font-size:18px;font-weight:500;color:#fff;margin:0 0 4px;">Performance Report</p>
        <p style="font-size:13px;color:rgba(255,255,255,0.45);margin:0;">Gap analysis showing where you're losing time and what Sprint closes.</p>
      </div>
    </div>
  </div>

  <p style="font-size:15px;color:${BRAND.muted};line-height:1.65;margin:20px 0;">
    Plus: all products delivered (Layer 1 + Layer 2), calendar sync, and weekly revisions from real session feedback. One price. Nutrition handled.
  </p>

  ${cta('See How Sprint Works →', BRAND.site + '/sprint')}

  <div style="display:flex;gap:16px;margin:0 0 8px;">
    <span style="font-size:12px;color:${BRAND.subtle};">From $569</span>
    <span style="font-size:12px;color:${BRAND.subtle};">&middot;</span>
    <span style="font-size:12px;color:${BRAND.subtle};">All products included</span>
    <span style="font-size:12px;color:${BRAND.subtle};">&middot;</span>
    <span style="font-size:12px;color:${BRAND.subtle};">Weekly revisions</span>
  </div>
  `),
};

// ─── E3: Day 7 — Urgency ───
export const E3 = {
  subject: 'Your race is getting closer. The protocol needs 4 weeks.',
  delay_hours: 168,
  html: () => wrap(`
  <h1 style="font-size:24px;font-weight:600;color:${BRAND.text};letter-spacing:-0.03em;line-height:1.2;margin:0 0 16px;">
    The clock is already running.
  </h1>
  <p style="font-size:15px;color:${BRAND.muted};line-height:1.65;margin:0 0 20px;">
    The Sprint protocol needs 4 weeks to gut-train your body for race day. That's one training block. Every week you wait is a week your gut doesn't adapt.
  </p>

  <div style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:12px;padding:24px;margin:24px 0;">
    <p style="font-size:13px;font-weight:600;color:${BRAND.text};margin:0 0 12px;">How the 4 weeks work:</p>
    <div style="margin:0;">
      <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;">
        <span style="color:${BRAND.green};font-weight:600;min-width:60px;">Week 1</span>
        <span style="color:${BRAND.muted};">Baseline protocol. Gut training begins at your current capacity.</span>
      </div>
      <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;">
        <span style="color:${BRAND.green};font-weight:600;min-width:60px;">Week 2</span>
        <span style="color:${BRAND.muted};">First revision from session feedback. Carb targets increase.</span>
      </div>
      <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;">
        <span style="color:${BRAND.green};font-weight:600;min-width:60px;">Week 3</span>
        <span style="color:${BRAND.muted};">Second revision. Your gut is adapting. Protocol tightens.</span>
      </div>
      <div style="display:flex;gap:12px;padding:8px 0;font-size:13px;">
        <span style="color:${BRAND.green};font-weight:600;min-width:60px;">Week 4</span>
        <span style="color:${BRAND.muted};">Race-day plan locked in. Nothing left to guess.</span>
      </div>
    </div>
  </div>

  <p style="font-size:15px;color:${BRAND.muted};line-height:1.65;margin:0 0 8px;">
    30 Sprint slots per race cycle. Founder-delivered.
  </p>
  <p style="font-size:15px;color:${BRAND.text};font-weight:500;margin:0 0 20px;">
    Cancel before your Training Box ships for a full refund. After that, we revise until it works.
  </p>

  ${cta('Start My Sprint →', BRAND.site + '/sprint')}

  <p style="font-size:13px;color:${BRAND.muted};margin:0;">
    Not ready for Sprint? <a href="${BRAND.site}/bundle" style="color:${BRAND.green};text-decoration:none;">Try the Enhancement Layer Bundle — $119</a>
  </p>
  `),
};
