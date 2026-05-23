// RIK Audit — Shared HTML renderer (4-section diagnostic, post-rewrite).
// Spec: docs/RIK_Audit_Engine_Prompt.md
//
// Structure: dark hero (athlete + big number) → 4 sections in 720px document:
//   1. Primary Gap (one identified problem, viz bar)
//   2. Estimated Impact (single minute-cost number)
//   3. The Fix (3-4 tactic cards, product-agnostic)
//   4. Next Step (single CTA — Bundle or Sprint, not both)
// Plus: compliance methodology note, disclaimers, footer.
//
// Compliance preserved from iter-5:
//   - §1.1 verbatim RD citation form
//   - §2 paid-review FTC disclosure
//   - §4.3 scope tag ("Methodology only")
//   - §1.6(f) link to full review statement
//
// Backward compat: works on both old (track_a, race_day_skeleton) and new
// (no engine extras) DB rows — derives everything from row.answers at render time.

import { identifyPrimaryGap, distanceLabel } from './audit-gaps.js';
import { RD_NAME } from './methodology.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function formatRaceDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatGeneratedDate(iso) {
  if (!iso) return new Date().toISOString().split('T')[0];
  return new Date(iso).toISOString().split('T')[0];
}

function distancePillLabel(rd) {
  return rd === '70.3'    ? 'IRONMAN 70.3'
       : rd === 'full'    ? 'Full IRONMAN'
       : rd === 'olympic' ? 'Olympic Triathlon'
       : rd === 'marathon'? 'Marathon'
       : rd === 'ultra'   ? 'Ultra'
       : 'Race';
}

// === Gap visualization bar (current vs target) ===
function gapVizBar({ gap_type, athleteGhr, targetGhr }) {
  if (gap_type !== 'carb_deficit' || athleteGhr == null || !targetGhr) return '';
  const max = Math.max(targetGhr + 20, 100);
  const currPct = Math.min(100, Math.round((athleteGhr / max) * 100));
  const targetPct = Math.min(100, Math.round((targetGhr / max) * 100));
  return `
    <div class="viz-bar">
      <div class="viz-track">
        <div class="viz-fill-current" style="width: ${currPct}%"></div>
        <div class="viz-mark-target" style="left: ${targetPct}%">
          <div class="viz-mark-label">Target ${targetGhr} g/hr</div>
        </div>
      </div>
      <div class="viz-labels">
        <span class="viz-label-current"><strong>You</strong> · ${athleteGhr} g/hr</span>
        <span class="viz-label-gap">Gap: <strong>${targetGhr - athleteGhr} g/hr</strong></span>
      </div>
    </div>
  `;
}

// === Goal-time delta phrasing for Section 2 ===
function goalTimeDelta(goalTime, minMin, maxMin) {
  if (!goalTime || !goalTime.trim()) return '';
  const cleaned = goalTime.trim();
  // Try to parse h:mm or hh:mm
  const m = cleaned.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(min)) return '';
  const totalMin = h * 60 + min;
  const slowMin = totalMin + maxMin;
  const slowH = Math.floor(slowMin / 60);
  const slowM = slowMin % 60;
  const slowStr = `${slowH}:${slowM.toString().padStart(2, '0')}`;
  return `That's the difference between Your <strong>${escapeHtml(cleaned)}</strong> goal and a <strong>${slowStr}</strong> finish.`;
}

