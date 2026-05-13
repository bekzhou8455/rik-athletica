// RIK Audit — Shared HTML renderer (iter-5 LOCKED).
// Produces the full /a/[slug] page from db row → HTML string.
// Design system: see /Users/bekzhou/Documents/Claude Code - Gstack/.claude/worktrees/confident-jones-80753d/DESIGN.md
//
// Design rules in force:
// - Outfit single family with tabular-nums on stats
// - Warm-gray + ink palette, no green
// - Period-stacked headlines, capital "You", em-dash bridges, en-dash ranges, curly quotes
// - Dashed dividers, asymmetric layouts, pill+circle CTAs
// - Lean RD note (no headshot) per founder revision 2026-05-13
//
// Compliance hooks:
// - §1.1 verbatim citation form
// - §2 FTC disclosure adjacent to citation
// - §4.3 scope clarification verbatim
// - §1.6(f) link to full statement
// - Track A/B/C separation (RD-validated / RIK estimate / published literature)

import { GUT_WEEK_CEILINGS, RD_NAME, CITATIONS, RISK_PATTERN_CITATIONS } from './methodology.js';

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

// Build SVG paths for the Two Futures Timeline.
// Returns { greenPath, redPath, gapPath, intakePips, phasesGrid }.
function buildTimelinePaths(phases, raceDurationHr) {
  const totalHr = phases.swim + phases.t1 + phases.bike + phases.t2 + phases.run;
  if (totalHr === 0) {
    // Marathon-only or run-only — single phase
    const runFlex = (phases.run || 1);
    return {
      phasesHtml: `<div class="phase" style="flex:${runFlex}">Run<span>${formatHM(runFlex)}</span></div>`,
      // Lines drawn the same — engine deficit shapes them
    };
  }

  // Cumulative phase widths as flex values
  const phasesHtml = `
    ${phases.swim > 0 ? `<div class="phase" style="flex:${phases.swim}">Swim<span>${formatHM(phases.swim)}</span></div>` : ''}
    ${phases.t1 > 0 ? `<div class="phase" style="flex:${phases.t1}">T1</div>` : ''}
    ${phases.bike > 0 ? `<div class="phase" style="flex:${phases.bike}">Bike<span>${formatHM(phases.bike)}</span></div>` : ''}
    ${phases.t2 > 0 ? `<div class="phase" style="flex:${phases.t2}">T2</div>` : ''}
    ${phases.run > 0 ? `<div class="phase" style="flex:${phases.run}">Run<span>${formatHM(phases.run)}</span></div>` : ''}
  `;

  return { phasesHtml, totalHr };
}

