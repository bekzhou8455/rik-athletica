// RIK Audit — Shared HTML renderer.
// Builds the personalized audit page from db row → string of HTML.
// Used by /a/[slug] (public page) AND PDF generator (puppeteer renders the same HTML).

import { GUT_WEEK_CEILINGS, RD_NAME, CITATIONS } from './methodology.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function tierCta(tierKey) {
  const map = {
    bundle:     { label: 'Get the Bundle — $119',                href: '/bundle' },
    bundle_pdf: { label: 'Get Bundle + Race-Day PDF — $179',     href: '/bundle?addon=pdf' },
    sprint:     { label: 'Start Sprint — from $569',             href: '/sprint' },
    premium:    { label: 'Apply for Premium — $1,599',           href: '/premium' },
  };
  return map[tierKey] ?? map.sprint;
}

export function renderAuditPage(row) {
  const drafts = row.drafts_final ?? row.drafts ?? {};
  const engine = row.engine ?? {};
  const answers = row.answers ?? {};
  const tier = engine.tier_recommendation ?? { tier: 'sprint', label: 'Sprint', explanation: '' };
  const trackA = engine.track_a ?? {};
  const trackB = engine.track_b ?? {};
  const cta = tierCta(tier.tier);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Your fueling audit, ${escapeHtml(row.first_name ?? 'athlete')} — RIK Athletica</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300..800&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --sand: #f6f5f4;
    --off-black: #0a0a0a;
    --green: #2D5A3D;
    --green-light: #4ade80;
    --border: rgba(0,0,0,0.08);
    --muted: #666;
    --warn: #c44;
    --r-card: 16px;
    --r-btn: 36px;
  }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background: var(--sand); color: var(--off-black); -webkit-font-smoothing: antialiased; line-height: 1.6; }
  .page { max-width: 740px; margin: 0 auto; padding: 48px 24px 96px; }

  header.audit-header { margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
  .brand { font-size: 11px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: var(--green); }
  .doc-title { font-size: 32px; font-weight: 600; letter-spacing: -0.02em; margin: 12px 0 8px; line-height: 1.2; }
  .meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); letter-spacing: 0.5px; }

  section { background: #fff; border: 1px solid var(--border); border-radius: var(--r-card); padding: 32px; margin: 24px 0; }
  section h2 { font-size: 11px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: var(--green); margin-bottom: 16px; }
  section h3 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; margin-bottom: 12px; }
  section p { margin-bottom: 12px; font-size: 15px; }
  section p:last-child { margin-bottom: 0; }

  .nums-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 20px 0; }
  .num-card { background: var(--sand); border-radius: 12px; padding: 16px 20px; }
  .num-card .label { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 1.6px; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
  .num-card .value { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; }
  .num-card .unit { font-size: 13px; color: var(--muted); margin-left: 4px; }

  table.gut-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
  table.gut-table th, table.gut-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); }
  table.gut-table th { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 1.4px; text-transform: uppercase; color: var(--muted); background: var(--sand); }

  .citation-block { background: rgba(45,90,61,0.06); border-left: 3px solid var(--green); padding: 16px 20px; border-radius: 8px; margin: 16px 0; font-size: 13px; line-height: 1.5; }
  .citation-block strong { display: block; margin-bottom: 6px; color: var(--green); font-size: 12px; letter-spacing: 0.4px; }
  .citation-block ul { padding-left: 18px; margin-top: 6px; }

  .disclaimer-block { background: #fffaf0; border-left: 3px solid #d97706; padding: 14px 18px; border-radius: 8px; margin: 16px 0; font-size: 12px; line-height: 1.5; color: #555; }
  .disclaimer-block strong { color: #d97706; display: block; margin-bottom: 4px; font-size: 11px; letter-spacing: 0.4px; text-transform: uppercase; }

  .cta { display: inline-block; padding: 14px 28px; background: var(--off-black); color: #fff; text-decoration: none; border-radius: var(--r-btn); font-weight: 600; font-size: 15px; margin-top: 16px; }
  .cta.green { background: var(--green); }
  .cta:hover { opacity: 0.92; }

  .actions-list { margin: 16px 0; padding: 0; list-style: none; }
  .actions-list li { padding: 14px 16px; background: var(--sand); border-radius: 10px; margin-bottom: 8px; }
  .actions-list .num { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--green); font-weight: 700; letter-spacing: 1px; }
  .actions-list .title { font-weight: 600; margin: 4px 0 6px; font-size: 16px; }
  .actions-list .detail { font-size: 14px; color: #444; }

  .print-bar { position: sticky; top: 12px; z-index: 10; display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 16px; }
  .print-btn {
    background: var(--green); color: #fff; border: none; cursor: pointer;
    font-family: inherit; font-weight: 600; font-size: 13px; letter-spacing: 0.3px;
    padding: 12px 22px; border-radius: 999px; box-shadow: 0 4px 12px rgba(45,90,61,0.25);
    transition: transform 0.1s, box-shadow 0.1s;
    display: inline-flex; align-items: center; gap: 8px;
  }
  .print-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(45,90,61,0.32); }
  .print-btn:active { transform: translateY(0); }
  .print-btn svg { width: 14px; height: 14px; flex-shrink: 0; }

  footer.audit-footer { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--border); font-size: 12px; color: var(--muted); }
  footer.audit-footer p { margin-bottom: 8px; }

  @media print {
    body { background: #fff; }
    .print-bar { display: none; }
    section { box-shadow: none; page-break-inside: avoid; border: 1px solid #ddd; }
    .audit-header, section { margin-top: 0; }
    a { color: var(--off-black); text-decoration: underline; }
  }

  @media (max-width: 600px) {
    .page { padding: 24px 16px 64px; }
    .doc-title { font-size: 24px; }
    section { padding: 24px 18px; }
    .nums-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<div class="page">

<div class="print-bar">
    <button class="print-btn" onclick="window.print()" type="button">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      Print as PDF
    </button>
  </div>

  <header class="audit-header">
    <div class="brand">RIK Athletica · Personal Fueling Audit</div>
    <h1 class="doc-title">Your fueling audit, ${escapeHtml(row.first_name ?? 'athlete')}</h1>
    <div class="meta">v${escapeHtml(engine.methodology_version ?? 'v3.1')} · ${row.delivered_at ? new Date(row.delivered_at).toISOString().split('T')[0] : ''} · For ${escapeHtml(answers.raceDistance ?? 'race')} · ${engine.inputs_summary?.weeks_out ?? '?'} weeks out</div>
  </header>

  <!-- ═══ PAGE 1: WHAT I NOTICED ═══ -->
  <section>
    <h2>Page 1 · What I noticed</h2>
    <h3>Reading your responses</h3>
    <p>${escapeHtml(drafts.what_i_noticed ?? '')}</p>
    <div class="citation-block">
      <strong>Methodology Reference</strong>
      Methodology reviewed by ${escapeHtml(RD_NAME)} (Commission on Dietetic Registration, USA). Numbers below come from the v3.1 protocol.
    </div>
  </section>

  <!-- ═══ PAGE 2: THE NUMBERS (Track A: RD-covered + Track B: RIK estimate) ═══ -->
  <section>
    <h2>Page 2 · The numbers</h2>
    <h3>Where your fueling stands today</h3>

    <div class="nums-grid">
      <div class="num-card">
        <div class="label">Race-day target (carbs)</div>
        <div class="value">${trackA.race_day_target_g_per_hr ?? '?'}<span class="unit">g/hr</span></div>
      </div>
      <div class="num-card">
        <div class="label">Your current estimate</div>
        <div class="value">${trackB.athlete_carbs_per_hour_estimate ?? '?'}<span class="unit">g/hr</span></div>
      </div>
      <div class="num-card">
        <div class="label">Sodium target (bike)</div>
        <div class="value">${trackA.sodium_bike_mg_per_hr ?? '?'}<span class="unit">mg/hr</span></div>
      </div>
      <div class="num-card">
        <div class="label">Bike fluid target</div>
        <div class="value">${trackA.bike_fluid_ml_per_hr ?? '?'}<span class="unit">mL/hr</span></div>
      </div>
    </div>

    ${trackB.carb_deficit_g_per_hour > 0 ? `
    <div class="disclaimer-block">
      <strong>RIK estimate — not RD-validated</strong>
      Based on your ${trackB.carb_deficit_g_per_hour} g/hr carb deficit and a typical ${trackB.race_duration_hr_typical}-hour race for your distance, you may be giving up roughly <strong>${trackB.minutes_lost_estimate.lo}–${trackB.minutes_lost_estimate.hi} minutes</strong> on race day from fueling alone. This is RIK's interpretation drawn from pacing literature and field observations — it's directional, not clinical.
    </div>
    ` : `<p>Your current intake is close to the race-day target. The remaining work is delivery vehicle, sodium, and timing.</p>`}

    <h3 style="margin-top:24px">Gut training progression</h3>
    <p>If you take on the recommended program, your weekly carb ceilings would look like this:</p>
    <table class="gut-table">
      <thead><tr><th>Week</th><th>Phase</th><th>Carb ceiling</th><th>Vehicle</th></tr></thead>
      <tbody>
        ${Object.entries(GUT_WEEK_CEILINGS).map(([wk, v]) => `
          <tr><td>${wk}</td><td>${v.phase}</td><td><strong>${v.ceiling} g/hr</strong></td><td>${v.vehicle}</td></tr>
        `).join('')}
      </tbody>
    </table>
  </section>

  <!-- ═══ PAGE 3: WHY THIS TIER ═══ -->
  <section>
    <h2>Page 3 · The fit</h2>
    <h3>Why <em>${escapeHtml(tier.label)}</em> is the right next step</h3>
    <p>${escapeHtml(drafts.why_this_tier ?? '')}</p>
    <a href="${escapeHtml(cta.href)}?utm_source=audit&utm_medium=email&utm_campaign=${escapeHtml(tier.tier)}" class="cta green">${escapeHtml(cta.label)} →</a>
  </section>

  <!-- ═══ PAGE 4: YOUR SPECIFIC QUESTION + TOP ACTIONS ═══ -->
  <section>
    <h2>Page 4 · Your question + next steps</h2>
    <h3>On what you asked</h3>
    <p>${escapeHtml(drafts.specific_question_answer ?? '')}</p>

    <h3 style="margin-top:24px">Top 3 things to do this week</h3>
    <ol class="actions-list">
      ${(engine.top_actions ?? []).map((a) => `
        <li>
          <div class="num">Action ${a.priority}</div>
          <div class="title">${escapeHtml(a.title)}</div>
          <div class="detail">${escapeHtml(a.detail)}</div>
        </li>
      `).join('')}
    </ol>

    <div class="citation-block">
      <strong>Supporting research</strong>
      <ul>
        ${CITATIONS.slice(0, 3).map(c => `<li>${escapeHtml(c.ref)} — ${escapeHtml(c.supports)}</li>`).join('')}
      </ul>
    </div>
  </section>

  <footer class="audit-footer">
    <p><strong>Disclaimer.</strong> This audit is a personalized educational fueling overview — not medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before starting any new nutrition plan. Individual results vary based on training history, environmental conditions, and many other factors.</p>
    <p>Reply to your delivery email if anything's off — Bek reads every reply.</p>
    <p>© 2026 RIK Athletic Nutrition Inc. · v${escapeHtml(engine.methodology_version ?? 'v3.1')} · audit ${escapeHtml(row.slug ?? '')}</p>
  </footer>

</div>
</body>
</html>`;
}