export function renderAuditPage(row) {
  // Pull from row + run gap analysis fresh at render time (works for old + new rows)
  const answers = row.answers ?? {};
  const drafts  = row.drafts_final ?? row.drafts ?? {};
  const firstName = row.first_name ?? answers.firstName ?? 'athlete';
  const slug = row.slug ?? '';
  const deliveredDate = formatGeneratedDate(row.delivered_at);
  const raceDate = formatRaceDate(answers.raceDate);
  const distLabelPill = distancePillLabel(answers.raceDistance);
  const distLabelProse = distanceLabel(answers.raceDistance);
  const goalTime = answers.targetTime;

  // === Run gap analysis ===
  const gap = identifyPrimaryGap(answers);
  const { gap_type, gap_title, gap_description, minute_cost, tactics, routing, athleteGhr, targetGhr } = gap;

  // Render-time hooks for AI-personalized prose (filled by ai-drafter; safe to be empty)
  const aiSection1 = drafts.section_1_gap ? `<p>${escapeHtml(drafts.section_1_gap)}</p>` : '';
  const aiSection2 = drafts.section_2_impact ? `<p class="impact-context">${escapeHtml(drafts.section_2_impact)}</p>` : '';
  const aiSection3Lead = drafts.section_3_lead ? `<p class="section-lead">${escapeHtml(drafts.section_3_lead)}</p>` : '';
  const aiSection4 = drafts.section_4_routing ? `<p>${escapeHtml(drafts.section_4_routing)}</p>` : `<p>${escapeHtml(routing.explanation)}</p>`;

  const siteOrigin = (typeof process !== 'undefined' && process.env?.SITE_ORIGIN) || 'https://www.rikathletica.com';
  const auditUrl = `${siteOrigin}/a/${escapeHtml(slug)}`;
  const ogTitle = `${escapeHtml(firstName)}'s Free Race Fuel Audit`;
  const ogDescription = `${gap_title} · ${minute_cost.min}–${minute_cost.max} min of estimated impact at Your ${distLabelPill}.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(firstName)}'s Race Fuel Audit — RIK Athletica</title>
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
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root {
  --sand: #EEEDEA;
  --ink:  #0E0E0E;
  --ink-soft: #5A5853;
  --ink-dim:  #8A8780;
  --rule: rgba(14,14,14,.14);
  --rule-soft: rgba(14,14,14,.08);
  --warn: #a82010;
  --warm-amber: #c98b5a;
  --warm-deep:  #7a4a2a;
  --r-card: 14px;
  --r-btn: 999px;
  --doc-w: 720px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: 'Outfit', -apple-system, 'Helvetica Neue', Arial, sans-serif;
  font-weight: 400;
  background: var(--sand);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  line-height: 1.55;
  font-feature-settings: "kern" 1, "liga" 1;
  padding: 0;
}
.mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace; }

/* ─── HERO (dark) ─── */
.hero {
  background: var(--ink);
  color: #fff;
  padding: 64px 32px 80px;
  text-align: center;
}
.hero-inner { max-width: 600px; margin: 0 auto; }
.hero .brand {
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(255,255,255,.5);
  font-weight: 600;
  margin-bottom: 24px;
}
.hero h1 {
  font-size: clamp(36px, 5.4vw, 54px);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.02;
  margin-bottom: 14px;
}
.hero h1 .name { color: #fff; }
.hero .race-line {
  font-size: 14px;
  color: rgba(255,255,255,.65);
  letter-spacing: 0.04em;
  margin-bottom: 48px;
  font-variant-numeric: tabular-nums;
}
.hero .race-line .dot { color: var(--warm-amber); margin: 0 10px; }
.hero .big-number-label {
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(255,255,255,.5);
  margin-bottom: 12px;
  font-weight: 600;
}
.hero .big-number {
  font-size: clamp(72px, 12vw, 120px);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 0.9;
  color: #fff;
  font-variant-numeric: tabular-nums;
  margin-bottom: 4px;
}
.hero .big-number .unit {
  font-size: 0.32em;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: rgba(255,255,255,.7);
  margin-left: 8px;
  vertical-align: middle;
}
.hero .tagline {
  font-size: 16px;
  color: rgba(255,255,255,.78);
  max-width: 44ch;
  margin: 24px auto 0;
  line-height: 1.5;
}

/* ─── PAGE BODY (720px doc) ─── */
.page {
  max-width: var(--doc-w);
  margin: -40px auto 0;
  background: #fff;
  border-radius: var(--r-card) var(--r-card) 0 0;
  padding: 56px 56px 24px;
  position: relative;
  box-shadow: 0 24px 64px rgba(14,14,14,.08);
}
.page-tail {
  max-width: var(--doc-w);
  margin: 0 auto 48px;
  background: #fff;
  padding: 0 56px 48px;
  border-radius: 0 0 var(--r-card) var(--r-card);
  box-shadow: 0 24px 64px rgba(14,14,14,.08);
}

/* ─── Section ─── */
.section { padding: 36px 0; border-bottom: 1px solid var(--rule-soft); }
.section:first-child { padding-top: 0; }
.section:last-child  { border-bottom: none; }
.section .section-label {
  display: inline-block;
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--ink-soft);
  font-weight: 600;
  padding-bottom: 12px;
}
.section .section-title {
  font-size: clamp(26px, 3.4vw, 32px);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.12;
  margin-bottom: 16px;
}
.section .section-lead {
  font-size: 16px;
  color: var(--ink-soft);
  line-height: 1.6;
  margin-bottom: 18px;
  max-width: 58ch;
}
.section p {
  font-size: 15.5px;
  line-height: 1.65;
  color: var(--ink);
}
.section p + p { margin-top: 14px; }

/* ─── Section 1: Gap viz bar ─── */
.viz-bar {
  margin-top: 28px;
  padding: 24px 26px 22px;
  background: var(--sand);
  border-radius: 12px;
}
.viz-track {
  position: relative;
  height: 14px;
  border-radius: 8px;
  background: rgba(14,14,14,.06);
  overflow: visible;
}
.viz-fill-current {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, var(--warm-deep), var(--warm-amber));
  border-radius: 8px;
  transition: width 600ms ease;
}
.viz-mark-target {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 2px;
  background: var(--ink);
  z-index: 2;
}
.viz-mark-label {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ink);
  color: #fff;
  font-size: 10px;
  padding: 4px 10px;
  border-radius: 5px;
  white-space: nowrap;
  letter-spacing: 0.06em;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.viz-mark-label::after {
  content: '';
  position: absolute;
  bottom: -4px; left: 50%;
  transform: translateX(-50%);
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid var(--ink);
}
.viz-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 28px;
  font-size: 12px;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}
.viz-labels strong { color: var(--ink); font-weight: 700; }
.viz-label-gap { color: var(--warm-deep); }

/* ─── Section 2: Big impact number ─── */
.impact-block {
  margin-top: 24px;
  padding: 32px 28px;
  background: var(--sand);
  border-radius: 12px;
  text-align: center;
}
.impact-number {
  font-size: clamp(54px, 8vw, 80px);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.impact-number .unit {
  font-size: 0.36em;
  font-weight: 500;
  color: var(--ink-soft);
  margin-left: 8px;
}
.impact-context {
  margin-top: 18px;
  font-size: 15px;
  color: var(--ink-soft);
  line-height: 1.6;
  max-width: 52ch;
  margin-left: auto;
  margin-right: auto;
}

/* ─── Section 3: Tactic cards ─── */
.tactic-list { margin-top: 20px; display: flex; flex-direction: column; gap: 14px; }
.tactic {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 16px;
  padding: 22px 22px;
  background: var(--sand);
  border-radius: 12px;
  align-items: start;
}
.tactic-num {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 26px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -0.02em;
  line-height: 1;
  padding-top: 2px;
}
.tactic-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 6px;
  letter-spacing: -0.005em;
}
.tactic-body {
  font-size: 14px;
  color: var(--ink-soft);
  line-height: 1.55;
}

/* ─── Section 4: Routing CTA ─── */
.routing-card {
  margin-top: 22px;
  padding: 28px 28px 30px;
  background: var(--sand);
  border-radius: 12px;
  border-left: 3px solid var(--ink);
}
.routing-card p { font-size: 15px; color: var(--ink); line-height: 1.6; margin-bottom: 20px; }
.cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: var(--ink);
  color: #fff;
  padding: 14px 24px 14px 26px;
  border-radius: var(--r-btn);
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.01em;
  text-decoration: none;
  transition: transform 150ms ease;
}
.cta-btn:hover { transform: translateY(-1px); }
.cta-btn .arrow { font-size: 16px; line-height: 1; }
.routing-footnote {
  margin-top: 14px;
  font-size: 12px;
  color: var(--ink-soft);
  font-style: italic;
}

/* ─── Methodology / Compliance note ─── */
.methodology-note {
  padding: 28px 0 20px;
  border-top: 1px solid var(--rule);
  margin-top: 12px;
}
.methodology-note .meta-eyebrow {
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--ink-soft);
  font-weight: 600;
  margin-bottom: 12px;
}
.methodology-note .meta-citation {
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.55;
  color: var(--ink);
}
.methodology-note .scope-tag {
  display: inline-block;
  margin-top: 10px;
  padding: 2px 9px;
  background: var(--ink);
  color: #fff;
  font-size: 9.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 600;
  border-radius: 999px;
}
.methodology-note .meta-scope {
  font-size: 12.5px;
  color: var(--ink-soft);
  line-height: 1.55;
  margin-top: 12px;
}
.methodology-note .meta-ftc {
  font-size: 11.5px;
  color: var(--ink-dim);
  line-height: 1.55;
  margin-top: 10px;
  font-style: italic;
}
.methodology-note .meta-link {
  display: inline-block;
  margin-top: 12px;
  font-size: 12px;
  color: var(--ink);
  border-bottom: 1px solid var(--ink);
  text-decoration: none;
  padding-bottom: 1px;
}
.methodology-note .meta-link:hover { color: var(--warm-deep); border-color: var(--warm-deep); }

/* ─── Disclaimer / Footer ─── */
.disclaimer-block {
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid var(--rule-soft);
  font-size: 11.5px;
  color: var(--ink-dim);
  line-height: 1.55;
}
.disclaimer-block p { font-size: 11.5px; }
.disclaimer-block p + p { margin-top: 8px; }
.footer-meta {
  text-align: center;
  font-size: 10.5px;
  color: var(--ink-dim);
  letter-spacing: 0.08em;
  margin: 24px auto 48px;
  max-width: var(--doc-w);
  padding: 0 24px;
  font-variant-numeric: tabular-nums;
}

/* ─── Sticky print CTA ─── */
.sticky-cta {
  position: fixed; bottom: 24px; right: 24px; z-index: 100;
}
.sticky-cta button {
  background: var(--ink);
  color: #fff;
  border: none;
  padding: 12px 20px;
  border-radius: var(--r-btn);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(14,14,14,.15);
}

/* ─── Mobile ─── */
@media (max-width: 720px) {
  .hero { padding: 48px 24px 64px; }
  .page { padding: 36px 24px 16px; margin-top: -32px; }
  .page-tail { padding: 0 24px 32px; }
  .tactic { grid-template-columns: 40px 1fr; gap: 12px; padding: 18px; }
  .tactic-num { font-size: 22px; }
  .routing-card { padding: 22px; }
}

/* ─── Print ─── */
@media print {
  body { background: #fff; }
  .hero { background: #fff; color: var(--ink); padding: 0 0 32px; border-bottom: 2px solid var(--ink); }
  .hero .brand, .hero .race-line, .hero .big-number-label, .hero .tagline { color: var(--ink-soft); }
  .hero .big-number, .hero h1 { color: var(--ink); }
  .page, .page-tail { box-shadow: none; }
  .sticky-cta { display: none; }
  .section { page-break-inside: avoid; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
</style>
</head>
<body>

<header class="hero">
  <div class="hero-inner">
    <div class="brand">RIK Athletica · Free Race Fuel Audit</div>
    <h1>Hi <span class="name">${escapeHtml(firstName)}</span>.<br>Here's Your audit.</h1>
    <div class="race-line">${escapeHtml(distLabelPill)}${raceDate ? `<span class="dot">·</span>${escapeHtml(raceDate)}` : ''}</div>
    <div class="big-number-label">Estimated impact</div>
    <div class="big-number">${minute_cost.min}–${minute_cost.max}<span class="unit">min</span></div>
    <p class="tagline">Your single biggest fueling gap — and how to close it before race day.</p>
  </div>
</header>

<main class="page">

  <!-- Section 1: Primary Gap -->
  <section class="section">
    <div class="section-label">Primary Gap</div>
    <h2 class="section-title">${escapeHtml(gap_title)}.</h2>
    <p>${escapeHtml(gap_description)}</p>
    ${aiSection1}
    ${gapVizBar({ gap_type, athleteGhr, targetGhr })}
  </section>

  <!-- Section 2: What it's costing you -->
  <section class="section">
    <div class="section-label">Estimated Impact</div>
    <h2 class="section-title">What it's costing You.</h2>
    <div class="impact-block">
      <div class="impact-number">${minute_cost.min}–${minute_cost.max}<span class="unit">min</span></div>
    </div>
    ${aiSection2 || `<p class="impact-context" style="margin-top:18px;">${minute_cost.min}–${minute_cost.max} minutes is the estimated range based on Your data and Your race distance. ${goalTimeDelta(goalTime, minute_cost.min, minute_cost.max)} Ranges reflect normal variation between athletes — Your specific number depends on conditions, training history, and execution.</p>`}
  </section>

  <!-- Section 3: How to fix it -->
  <section class="section">
    <div class="section-label">The Fix</div>
    <h2 class="section-title">${tactics.length} things You can do this week.</h2>
    ${aiSection3Lead}
    <ol class="tactic-list">
      ${tactics.map((t, i) => `
        <li class="tactic">
          <div class="tactic-num">${String(i + 1).padStart(2, '0')}</div>
          <div>
            <div class="tactic-title">${escapeHtml(t.title)}</div>
            <p class="tactic-body">${escapeHtml(t.body)}</p>
          </div>
        </li>
      `).join('')}
    </ol>
  </section>

  <!-- Section 4: Next step -->
  <section class="section">
    <div class="section-label">Next Step</div>
    <h2 class="section-title">${routing.tier === 'sprint' ? 'Sprint is the system that fixes this.' : 'Bundle is Your next move.'}</h2>
    <div class="routing-card">
      ${aiSection4}
      <a class="cta-btn" href="${escapeHtml(routing.cta_url)}?utm_source=audit&utm_medium=audit_page&utm_campaign=${escapeHtml(routing.tier)}&ref=${escapeHtml(slug)}">
        <span>${escapeHtml(routing.cta_text)}</span>
        <span class="arrow">→</span>
      </a>
      <p class="routing-footnote">This audit was founder-reviewed by Bek Zhou before delivery.</p>
    </div>
  </section>

</main>

<div class="page-tail">

  <!-- Methodology / Compliance note (§1.1 verbatim + §2 FTC + §4.3 scope + §1.6(f) link) -->
  <div class="methodology-note">
    <div class="meta-eyebrow">Methodology</div>
    <p class="meta-citation">"Methodology reviewed by ${escapeHtml(RD_NAME)} — Commission on Dietetic Registration (USA), reg. #86117608, May 7, 2026."</p>
    <span class="scope-tag">Methodology only</span>
    <p class="meta-scope">The review covers the carbohydrate, sodium, hydration, gut-adaptation, caffeine, and race-week tapering targets — not the gap-identification engine, the minute-cost projection, or the product recommendation in Section 4. Those are RIK-derived applications of published literature. Not medical advice or individualized nutrition counseling.</p>
    <p class="meta-ftc">Paid independent methodology review. RIK Athletica paid Reviewer a one-time fee for the review. The opinions expressed are Reviewer's own.</p>
    <a class="meta-link" href="/assets/docs/rd-review-statement.pdf">Read the full statement →</a>
  </div>

  <!-- Disclaimers -->
  <div class="disclaimer-block">
    <p><strong>Disclaimer.</strong> This audit is a personalized educational fueling overview — not medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before starting any new nutrition plan. Individual results vary based on training history, environmental conditions, and many other factors.</p>
    <p>† These statements have not been evaluated by the Food and Drug Administration. RIK Athletica products are not intended to diagnose, treat, cure, or prevent any disease.</p>
  </div>
</div>

<p class="footer-meta">© 2026 RIK Athletic Nutrition Inc. · Audit /a/${escapeHtml(slug)} · Generated ${escapeHtml(deliveredDate)}</p>

<div class="sticky-cta">
  <button type="button" onclick="window.print()">Print as PDF</button>
</div>

</body>
</html>`;
}