function formatHM(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function formatNumber(n, decimals = 0) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatPhaseDurationLabel(distance, totalHr) {
  const h = Math.floor(totalHr);
  const m = Math.round((totalHr - h) * 60);
  return `${h}h ${m}m`;
}

// Renders the race-day skeleton table rows
function renderSkeletonRows(steps, includeFluid = true) {
  return steps.map(s => {
    const fluid = s.fluid_ml != null ? `${s.fluid_ml} mL` : '—';
    const na = s.na_mg != null ? `${formatNumber(s.na_mg)} mg` : '—';
    const cells = includeFluid
      ? `<td>${escapeHtml(s.time)}</td><td class="action">${escapeHtml(s.action)}</td><td class="highlight">${s.cho_g} g</td><td>${na}</td><td>${fluid}</td>`
      : `<td>${escapeHtml(s.time)}</td><td class="action">${escapeHtml(s.action)}</td><td class="highlight">${s.cho_g} g</td><td>${na}</td>`;
    return `<tr>${cells}</tr>`;
  }).join('');
}

// Build the timeline SVG with athlete-specific deficit shaping
function buildTimelineSVG(deficit, raceDurationHr) {
  // The redline collapse depth is proportional to the deficit
  // Max collapse ~ y=194 at deficit 50+, baseline at y=55 (no deficit)
  const collapseDepth = Math.min(140, deficit * 3.5);
  const greenY = 55 + Math.min(15, deficit * 0.15); // Slight droop even on optimized
  const redEndY = 55 + collapseDepth;
  const redMidY = 55 + collapseDepth * 0.6;

  return `<svg class="timeline-svg" viewBox="0 0 700 220" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Race timeline showing two fueling scenarios">
    <line x1="0" y1="40" x2="700" y2="40" stroke="rgba(14,14,14,0.06)" stroke-width="0.5"/>
    <line x1="0" y1="100" x2="700" y2="100" stroke="rgba(14,14,14,0.06)" stroke-width="0.5"/>
    <line x1="0" y1="160" x2="700" y2="160" stroke="rgba(14,14,14,0.06)" stroke-width="0.5"/>
    <text x="0" y="36" fill="#8A8780" font-size="10" font-family="Outfit" font-weight="500">Sustainable</text>
    <text x="0" y="196" fill="#8A8780" font-size="10" font-family="Outfit" font-weight="500">Depleted</text>
    <line x1="110" y1="20" x2="110" y2="200" stroke="rgba(14,14,14,0.12)" stroke-dasharray="3,4"/>
    <line x1="130" y1="20" x2="130" y2="200" stroke="rgba(14,14,14,0.12)" stroke-dasharray="3,4"/>
    <line x1="410" y1="20" x2="410" y2="200" stroke="rgba(14,14,14,0.12)" stroke-dasharray="3,4"/>
    <line x1="430" y1="20" x2="430" y2="200" stroke="rgba(14,14,14,0.12)" stroke-dasharray="3,4"/>
    <rect x="0" y="155" width="700" height="55" fill="#c98b5a" opacity="0.12" rx="4"/>
    <path d="M 0,55 C 50,55 100,52 130,${greenY} C 160,${greenY} 200,${greenY-2} 280,${greenY} C 340,${greenY+2} 380,${greenY+4} 410,${greenY+2} C 430,${greenY} 480,${greenY+4} 530,${greenY+6} C 580,${greenY+8} 630,${greenY+10} 700,${greenY+12}"
          stroke="#0E0E0E" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <path d="M 0,55 C 50,55 100,55 130,57 C 160,60 200,68 280,${(redMidY*0.5)+45} C 340,${redMidY+10} 380,${redMidY+28} 410,${redEndY-10} C 430,${redEndY-5} 480,${redEndY+5} 530,${redEndY+10} C 580,${redEndY+15} 630,${redEndY+18} 700,${redEndY+20}"
          stroke="#c98b5a" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <circle cx="180" cy="${greenY-2}" r="3" fill="#0E0E0E"/>
    <circle cx="250" cy="${greenY-1}" r="3" fill="#0E0E0E"/>
    <circle cx="330" cy="${greenY+1}" r="3" fill="#0E0E0E"/>
    <circle cx="460" cy="${greenY+3}" r="3" fill="#0E0E0E"/>
    <circle cx="540" cy="${greenY+6}" r="3" fill="#0E0E0E"/>
    <circle cx="620" cy="${greenY+9}" r="3" fill="#0E0E0E"/>
  </svg>`;
}

export function renderAuditPage(row) {
  const drafts = row.drafts_final ?? row.drafts ?? {};
  const engine = row.engine ?? {};
  const answers = row.answers ?? {};
  const tier = engine.tier_recommendation ?? { tier: 'sprint', label: 'Sprint', explanation: '' };
  const trackA = engine.track_a ?? {};
  const trackB = engine.track_b ?? {};
  const trackC = engine.track_c ?? {};
  const skeleton = engine.race_day_skeleton ?? { pre_race: [], bike: [], run: [], totals: {} };
  const riskPattern = trackC.risk_pattern ?? {};
  const cta = tierCta(tier.tier);
  const firstName = row.first_name ?? answers.firstName ?? 'athlete';
  const slug = row.slug ?? '';
  const deliveredDate = row.delivered_at ? new Date(row.delivered_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const distanceLabel = answers.raceDistance === '70.3' ? 'IRONMAN 70.3'
    : answers.raceDistance === 'full' ? 'Full IRONMAN'
    : answers.raceDistance === 'olympic' ? 'Olympic Triathlon'
    : answers.raceDistance === 'marathon' ? 'Marathon'
    : answers.raceDistance === 'ultra' ? 'Ultra'
    : 'Race';
  const phases = trackA.race_phase_durations_hr ?? { swim: 0.63, t1: 0.05, bike: 2.75, t2: 0.05, run: 1.75 };
  const totalHr = phases.swim + phases.t1 + phases.bike + phases.t2 + phases.run;
  const { phasesHtml } = buildTimelinePaths(phases, trackB.race_duration_hr_typical);
  const timelineSvg = buildTimelineSVG(trackB.carb_deficit_g_per_hour ?? 0, trackB.race_duration_hr_typical ?? 5);
  const minutesLost = trackB.minutes_lost_estimate ?? { lo: 0, hi: 0 };
  const minutesLostMid = Math.round(((minutesLost.lo ?? 0) + (minutesLost.hi ?? 0)) / 2);

  // Risk window position on the heatmap (% from left)
  const riskWindowPct = riskPattern.window_early_hr && trackB.race_duration_hr_typical
    ? Math.min(92, Math.max(8, (riskPattern.window_early_hr / trackB.race_duration_hr_typical) * 100))
    : 58;

  const coachName = answers.coachName?.trim() ? escapeHtml(answers.coachName.trim()) : null;
  const siteOrigin = (typeof process !== 'undefined' && process.env?.SITE_ORIGIN) || 'https://www.rikathletica.com';
  const tierUrl = `${escapeHtml(cta.href)}?utm_source=audit&utm_medium=audit_page&utm_campaign=${escapeHtml(tier.tier)}&ref=${escapeHtml(slug)}`;
  const auditUrl = `${siteOrigin}/a/${escapeHtml(slug)}`;
  const refUrl = `${siteOrigin}/audit?ref=${escapeHtml(slug)}`;

  // OG metadata — Track A only, no individual predictions in the OG description
  const ogTitle = `${escapeHtml(firstName)}'s Fueling Audit. ${escapeHtml(distanceLabel)}.`;
  const ogDescription = `Race-day target: ${trackA.race_day_target_g_per_hr} g/hr. Methodology v3.1.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(firstName)}'s Fueling Audit. — RIK Athletica</title>
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${ogDescription}">
<meta property="og:type" content="article">
<meta property="og:url" content="${auditUrl}">
<meta property="og:site_name" content="RIK Athletica">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${ogTitle}">
<meta name="twitter:description" content="${ogDescription}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #EEEDEA; --bg-2: #D5D2CC; --bg-sand: #C4B59E;
  --ink: #0E0E0E; --ink-soft: #5A5853; --ink-dim: #8A8780;
  --rule: rgba(14,14,14,.18); --rule-soft: rgba(14,14,14,.10);
  --warm-img: linear-gradient(135deg, #7a4a2a, #c98b5a 50%, #3a2418);
  --warm-amber: #c98b5a; --warm-deep: #7a4a2a;
  --doc-w: 920px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { font-family: 'Outfit', -apple-system, 'Helvetica Neue', Arial, sans-serif; font-weight: 400; background: var(--bg); color: var(--ink); -webkit-font-smoothing: antialiased; line-height: 1.55; padding: 48px 24px 96px; font-feature-settings: "kern" 1, "liga" 1; }
em { font-style: italic; color: var(--ink-soft); }

.document { max-width: var(--doc-w); margin: 0 auto; background: #fff; border: 1px solid var(--rule-soft); box-shadow: 0 12px 48px rgba(14,14,14,.06), 0 1px 0 rgba(14,14,14,.02); overflow: hidden; }

.doc-cover { padding: 72px 80px 56px; border-bottom: 1px dashed var(--rule); }
.doc-cover .brand-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-soft); font-weight: 600; }
.doc-cover .brand-row .meta { color: var(--ink-dim); letter-spacing: 0.08em; font-variant-numeric: tabular-nums; }
.doc-cover h1 { font-size: clamp(40px, 6vw, 64px); font-weight: 700; letter-spacing: -0.025em; line-height: 1.02; margin-top: 56px; }
.doc-cover .athlete-name { color: var(--warm-deep); }
.doc-cover .sub { font-size: 15px; color: var(--ink-soft); margin-top: 20px; max-width: 54ch; }
.doc-cover .cover-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 56px; margin-top: 48px; padding: 22px 0; border-top: 1px dashed var(--rule); border-bottom: 1px dashed var(--rule); }
.doc-cover .cover-meta div { padding: 0; }
.doc-cover .cover-meta .lbl { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-dim); font-weight: 600; }
.doc-cover .cover-meta .val { font-size: 18px; font-weight: 600; margin-top: 8px; color: var(--ink); font-variant-numeric: tabular-nums; letter-spacing: -0.005em; }

.page-block { padding: 56px 80px 64px; border-bottom: 1px dashed var(--rule); }
.page-block:last-of-type { border-bottom: none; }

.page-hdr { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 12px; margin-bottom: 32px; border-bottom: 1px solid var(--rule-soft); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600; color: var(--ink-soft); }
.page-hdr .num { color: var(--ink-dim); font-variant-numeric: tabular-nums; letter-spacing: 0.08em; }

.page-block h2 { font-size: clamp(28px, 3.6vw, 40px); font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
.page-block .lead { font-size: 16px; color: var(--ink-soft); margin-top: 14px; max-width: 58ch; line-height: 1.6; }
.page-block p { font-size: 15px; line-height: 1.65; color: var(--ink); }
.page-block p + p { margin-top: 14px; }
.source-footnote { font-size: 11px; color: var(--ink-dim); font-style: italic; margin-top: 16px; line-height: 1.5; }

/* Timeline */
.timeline-wrap { margin-top: 32px; padding: 28px 28px 20px; background: var(--bg); border-radius: 10px; border: 1px solid var(--rule-soft); }
.timeline-phases { display: flex; margin-bottom: 6px; }
.timeline-phases .phase { font-size: 10px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-dim); padding: 4px 0; }
.timeline-phases .phase span { color: var(--ink-soft); margin-left: 6px; font-variant-numeric: tabular-nums; }
.timeline-svg { width: 100%; height: 220px; display: block; }
.timeline-delta { margin-top: 20px; padding: 16px 22px; background: #fff; border: 1px dashed var(--rule); border-radius: 10px; display: inline-flex; align-items: baseline; gap: 16px; }
.timeline-delta .num { font-size: clamp(28px, 3.4vw, 40px); font-weight: 700; letter-spacing: -0.025em; font-variant-numeric: tabular-nums; line-height: 1; }
.timeline-delta .lbl { font-size: 13px; color: var(--ink-soft); line-height: 1.4; }
.timeline-legend { margin-top: 20px; display: flex; gap: 28px; flex-wrap: wrap; font-size: 12px; color: var(--ink-soft); }
.timeline-legend .swatch { display: inline-block; width: 22px; height: 2.5px; margin-right: 8px; vertical-align: middle; border-radius: 2px; }

/* Stats Row */
.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 36px; border-top: 1px dashed var(--rule); border-bottom: 1px dashed var(--rule); }
.stats-row .stat { padding: 28px 24px 28px 0; border-right: 1px dashed var(--rule); }
.stats-row .stat:last-child { border-right: none; padding-right: 0; }
.stats-row .stat:not(:first-child) { padding-left: 24px; }
.stats-row .stat-num { font-size: clamp(36px, 4.4vw, 52px); font-weight: 700; letter-spacing: -0.025em; line-height: 1; font-variant-numeric: tabular-nums; }
.stats-row .stat-num sup { font-size: 0.42em; font-weight: 500; color: var(--ink-soft); margin-left: 4px; vertical-align: super; }
.stats-row .stat-label { font-size: 14px; color: var(--ink); margin-top: 12px; font-weight: 500; }
.stats-row .stat-cite { font-size: 11px; color: var(--ink-dim); font-style: italic; margin-top: 6px; line-height: 1.4; }

/* Warm callout (Risk Window) */
.callout-warm { background: var(--warm-img); color: #fff; border-radius: 12px; padding: 36px 40px; margin-top: 32px; }
.callout-warm .co-eyebrow { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600; color: rgba(255,255,255,.65); }
.callout-warm h3 { font-size: clamp(24px, 2.8vw, 30px); font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; margin-top: 8px; color: #fff; }
.callout-warm .co-lead { font-size: 14px; color: rgba(255,255,255,.82); margin-top: 12px; max-width: 56ch; line-height: 1.55; }
.heatmap-wrap { margin-top: 28px; }
.heatmap-labels { display: flex; justify-content: space-between; font-size: 10px; color: rgba(255,255,255,.7); margin-bottom: 6px; font-variant-numeric: tabular-nums; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; }
.heatmap-bar { height: 44px; border-radius: 8px; position: relative; background: linear-gradient(90deg, #EEEDEA 0%, #d5c5a8 35%, #c98b5a 60%, #7a4a2a 100%); box-shadow: 0 2px 12px rgba(0,0,0,.18); }
.heatmap-bar .risk-marker { position: absolute; top: -8px; bottom: -8px; width: 2px; background: #fff; box-shadow: 0 0 8px rgba(255,255,255,.5); }
.risk-marker .risk-label { position: absolute; top: -34px; transform: translateX(-50%); background: var(--ink); color: #fff; font-size: 10px; padding: 5px 12px; border-radius: 5px; white-space: nowrap; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; font-variant-numeric: tabular-nums; }
.risk-marker .risk-label::after { content: ''; position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 4px solid var(--ink); }
.heatmap-zones { display: flex; margin-top: 12px; gap: 0; }
.heatmap-zones .zone { padding: 8px 14px 8px 0; border-right: 1px dashed rgba(255,255,255,.18); color: rgba(255,255,255,.85); }
.heatmap-zones .zone:not(:first-child) { padding-left: 14px; }
.heatmap-zones .zone:last-child { border-right: none; padding-right: 0; }
.heatmap-zones .zone strong { display: block; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 3px; font-weight: 600; }
.heatmap-zones .zone p { font-size: 12px; line-height: 1.45; color: rgba(255,255,255,.7); }
.risk-patterns { margin-top: 24px; padding-top: 20px; border-top: 1px dashed rgba(255,255,255,.2); }
.risk-patterns h4 { font-size: 12px; font-weight: 600; color: #fff; letter-spacing: 0.04em; margin-bottom: 12px; }
.risk-patterns ul { padding-left: 18px; }
.risk-patterns li { font-size: 13px; color: rgba(255,255,255,.78); margin-bottom: 6px; line-height: 1.5; }
.risk-patterns li strong { color: #fff; font-weight: 600; }
.risk-patterns .cite { font-size: 10.5px; color: rgba(255,255,255,.5); margin-top: 12px; font-style: italic; line-height: 1.5; }

/* Race Card (dark exception) */
.race-card { background: var(--ink); color: #fff; border-radius: 12px; padding: 32px 36px; margin-top: 32px; }
.race-card .card-eyebrow { font-size: 10px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,.5); }
.race-card .card-title { font-size: clamp(20px, 2.2vw, 26px); font-weight: 700; margin-top: 6px; letter-spacing: -0.015em; }
.race-card .card-meta { font-size: 12px; color: rgba(255,255,255,.6); margin-top: 4px; font-variant-numeric: tabular-nums; }
.card-section { margin-top: 24px; }
.card-section-title { font-size: 10px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,.55); padding-bottom: 6px; border-bottom: 1px dashed rgba(255,255,255,.15); display: flex; align-items: center; gap: 8px; }
.card-section-title .pip { width: 5px; height: 5px; border-radius: 999px; background: var(--warm-amber); }
.card-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
.card-table th { font-size: 9px; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,.42); text-align: left; padding: 6px 8px 6px 0; }
.card-table td { padding: 6px 8px 6px 0; border-bottom: 1px dashed rgba(255,255,255,.08); font-size: 12.5px; color: rgba(255,255,255,.85); font-variant-numeric: tabular-nums; }
.card-table td.highlight { color: var(--warm-amber); font-weight: 600; }
.card-table td.action { color: #fff; font-variant-numeric: normal; }
.card-totals { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 24px; border-top: 1px dashed rgba(255,255,255,.15); border-bottom: 1px dashed rgba(255,255,255,.15); }
.card-totals .t { padding: 16px 14px 16px 0; border-right: 1px dashed rgba(255,255,255,.15); }
.card-totals .t:not(:first-child) { padding-left: 14px; }
.card-totals .t:last-child { border-right: none; padding-right: 0; }
.card-totals .t-num { font-size: 22px; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.card-totals .t-lbl { font-size: 10px; color: rgba(255,255,255,.5); letter-spacing: 0.16em; text-transform: uppercase; margin-top: 5px; font-weight: 500; }
.card-footer-note { margin-top: 18px; font-size: 10.5px; color: rgba(255,255,255,.45); font-style: italic; line-height: 1.55; }
.card-actions { margin-top: 22px; display: flex; gap: 12px; flex-wrap: wrap; }

/* CTA */
.cta { display: inline-flex; align-items: stretch; gap: 6px; text-decoration: none; color: inherit; cursor: pointer; border: none; background: none; font-family: inherit; padding: 0; }
.cta .pill { background: var(--ink); color: #fff; padding: 10px 18px; border-radius: 999px; font-size: 13px; font-weight: 500; border: 1px solid var(--ink); display: inline-flex; align-items: center; }
.cta .arrow { width: 34px; height: 34px; border: 1px solid var(--ink); background: #fff; color: var(--ink); border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; line-height: 1; transition: transform 150ms ease; }
.cta:hover .arrow { transform: translateY(-1px); }
.cta.ghost .pill { background: transparent; color: var(--ink); }
.race-card .cta .pill { background: #fff; color: var(--ink); border-color: #fff; }
.race-card .cta .arrow { background: transparent; color: #fff; border-color: rgba(255,255,255,.4); }
.race-card .cta.ghost .pill { background: transparent; color: #fff; border-color: rgba(255,255,255,.3); }

/* Tier CTA inside content */
.tier-cta-block { margin-top: 28px; padding: 24px 28px; background: var(--bg); border-radius: 10px; }
.tier-cta-block .tier-headline { font-size: 14px; font-weight: 600; color: var(--ink); margin-bottom: 12px; }
.tier-cta-block .tier-explanation { font-size: 14px; color: var(--ink-soft); line-height: 1.6; margin-bottom: 18px; max-width: 56ch; }

/* Founder Note */
.founder-note { margin-top: 36px; padding: 28px 32px; background: var(--bg); border-left: 3px solid var(--ink); border-radius: 0 8px 8px 0; }
.founder-note .eyebrow { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-soft); font-weight: 600; }
.founder-note blockquote { font-size: 17px; font-weight: 400; line-height: 1.55; color: var(--ink); margin: 10px 0 16px; letter-spacing: -0.005em; }
.founder-note .sig { font-size: 13px; color: var(--ink-soft); font-weight: 500; }

/* Lean RD Note */
.rd-note { margin-top: 36px; padding: 24px 28px; background: var(--bg); border: 1px solid var(--rule); border-radius: 8px; }
.rd-note .rd-eyebrow { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 600; color: var(--ink-soft); margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px dashed var(--rule); }
.rd-note .rd-citation { font-size: 14.5px; font-weight: 500; line-height: 1.55; color: var(--ink); letter-spacing: -0.005em; }
.rd-note .rd-scope-tag { display: inline-block; margin-top: 10px; padding: 3px 10px; background: var(--ink); color: #fff; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; border-radius: 999px; }
.rd-note .rd-detail { font-size: 13px; color: var(--ink-soft); line-height: 1.6; margin-top: 14px; }
.rd-note .rd-ftc { font-size: 11.5px; color: var(--ink-dim); line-height: 1.55; margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--rule); font-style: italic; }
.rd-note .rd-link { display: inline-block; margin-top: 12px; font-size: 12.5px; color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--ink); padding-bottom: 1px; }
.rd-note .rd-link:hover { color: var(--warm-deep); border-color: var(--warm-deep); }

/* Share Builder */
.share-builder { margin-top: 36px; padding: 36px 36px 32px; background: var(--bg); border-radius: 14px; border: 1px solid var(--rule-soft); }
.share-builder-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
.input-label { display: block; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-soft); font-weight: 600; margin-bottom: 10px; }
.share-input { width: 100%; font-family: inherit; font-size: 22px; font-weight: 600; letter-spacing: -0.01em; color: var(--ink); background: #fff; border: 1px solid var(--rule); border-radius: 10px; padding: 14px 18px; outline: none; transition: border-color 150ms ease, box-shadow 150ms ease; }
.share-input:focus { border-color: var(--ink); box-shadow: 0 0 0 3px rgba(14,14,14,.08); }
.share-input::placeholder { color: var(--ink-dim); font-weight: 500; }
.share-hint { font-size: 12px; color: var(--ink-soft); margin-top: 10px; line-height: 1.5; }
.share-actions { margin-top: 24px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.share-actions .cta { width: 100%; max-width: 340px; }
.share-actions .cta .pill { flex: 1; justify-content: center; padding: 14px 22px; font-size: 14px; font-weight: 600; }
.share-actions .cta .arrow { width: 46px; height: 46px; }
.share-actions .cta.share-cta-tertiary .pill { background: transparent; color: var(--ink-soft); border: 1px dashed var(--rule); font-weight: 500; }
.share-actions .cta.share-cta-tertiary .arrow { border-color: var(--rule); color: var(--ink-soft); }
.preview-label { display: block; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-soft); font-weight: 600; margin-bottom: 10px; }
.phone-frame { background: #f0f0f4; border: 1px solid rgba(14,14,14,.12); border-radius: 22px; padding: 14px 14px 18px; box-shadow: 0 8px 28px rgba(14,14,14,.08), inset 0 0 0 4px #fff; overflow: hidden; }
.phone-statusbar { display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: var(--ink); padding: 4px 8px 8px; font-variant-numeric: tabular-nums; }
.phone-header { text-align: center; padding: 10px 0 14px; border-bottom: 1px solid rgba(14,14,14,.06); margin-bottom: 16px; }
.phone-header .contact-name { display: block; font-size: 14px; font-weight: 600; color: var(--ink); }
.phone-header .contact-status { display: block; font-size: 10px; color: var(--ink-dim); margin-top: 2px; letter-spacing: 0.04em; }
.phone-body { min-height: 280px; padding: 4px 4px 0; }
.bubble { max-width: 90%; padding: 10px 14px; border-radius: 18px; font-size: 13px; line-height: 1.45; margin-bottom: 4px; }
.bubble-out { background: #007AFF; color: #fff; margin-left: auto; border-bottom-right-radius: 4px; }
.bubble p { font-size: 13px !important; color: #fff !important; line-height: 1.45 !important; margin-bottom: 8px !important; }
.bubble p:last-child { margin-bottom: 0 !important; }
.bubble .recipient-name { font-weight: 700; }
.link-preview { background: rgba(255,255,255,.18); border-radius: 10px; overflow: hidden; margin-top: 4px; }
.lp-image { height: 100px; background: linear-gradient(135deg, #1a1a1a 0%, #0E0E0E 100%); position: relative; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,.95); text-align: center; padding: 12px; }
.lp-image::before { content: ''; position: absolute; top: 0; right: -30%; width: 200px; height: 100%; background: radial-gradient(circle, rgba(201,139,90,.35), transparent 70%); }
.lp-image-content { position: relative; z-index: 1; }
.lp-image-content .lp-num { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums; }
.lp-image-content .lp-num sup { font-size: 0.45em; font-weight: 500; color: rgba(255,255,255,.7); margin-left: 3px; }
.lp-image-content .lp-num-label { font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,.65); margin-top: 3px; font-weight: 600; }
.lp-meta { padding: 8px 12px 10px; background: rgba(255,255,255,.95); color: var(--ink); }
.lp-meta .lp-title { font-size: 11px; font-weight: 600; line-height: 1.35; color: var(--ink); }
.lp-meta .lp-domain { font-size: 10px; color: var(--ink-dim); margin-top: 2px; letter-spacing: 0.02em; }
.bubble-status { text-align: right; font-size: 10px; color: var(--ink-dim); margin-top: 4px; padding-right: 4px; letter-spacing: 0.04em; }
.share-social-proof { margin-top: 32px; padding-top: 20px; border-top: 1px dashed var(--rule); text-align: center; font-size: 12px; color: var(--ink-soft); letter-spacing: 0.06em; }
.share-social-proof strong { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
.share-social-proof .dot { color: var(--warm-amber); margin: 0 12px; font-weight: 700; }
.copy-toast { position: fixed; bottom: 90px; right: 24px; background: var(--ink); color: #fff; padding: 12px 22px; border-radius: 999px; font-size: 13px; font-weight: 500; box-shadow: 0 8px 24px rgba(14,14,14,.2); opacity: 0; transform: translateY(8px); transition: opacity 200ms ease, transform 200ms ease; pointer-events: none; z-index: 200; }
.copy-toast.show { opacity: 1; transform: translateY(0); }

/* Document Footer */
.doc-footer { padding: 36px 80px 40px; background: var(--ink); color: rgba(255,255,255,.7); }
.doc-footer p { font-size: 12px; line-height: 1.6; margin-bottom: 12px; max-width: 64ch; }
.doc-footer p strong { color: #fff; font-weight: 600; }
.doc-footer .meta-line { color: rgba(255,255,255,.4); font-size: 10.5px; letter-spacing: 0.06em; margin-top: 18px; padding-top: 16px; border-top: 1px dashed rgba(255,255,255,.18); font-variant-numeric: tabular-nums; }

/* Sticky Print CTA */
.sticky-cta { position: fixed; bottom: 24px; right: 24px; z-index: 100; }
.sticky-cta .pill { padding: 11px 18px; font-size: 13px; }
.sticky-cta .arrow { width: 38px; height: 38px; }

/* Top actions list */
.actions-list { margin: 16px 0; padding: 0; list-style: none; }
.actions-list li { padding: 18px 22px; background: var(--bg); border-radius: 10px; margin-bottom: 8px; }
.actions-list .num { font-size: 10px; color: var(--ink-soft); font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; }
.actions-list .title { font-weight: 600; margin: 4px 0 6px; font-size: 16px; color: var(--ink); }
.actions-list .detail { font-size: 14px; color: var(--ink-soft); line-height: 1.55; }

@media (max-width: 720px) {
  body { padding: 24px 16px 64px; }
  .doc-cover { padding: 48px 32px 40px; }
  .doc-cover h1 { margin-top: 36px; }
  .doc-cover .cover-meta { grid-template-columns: repeat(2, 1fr); gap: 32px; }
  .page-block { padding: 40px 32px 48px; }
  .stats-row { grid-template-columns: 1fr; }
  .stats-row .stat { border-right: none; border-bottom: 1px dashed var(--rule); padding-left: 0 !important; }
  .stats-row .stat:last-child { border-bottom: none; }
  .callout-warm { padding: 28px 24px; }
  .race-card { padding: 24px 22px; }
  .card-totals { grid-template-columns: 1fr; }
  .card-totals .t { border-right: none; border-bottom: 1px dashed rgba(255,255,255,.15); padding-left: 0 !important; }
  .card-totals .t:last-child { border-bottom: none; }
  .rd-note { padding: 20px 22px; }
  .share-builder { padding: 24px 20px 22px; }
  .share-builder-grid { grid-template-columns: 1fr; gap: 32px; }
  .share-input { font-size: 18px; padding: 12px 16px; }
  .share-actions .cta { max-width: 100%; }
  .doc-footer { padding: 28px 32px 32px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}

@media print {
  body { background: #fff; padding: 0; }
  .document { box-shadow: none; border: none; max-width: 100%; }
  .sticky-cta, .copy-toast, .share-builder { display: none; }
  .page-block { page-break-inside: avoid; }
}
</style>
</head>
<body>

<div class="document">

  <header class="doc-cover">
    <div class="brand-row">
      <span>RIK Athletica · Personal Fueling Audit</span>
      <span class="meta">${escapeHtml(engine.methodology_version ?? 'v3.1')} · ${escapeHtml(deliveredDate)}</span>
    </div>
    <h1>Your Fueling Audit, <span class="athlete-name">${escapeHtml(firstName)}.</span></h1>
    <p class="sub">A six-page read of where Your fueling stands, what it's costing You, and one example execution of Your race-day plan.</p>
    <div class="cover-meta">
      <div><div class="lbl">Race</div><div class="val">${escapeHtml(distanceLabel)}</div></div>
      <div><div class="lbl">Out</div><div class="val">${engine.inputs_summary?.weeks_out ?? '?'} weeks</div></div>
      <div><div class="lbl">Current</div><div class="val">${trackB.athlete_carbs_per_hour_estimate ?? '?'} g/hr</div></div>
      <div><div class="lbl">Target</div><div class="val">${trackA.race_day_target_g_per_hr ?? '?'} g/hr</div></div>
    </div>
  </header>

  <!-- ════ PAGE 01 — YOUR RACE ════ -->
  <article class="page-block">
    <div class="page-hdr">
      <span>Page 01 — Your Race</span>
      <span class="num">${escapeHtml(firstName)} · ${escapeHtml(distanceLabel)} · ${escapeHtml(engine.methodology_version ?? 'v3.1')}</span>
    </div>

    <h2>Your Race. Two Futures.</h2>
    <p class="lead">${escapeHtml(drafts.what_i_noticed ?? "With Your current fueling. With the audit's fueling. The gap is where Your minutes go.")}</p>

    <div class="timeline-wrap">
      <div class="timeline-phases">${phasesHtml}</div>
      ${timelineSvg}
      ${minutesLost.hi > 0 ? `
      <div class="timeline-delta">
        <div class="num">+${minutesLostMid}<span style="font-size:0.5em;color:var(--ink-soft);font-weight:500;margin-left:4px;">min</span></div>
        <div class="lbl">Recoverable from fueling alone.<br>Range: ${minutesLost.lo}–${minutesLost.hi} min.</div>
      </div>
      ` : `
      <div class="timeline-delta">
        <div class="num">On<span style="font-size:0.5em;color:var(--ink-soft);font-weight:500;margin-left:4px;">target</span></div>
        <div class="lbl">Your current intake matches the<br>race-day target. Focus shifts to delivery.</div>
      </div>
      `}
      <div class="timeline-legend">
        <span><span class="swatch" style="background:#0E0E0E;"></span>The audit's fueling — ${trackA.race_day_target_g_per_hr} g/hr</span>
        <span><span class="swatch" style="background:#c98b5a;"></span>Your current fueling — ${trackB.athlete_carbs_per_hour_estimate} g/hr</span>
      </div>
    </div>

    <p class="source-footnote">Time-loss model derived from Jeukendrup (2014) pacing literature, RIK extrapolation. Range reflects methodological uncertainty.</p>
  </article>

  <!-- ════ PAGE 02 — THE GAP ════ -->
  <article class="page-block">
    <div class="page-hdr">
      <span>Page 02 — The Gap</span>
      <span class="num">${escapeHtml(firstName)} · ${escapeHtml(distanceLabel)} · ${escapeHtml(engine.methodology_version ?? 'v3.1')}</span>
    </div>

    <h2>The Gap. In Three Numbers.</h2>
    <p class="lead">Where You stand. Where You need to be. What it costs You.</p>

    <div class="stats-row">
      <div class="stat">
        <div class="stat-num">${trackB.athlete_carbs_per_hour_estimate}<sup>g/hr</sup></div>
        <div class="stat-label">Your current intake</div>
        <div class="stat-cite">From Your form response</div>
      </div>
      <div class="stat">
        <div class="stat-num">${trackA.race_day_target_g_per_hr}<sup>g/hr</sup></div>
        <div class="stat-label">Race-day target</div>
        <div class="stat-cite">Methodology v3.1 §2.1 · Jeukendrup 2014</div>
      </div>
      <div class="stat">
        <div class="stat-num">${minutesLostMid}<sup>min</sup></div>
        <div class="stat-label">Recoverable on race day</div>
        <div class="stat-cite">RIK estimate · ${minutesLost.lo}–${minutesLost.hi} min range</div>
      </div>
    </div>

    <p style="margin-top: 28px;">The race-day target comes from methodology v3.1 — the carbohydrate intake range that supports sustained pace at Your distance. Your current intake sits ${trackB.carb_deficit_g_per_hour} g/hr ${trackB.carb_deficit_g_per_hour > 0 ? 'below' : 'at or above'} that target. The recoverable minutes estimate translates that gap into time, based on published pacing data for endurance events.</p>
  </article>

  <!-- ════ PAGE 03 — RISK WINDOW ════ -->
  <article class="page-block">
    <div class="page-hdr">
      <span>Page 03 — Risk Window</span>
      <span class="num">${escapeHtml(firstName)} · ${escapeHtml(distanceLabel)} · ${escapeHtml(engine.methodology_version ?? 'v3.1')}</span>
    </div>

    <h2>Where the Race Falls Apart.</h2>
    <p class="lead">At Your intake, ${riskPattern.band_label?.toLowerCase() ?? 'under-fueled'} athletes typically slow ${riskPattern.pace_drop_pct ?? '15–30%'} in the final 90 minutes. The window opens here.</p>

    <div class="callout-warm">
      <div class="co-eyebrow">The risk window</div>
      <h3>${escapeHtml(riskPattern.window_label ?? 'Hour Three. Hour Four. The Final Ninety.')}</h3>
      <p class="co-lead">Athletes at Your intake level typically break down in this stretch — pace drops, GI distress climbs, cognitive fog sets in.</p>

      <div class="heatmap-wrap">
        <div class="heatmap-labels">
          <span>Start</span>
          <span>Hr 1</span>
          <span>Hr 2</span>
          <span>Hr 3</span>
          <span>Hr 4</span>
          <span>Finish</span>
        </div>
        <div class="heatmap-bar">
          ${!riskPattern.beyond_race ? `
          <div class="risk-marker" style="left: ${riskWindowPct}%;">
            <div class="risk-label">${escapeHtml(riskPattern.window_label ?? 'Risk Window')}</div>
          </div>
          ` : ''}
        </div>
        <div class="heatmap-zones">
          <div class="zone" style="flex:2;"><strong>Sustained</strong><p>Glycogen and intake match pace.</p></div>
          <div class="zone" style="flex:1.5;"><strong>Closing</strong><p>Glycogen falling — gaps compounding.</p></div>
          <div class="zone" style="flex:2;"><strong>Risk window</strong><p>Under-fueled athletes break here.</p></div>
        </div>

        <div class="risk-patterns">
          <h4>What happens in the risk window</h4>
          <ul>
            <li><strong>Pace drop of ${riskPattern.pace_drop_pct ?? '15–30%'}</strong> in the final 10K (Stevens et al., <em>Sports Medicine</em> 2020)</li>
            <li><strong>GI distress spikes</strong> when athletes try to catch up on calories late (de Oliveira, <em>Sports Medicine</em> 2014)</li>
            <li><strong>Cognitive fog</strong> — decision-making slows, athletes miss aid stations (Meeusen, <em>Sports Medicine</em> 2013)</li>
            <li><strong>Cramping risk</strong> compounds with sodium debt from the bike (Del Coso 2016 — association documented, mechanism contested)</li>
          </ul>
          <div class="cite">Glycogen depletion modeling — Coyle et al., <em>J Appl Physiol</em> 1986; Rapoport, <em>PLoS Comput Biol</em> 2010. Individual response varies with intensity, training status, and race conditions.</div>
        </div>
      </div>
    </div>
  </article>

  <!-- ════ PAGE 04 — YOUR RACE CARD ════ -->
  <article class="page-block">
    <div class="page-hdr">
      <span>Page 04 — Your Race Card</span>
      <span class="num">${escapeHtml(firstName)} · ${escapeHtml(distanceLabel)} · ${escapeHtml(engine.methodology_version ?? 'v3.1')}</span>
    </div>

    <h2>Your Race Card. Print. Tape. Execute.</h2>
    <p class="lead">3.5″ × 2.5″ — sized for Your top tube. One example execution of Your race-day targets.</p>

    <div class="race-card">
      <div class="card-eyebrow">RIK Athletica · Race Card</div>
      <div class="card-title">${escapeHtml(firstName)}'s Race-Day Plan.</div>
      <div class="card-meta">${escapeHtml(distanceLabel)} · ${trackA.race_day_target_g_per_hr} g/hr target · ${escapeHtml(trackA.sodium_tier ?? 'SR2')} sodium${skeleton.gi_flagged ? ' · GI-flagged track' : ''}</div>

      ${skeleton.pre_race.length ? `
      <div class="card-section">
        <div class="card-section-title"><span class="pip"></span> Pre-race · 3 hr → start</div>
        <table class="card-table">
          <tr><th style="width:18%">Time</th><th>Action</th><th>CHO</th><th>Na</th><th>Fluid</th></tr>
          ${renderSkeletonRows(skeleton.pre_race, true)}
        </table>
      </div>
      ` : ''}

      ${skeleton.bike.length ? `
      <div class="card-section">
        <div class="card-section-title"><span class="pip"></span> Bike · ${formatHM(phases.bike)}</div>
        <table class="card-table">
          <tr><th>Time</th><th>Product</th><th>CHO</th><th>Na</th><th>Fluid</th></tr>
          ${renderSkeletonRows(skeleton.bike, true)}
        </table>
      </div>
      ` : ''}

      ${skeleton.run.length ? `
      <div class="card-section">
        <div class="card-section-title"><span class="pip"></span> Run · ${formatHM(phases.run)}</div>
        <table class="card-table">
          <tr><th>Aid</th><th>Action</th><th>CHO</th><th>Na</th></tr>
          ${renderSkeletonRows(skeleton.run, false)}
        </table>
      </div>
      ` : ''}

      <div class="card-totals">
        <div class="t"><div class="t-num">${formatNumber(skeleton.totals?.cho_g)} g</div><div class="t-lbl">Total CHO</div></div>
        <div class="t"><div class="t-num">${formatNumber(skeleton.totals?.na_mg)} mg</div><div class="t-lbl">Total Sodium</div></div>
        <div class="t"><div class="t-num">${formatNumber(skeleton.totals?.fluid_ml)} mL</div><div class="t-lbl">Total Fluid</div></div>
      </div>

      <p class="card-footer-note">Educational fueling framework based on methodology v3.1. Test all products and timing in training before race day. Individual responses vary. Not medical advice.†</p>

      <div class="card-actions">
        <button class="cta" onclick="window.print()" type="button">
          <span class="pill">Print Your Card</span>
          <span class="arrow">↗</span>
        </button>
      </div>
    </div>

    <div class="tier-cta-block">
      <div class="tier-headline">Why <em>${escapeHtml(tier.label)}</em> is the right next step</div>
      <p class="tier-explanation">${escapeHtml(drafts.why_this_tier ?? tier.explanation ?? '')}</p>
      <a class="cta" href="${tierUrl}">
        <span class="pill">${escapeHtml(cta.label)}</span>
        <span class="arrow">↗</span>
      </a>
    </div>
  </article>

  <!-- ════ PAGE 05 — TRUST & SOURCES ════ -->
  <article class="page-block">
    <div class="page-hdr">
      <span>Page 05 — Trust &amp; Sources</span>
      <span class="num">${escapeHtml(firstName)} · ${escapeHtml(distanceLabel)} · ${escapeHtml(engine.methodology_version ?? 'v3.1')}</span>
    </div>

    <h2>From the Founder.</h2>
    <p class="lead">${drafts.specific_question_answer ? escapeHtml(drafts.specific_question_answer) : "A short note on why this audit exists, and how the numbers above are sourced."}</p>

    <h3 style="margin-top: 28px; font-size: 16px; font-weight: 600; letter-spacing: 0.04em;">Top three things to do this week</h3>
    <ol class="actions-list">
      ${(engine.top_actions ?? []).map((a) => `
        <li>
          <div class="num">Action ${a.priority}</div>
          <div class="title">${escapeHtml(a.title)}</div>
          <div class="detail">${escapeHtml(a.detail)}</div>
        </li>
      `).join('')}
    </ol>

    <div class="founder-note">
      <span class="eyebrow">— From Bek</span>
      <blockquote>"I built this audit because too many athletes lose minutes they trained months to earn. The numbers above are the ones I wish someone had handed me before my first race. Reply if anything's off — I read every one."</blockquote>
      <div class="sig">Bek Zhou — Founder, RIK Athletica</div>
    </div>

    <div class="rd-note">
      <div class="rd-eyebrow">Independent Methodology Review</div>
      <p class="rd-citation">"Methodology reviewed by ${escapeHtml(RD_NAME)} — Commission on Dietetic Registration (USA), reg. #86117608, May 7, 2026."</p>
      <span class="rd-scope-tag">Methodology only</span>
      <p class="rd-detail">The review covers the methodology only — carbohydrate targets, sodium and hydration ranges, gut-adaptation protocols, caffeine timing, and race-week tapering rules. It does not constitute medical advice, individualized nutrition counseling, or a guarantee of performance. Reviewer did not evaluate the time-loss projection on Page 01, the risk-window estimate on Page 03, or the race-day skeleton on Page 04 — those are RIK-derived applications of published literature.</p>
      <p class="rd-ftc">Paid independent methodology review. RIK Athletica paid Reviewer a one-time fee for this review. The opinions expressed are Reviewer's own.</p>
      <a class="rd-link" href="/assets/docs/rd-review-statement.pdf">Read the full statement →</a>
    </div>
  </article>

  <!-- ════ PAGE 06 — PASS IT ON ════ -->
  <article class="page-block">
    <div class="page-hdr">
      <span>Page 06 — Pass it on</span>
      <span class="num">${escapeHtml(firstName)} · ${escapeHtml(distanceLabel)} · ${escapeHtml(engine.methodology_version ?? 'v3.1')}</span>
    </div>

    <h2>Send the Card. Save the Bonk.</h2>
    <p class="lead">Most athletes in Your training group are running the same math — and running it short. The card above is theirs to use too. Send it to one specific person.</p>

    <div class="share-builder">
      <div class="share-builder-grid">
        <div>
          <label class="input-label" for="recipient-name">Who's running the same race?</label>
          <input type="text" id="recipient-name" class="share-input" placeholder="First name" autocomplete="off" maxlength="24">
          <p class="share-hint">We'll personalize the message. Nothing sends until You hit copy.</p>

          <div class="share-actions">
            <button class="cta" type="button" id="copy-message-btn">
              <span class="pill">Copy Message + Link</span>
              <span class="arrow">↗</span>
            </button>
            ${coachName ? `
            <a class="cta share-cta-tertiary" href="mailto:?subject=Fueling%20audit%20%E2%80%94%20worth%20a%20look%3F&body=${encodeURIComponent(`Hi ${coachName},\n\nGot my fueling audited. Worth a look before our next session?\n\n${auditUrl}\n\n— ${firstName}`)}">
              <span class="pill">Forward to Coach ${coachName}</span>
              <span class="arrow">↗</span>
            </a>
            ` : ''}
          </div>
        </div>

        <div>
          <span class="preview-label">What they will see</span>
          <div class="phone-frame">
            <div class="phone-statusbar">
              <span>9:41</span>
              <span>•••• 5G</span>
            </div>
            <div class="phone-header">
              <span class="contact-name">Training partner</span>
              <span class="contact-status">iMessage · Active now</span>
            </div>
            <div class="phone-body">
              <div class="bubble bubble-out">
                <p>Hey <span class="recipient-name">there</span> — got my fueling audited. Worth 90 sec before Your race:</p>
                <div class="link-preview">
                  <div class="lp-image">
                    <div class="lp-image-content">
                      <div class="lp-num">${minutesLostMid > 0 ? `${minutesLostMid}<sup>min</sup>` : `${trackA.race_day_target_g_per_hr}<sup>g/hr</sup>`}</div>
                      <div class="lp-num-label">${minutesLostMid > 0 ? 'Recoverable' : 'Race target'}</div>
                    </div>
                  </div>
                  <div class="lp-meta">
                    <div class="lp-title">${escapeHtml(firstName)}'s Fueling Audit — ${escapeHtml(distanceLabel)}</div>
                    <div class="lp-domain">rikathletica.com/audit</div>
                  </div>
                </div>
              </div>
              <div class="bubble-status">Delivered</div>
            </div>
          </div>
        </div>
      </div>

      <div class="share-social-proof">
        <span class="dot">·</span> Most audits are passed on within <strong>24 hours</strong> of receipt <span class="dot">·</span> Average training group: <strong>4 athletes</strong> <span class="dot">·</span>
      </div>
    </div>
  </article>

  <footer class="doc-footer">
    <p><strong>Disclaimer.</strong> This audit is a personalized educational fueling overview — not medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before starting any new nutrition plan. Individual results vary based on training history, environmental conditions, and many other factors.</p>
    <p>† These statements have not been evaluated by the Food and Drug Administration. RIK Athletica products are not intended to diagnose, treat, cure, or prevent any disease.</p>
    <p>Reply to Your delivery email if anything's off — Bek reads every reply.</p>
    <p class="meta-line">© 2026 RIK Athletic Nutrition Inc. · Methodology ${escapeHtml(engine.methodology_version ?? 'v3.1')} · Audit /a/${escapeHtml(slug)} · Generated ${escapeHtml(deliveredDate)}</p>
  </footer>

</div>

<div class="sticky-cta">
  <button class="cta" type="button" onclick="window.print()">
    <span class="pill">Print as PDF</span>
    <span class="arrow">↗</span>
  </button>
</div>

<div class="copy-toast" id="copy-toast">Copied to clipboard ✓</div>

<script>
(function() {
  const input = document.getElementById('recipient-name');
  const copyBtn = document.getElementById('copy-message-btn');
  const toast = document.getElementById('copy-toast');
  if (!input || !copyBtn) return;

  const auditUrl = ${JSON.stringify(refUrl)};
  const senderFirstName = ${JSON.stringify(firstName)};

  function buildMessage(recipient) {
    const name = recipient || 'there';
    return 'Hey ' + name + ' — got my fueling audited. Worth 90 sec before Your race: ' + auditUrl;
  }

  function updatePreview() {
    const raw = input.value.trim().replace(/[<>]/g, '').slice(0, 24);
    const name = raw.length ? raw : 'there';
    document.querySelectorAll('.recipient-name').forEach(el => el.textContent = name);
    const headerName = document.querySelector('.phone-header .contact-name');
    if (headerName) headerName.textContent = raw.length ? raw : 'Training partner';
    const previewLabel = document.querySelector('.preview-label');
    if (previewLabel) previewLabel.textContent = raw.length ? 'What ' + raw + ' will see' : 'What they will see';
  }

  input.addEventListener('input', updatePreview);

  copyBtn.addEventListener('click', async function() {
    const recipient = input.value.trim().replace(/[<>]/g, '').slice(0, 24);
    const message = buildMessage(recipient);
    try {
      await navigator.clipboard.writeText(message);
    } catch (e) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = message;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
    // Track
    if (window.gtag) gtag('event', 'audit_share_copy', { recipient_named: !!recipient });
  });
})();
</script>

</body>
</html>`;
}
