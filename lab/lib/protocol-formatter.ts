import type { ProtocolDraft, AthleteProfile } from './types.ts';

function formatEventType(eventType: 'ironman_140' | 'ironman_70'): string {
  return eventType === 'ironman_140' ? 'IRONMAN 140.6' : 'IRONMAN 70.3';
}

function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatIterationHeader(iteration: number): string {
  if (iteration === 0) return '';
  const weekMap: Record<number, string> = { 1: 'Week 2', 2: 'Week 3', 3: 'Race Week' };
  return `ITERATION ${iteration} — ${weekMap[iteration] || 'Final'} Adjustment`;
}

/**
 * Renders a ProtocolDraft as a Markdown string for Auditor AI input.
 */
export function formatForAudit(draft: ProtocolDraft, profile: AthleteProfile): string {
  const lines: string[] = [];

  lines.push(`# Nutrition Protocol — ${profile.name}`);
  lines.push(`**Event:** ${formatEventType(profile.eventType)} | **Race Date:** ${formatDate(profile.raceDate)}`);
  lines.push(`**Generated:** ${draft.generatedAt}`);
  lines.push('');

  // If we have raw markdown from the Architect AI, use it directly
  if (draft.rawMarkdown) {
    lines.push(draft.rawMarkdown);
  } else {
    // Otherwise render from structured data
    lines.push('## Protocol Overview');
    lines.push('');

    if (draft.carbTargets.length > 0) {
      lines.push('### Carb Targets by Session Type');
      for (const ct of draft.carbTargets) {
        lines.push(`- **${ct.sessionType}**: ${ct.carbsPerHour}g/hr${ct.notes ? ` — ${ct.notes}` : ''}`);
      }
      lines.push('');
    }

    // Weekly schedule
    for (const week of draft.weeklySchedule) {
      lines.push(`## WEEK ${week.weekNumber} — ${week.phase.toUpperCase()}`);
      lines.push('');

      if (week.weeklyNotes) {
        lines.push(week.weeklyNotes);
        lines.push('');
      }

      for (const session of week.sessions) {
        if (session.sessionType === 'rest') {
          lines.push(`### Rest Day (${session.date})`);
          lines.push('');
          continue;
        }

        lines.push(`### ${session.sessionType.toUpperCase()} — ${Math.round(session.duration / 60 * 10) / 10}hr (${session.date})`);

        if (session.euphoriaPreSession) {
          lines.push(`- **Euphoria:** ${session.euphoriaTimingMinutes || 25}min before start`);
        }

        lines.push(`- **Carb target:** ${session.carbTarget}g/hr`);

        if (session.refuelIntra && session.refuelTimingMinutes?.length) {
          const timings = session.refuelTimingMinutes.map(t => `${t}min`).join(', ');
          lines.push(`- **Refuel (intra):** at ${timings}`);
        }

        if (session.refuelPost) {
          lines.push('- **Refuel (post):** within 30min of finishing');
        }

        if (session.thirdPartyProducts.length > 0) {
          lines.push(`- **Products:** ${session.thirdPartyProducts.join(', ')}`);
        }

        if (session.notes) {
          lines.push(`- *${session.notes}*`);
        }

        lines.push('');
      }
    }

    // Race day plan
    if (draft.raceDayPlan.length > 0) {
      lines.push('## RACE DAY PLAN');
      lines.push('');
      for (const event of draft.raceDayPlan) {
        const label = event.kmMark ? `Hour ${event.hourMark} (${event.kmMark}km)` : `Hour ${event.hourMark}`;
        lines.push(`### ${label}`);
        lines.push(event.description);
        if (event.products.length > 0) {
          lines.push(`- Products: ${event.products.join(', ')}`);
        }
        if (event.carbsConsumed !== undefined) {
          lines.push(`- Carbs: ${event.carbsConsumed}g`);
        }
        if (event.fluidsMl !== undefined) {
          lines.push(`- Fluids: ${event.fluidsMl}mL`);
        }
        lines.push('');
      }
    }

    // Third-party recommendations
    if (draft.thirdPartyRecommendations.length > 0) {
      lines.push('## Third-Party Product Recommendations');
      lines.push('');
      for (const rec of draft.thirdPartyRecommendations) {
        lines.push(`- ${rec}`);
      }
      lines.push('');
    }
  }

  // Assumption flags
  if (draft.assumptionFlags.length > 0) {
    lines.push('## Assumption Flags (Low-Confidence Fields)');
    lines.push('');
    for (const flag of draft.assumptionFlags) {
      lines.push(`- ⚠ ${flag}`);
    }
  }

  return lines.join('\n');
}

/**
 * Renders a ProtocolDraft as print-ready HTML.
 * Intended to be opened in a browser tab for Cmd+P to PDF.
 */
export function formatForPrint(
  draft: ProtocolDraft,
  profile: AthleteProfile,
  iteration: number
): string {
  const markdownContent = formatForAudit(draft, profile);
  const iterationHeader = formatIterationHeader(iteration);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${profile.name} — Nutrition Protocol${iteration > 0 ? ` (Iteration ${iteration})` : ''}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 15px;
      line-height: 1.8;
      color: #0a0a0a;
      background: #fff;
      max-width: 800px;
      margin: 0 auto;
      padding: 48px 40px;
    }

    .print-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid rgba(0,0,0,0.12);
    }

    .print-brand {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #aaa;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }

    .print-meta {
      text-align: right;
    }

    .print-meta .athlete-name {
      font-size: 20px;
      font-weight: 600;
      color: #0a0a0a;
    }

    .print-meta .race-info {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #888;
      margin-top: 4px;
    }

    ${iterationHeader ? `.iteration-header {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #b7791f;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 24px;
      padding: 8px 12px;
      border: 1px solid rgba(183,121,31,0.3);
      border-radius: 8px;
      display: inline-block;
    }` : ''}

    .protocol-body h1 { display: none; }

    .protocol-body h2 {
      font-size: 18px;
      font-weight: 600;
      color: #0a0a0a;
      margin: 32px 0 8px;
    }

    .protocol-body h3 {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #aaa;
      margin: 24px 0 8px;
    }

    .protocol-body p {
      margin: 8px 0;
    }

    .protocol-body ul, .protocol-body ol {
      padding-left: 20px;
      margin: 8px 0;
    }

    .protocol-body li {
      margin: 4px 0;
    }

    .protocol-body strong {
      font-weight: 600;
    }

    .protocol-body em {
      font-style: italic;
      color: #888;
    }

    .protocol-body code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      background: rgba(0,0,0,0.04);
      padding: 1px 4px;
      border-radius: 4px;
    }

    .protocol-body blockquote {
      border-left: 3px solid rgba(0,0,0,0.12);
      padding-left: 16px;
      color: #666;
      margin: 16px 0;
    }

    .protocol-body hr {
      border: none;
      border-top: 1px solid rgba(0,0,0,0.08);
      margin: 24px 0;
    }

    /* Race day section — page break before */
    .race-day-section {
      page-break-before: always;
    }

    .assumption-flags {
      margin-top: 32px;
      padding: 16px;
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 12px;
    }

    .assumption-flags h2 {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #aaa;
      margin-bottom: 8px;
    }

    .assumption-flags li {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #888;
      margin: 4px 0;
    }

    @media print {
      body { padding: 24px; }
      .print-header { padding-bottom: 16px; margin-bottom: 24px; }
      a { text-decoration: none; color: inherit; }

      /* Remove backgrounds for printing */
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { background: #fff !important; }
    }
  </style>
</head>
<body>
  <div class="print-header">
    <div class="print-brand">RIK Athletica<br>Nutrition Protocol</div>
    <div class="print-meta">
      <div class="athlete-name">${profile.name}</div>
      <div class="race-info">${formatEventType(profile.eventType)} · ${formatDate(profile.raceDate)}</div>
    </div>
  </div>

  ${iterationHeader ? `<div class="iteration-header">${iterationHeader}</div>` : ''}

  <div class="protocol-body" id="protocol-content">
    <!-- Protocol markdown rendered here by client or server -->
    <pre style="white-space: pre-wrap; font-family: inherit;">${markdownContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </div>

  <script>
    // If marked.js is available, render the markdown
    (function() {
      const content = document.getElementById('protocol-content');
      const raw = content.querySelector('pre');
      if (window.marked && raw) {
        content.innerHTML = window.marked.parse(raw.textContent || '');
        // Apply race-day section class for page break
        const raceHeaders = Array.from(content.querySelectorAll('h2')).filter(h =>
          h.textContent && h.textContent.includes('RACE DAY')
        );
        raceHeaders.forEach(h => h.classList.add('race-day-section'));
      }
    })();
  </script>
</body>
</html>`;
}

/**
 * Generates a carry sheet PDF — one-page race-day pocket guide.
 * Extracts the Race Pack table and key timing from rawMarkdown.
 */
export function formatCarrySheet(draft: ProtocolDraft, profile: AthleteProfile): string {
  const event = formatEventType(profile.eventType);
  const raceDate = formatDate(profile.raceDate);
  const bikeConfig = (profile as any).bikeConfig || 'standard_cages';
  const raceTemp = (profile as any).raceTemperature || 'temperate';

  const bikeConfigLabel = bikeConfig === 'aero_bars'
    ? 'TT / Aero bars + cage'
    : bikeConfig === 'integrated_reservoir'
    ? 'TT / Integrated reservoir'
    : 'Road bike / Standard cages';

  const bottlePlacement = bikeConfig === 'aero_bars'
    ? 'Aero bar bottle = WATER ONLY · Cage bottle = DM320'
    : bikeConfig === 'integrated_reservoir'
    ? 'Reservoir = WATER ONLY · External cage = DM320'
    : 'Bottle A (down tube) = DM320 · Bottle B = WATER';

  const fastChewsFreq = (raceTemp === 'hot' || raceTemp === 'extreme') ? 'Every 20 min' : 'Every 30 min';
  const tempNote = raceTemp === 'hot'
    ? '⚠ HOT RACE — increase FastChews to every 20 min. Extra water at every aid station.'
    : raceTemp === 'extreme'
    ? '⚠ EXTREME HEAT — FastChews every 15 min. Consider race director guidance on heat protocols.'
    : '';

  // Extract Race Pack section from rawMarkdown if present
  let racePackSection = '';
  if (draft.rawMarkdown) {
    const match = draft.rawMarkdown.match(/##\s*RACE PACK[\s\S]*?(?=\n##|\n---|\Z)/i);
    if (match) racePackSection = match[0];
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Race Day Carry Sheet — ${profile.name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: #0a0a0a;
      background: #fff;
      max-width: 740px;
      margin: 0 auto;
      padding: 32px 28px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 2px solid #0a0a0a;
    }
    .brand {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #aaa;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    .athlete-block { text-align: right; }
    .athlete-name { font-size: 18px; font-weight: 700; }
    .race-meta {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #666;
      margin-top: 2px;
    }
    .section {
      margin: 16px 0;
      padding: 14px 16px;
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 10px;
    }
    .section-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #aaa;
      margin-bottom: 10px;
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .leg-card {
      background: #f6f5f4;
      border-radius: 8px;
      padding: 12px;
    }
    .leg-title {
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .leg-item {
      font-size: 12px;
      color: #333;
      padding: 2px 0;
      border-bottom: 1px solid rgba(0,0,0,0.06);
    }
    .leg-item:last-child { border-bottom: none; }
    .leg-item strong { font-weight: 600; }
    .timing-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      background: #0a0a0a;
      color: #fff;
      padding: 1px 6px;
      border-radius: 4px;
      margin-right: 4px;
    }
    .alert {
      background: #fff5e6;
      border: 1px solid #f6ad55;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 500;
      color: #7b341e;
      margin-bottom: 12px;
    }
    .config-row {
      font-size: 12px;
      padding: 4px 0;
      display: flex;
      gap: 8px;
    }
    .config-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #aaa;
      text-transform: uppercase;
      min-width: 90px;
      padding-top: 2px;
    }
    .rule-item {
      font-size: 12px;
      padding: 3px 0;
      color: #333;
    }
    .rule-item::before { content: '→ '; color: #2D5A3D; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #aaa;
      text-align: left;
      padding: 4px 8px;
      border-bottom: 1px solid rgba(0,0,0,0.1);
    }
    td { padding: 5px 8px; border-bottom: 1px solid rgba(0,0,0,0.05); }
    tr:last-child td { border-bottom: none; }
    .footer {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid rgba(0,0,0,0.1);
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #aaa;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 16px; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

<div class="header">
  <div>
    <div class="brand">RIK Athletica</div>
    <div class="brand" style="margin-top:2px">Race Day Carry Sheet</div>
  </div>
  <div class="athlete-block">
    <div class="athlete-name">${profile.name}</div>
    <div class="race-meta">${event} · ${raceDate}</div>
  </div>
</div>

${tempNote ? `<div class="alert">${tempNote}</div>` : ''}

<div class="section">
  <div class="section-title">Bike Setup</div>
  <div class="config-row"><span class="config-label">Bike type</span><span>${bikeConfigLabel}</span></div>
  <div class="config-row"><span class="config-label">Bottles</span><span>${bottlePlacement}</span></div>
  <div class="config-row"><span class="config-label">Bento / bag</span><span>Gel 100s · Solid 160 (if using) · FastChews · GEL 100 CAF 100 (move to run belt at T2)</span></div>
  <div class="config-row"><span class="config-label">Aid stations</span><span>Swap WATER bottle only. Protect DM320 bottle.</span></div>
</div>

<div class="section">
  <div class="section-title">Race Day Timeline</div>
  <div class="grid-3">
    <div class="leg-card">
      <div class="leg-title">🕐 Pre-Race</div>
      <div class="leg-item"><span class="timing-pill">T−25min</span><strong>Euphoria</strong></div>
      <div class="leg-item"><span class="timing-pill">T−20min</span>500ml water</div>
      <div class="leg-item"><span class="timing-pill">T2</span>Move CAF gel → run belt</div>
    </div>
    <div class="leg-card">
      <div class="leg-title">🚴 Bike</div>
      <div class="leg-item"><strong>DM320</strong> — 1 bottle/hr</div>
      <div class="leg-item"><strong>Gel 100</strong> — see protocol</div>
      <div class="leg-item"><strong>FastChews</strong> — ${fastChewsFreq}</div>
      <div class="leg-item"><strong>Solid 160</strong> — first 90min only</div>
    </div>
    <div class="leg-card">
      <div class="leg-title">🏃 Run</div>
      <div class="leg-item"><strong>SiS BF+E</strong> — every 20–30min</div>
      <div class="leg-item"><strong>FastChews</strong> — ${fastChewsFreq}</div>
      <div class="leg-item"><strong>CAF 100</strong> — mid-run (1× only)</div>
      <div class="leg-item"><strong>Refuel</strong> — post finish &lt;30min</div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Key Rules</div>
  <div class="rule-item">Euphoria is CNS priming — not a carb gel. Take 25min before gun.</div>
  <div class="rule-item">DM320 is your bike carb base. Gels supplement on top — don't stack a second drink mix.</div>
  <div class="rule-item">CAF 100 is for mid-run only. Do not take on bike.</div>
  <div class="rule-item">Aid stations = water replenishment only. All nutrition is self-carried.</div>
  <div class="rule-item">FastChews start at gun, not when you feel thirsty or crampy.</div>
  <div class="rule-item">Solid 160 is early bike only (first 90min). Never solid food on run.</div>
  <div class="rule-item">Refuel within 30min of crossing the finish line — don't skip it.</div>
</div>

${racePackSection ? `<div class="section">
  <div class="section-title">Race Pack — What You're Carrying</div>
  <div style="font-size:12px;color:#555;white-space:pre-wrap;font-family:'JetBrains Mono',monospace;">${racePackSection.replace(/</g,'&lt;').replace(/>/g,'&gt;').substring(0, 800)}</div>
</div>` : ''}

<div class="footer">
  <span>RIK Athletica — Confidential Athlete Document</span>
  <span>${profile.name} · Generated ${new Date().toLocaleDateString('en-GB')}</span>
</div>

</body>
</html>`;
}

/**
 * Fueling Sheet — athlete-facing compact training guide.
 * Extracts per-session data from rawMarkdown and formats it as a clean printable HTML page.
 * The athlete sees: Day / Session / Carb Target / What to take / Timing / Prep notes.
 */
export function formatFuelingSheet(draft: ProtocolDraft, profile: AthleteProfile): string {
  const name = profile.name;
  const event = formatEventType(profile.eventType);
  const raceDate = formatDate(profile.raceDate);
  const md = draft.rawMarkdown || '';

  // ── Extract session blocks ────────────────────────────────────────────────
  interface SessionRow {
    heading: string;
    carbTarget: string;
    pre: string;
    products: string[];
    refuel: string;
    prepNote: string;
  }

  const rows: SessionRow[] = [];

  // Split by ## week headers, then by ### session headers within each week
  const weekSections = md.split(/\n(?=## )/);
  for (const weekBlock of weekSections) {
    if (!/^## (?:WEEK|RACE)/i.test(weekBlock)) continue;

    const sessionBlocks = weekBlock.split(/\n(?=### )/);
    const weekLabel = sessionBlocks[0].match(/^## (.+)/)?.[1]?.trim() ?? '';

    for (let i = 1; i < sessionBlocks.length; i++) {
      const block = sessionBlocks[i];
      const lines = block.split('\n');
      const heading = lines[0].replace(/^### /, '').trim();

      // Skip assumption flags / supply table sections
      if (/assumption|supply table|race pack/i.test(heading)) continue;

      const bodyText = lines.slice(1).join('\n');

      // Carb target
      const carbMatch = bodyText.match(/carb target[:\s]+(\d+)\s*g\/hr/i);
      const carbTarget = carbMatch ? `${carbMatch[1]} g/hr` : '—';

      // Pre-session (Euphoria timing)
      const euphoriaMatch = bodyText.match(/euphoria[^:\n]*:\s*([^\n]{5,60})/i);
      const pre = euphoriaMatch ? euphoriaMatch[1].trim().replace(/\*\*/g, '') : '—';

      // Products — lines containing × quantity or product brand keywords
      const productLines = lines
        .filter(l => /×\s*\d+|maurten|sis|saltst|fastchew|dm\d{3}|gel\s*100|solid\s*160|beta\s*fuel|refuel/i.test(l))
        .map(l => l.replace(/^[-*•\s]+/, '').replace(/\*\*/g, '').trim())
        .filter(l => l.length > 4 && !/^#+/.test(l))
        .slice(0, 6);

      // Refuel timing
      const refuelIntra = bodyText.match(/refuel.*?intra[^:\n]*:\s*([^\n]{4,60})/i)?.[1]?.trim() ?? '';
      const refuelPost = bodyText.match(/refuel.*?post[^:\n]*:\s*([^\n]{4,60})/i)?.[1]?.trim() ?? '';
      const refuelStr = [refuelIntra, refuelPost].filter(Boolean).join(' · ') || 'Post-session (within 30 min)';

      // Prep note
      const hasLongBike = /bike|brick/i.test(heading) && parseInt(bodyText.match(/(\d{2,3})\s*min/)?.[1] ?? '0') >= 90;
      const prepNote = hasLongBike ? 'Mix DM bottles the night before. Pre-cut Euphoria sachet.' : '';

      rows.push({ heading: `${weekLabel ? weekLabel + ' · ' : ''}${heading}`, carbTarget, pre, products: productLines, refuel: refuelStr, prepNote });
    }
  }

  const tableRows = rows.map(r => `
    <tr>
      <td class="session-col"><strong>${r.heading}</strong>${r.prepNote ? `<div class="prep-note">⚑ ${r.prepNote}</div>` : ''}</td>
      <td class="carb-col">${r.carbTarget}</td>
      <td class="detail-col">${r.pre}</td>
      <td class="detail-col">${r.products.length ? r.products.join('<br>') : '—'}</td>
      <td class="detail-col">${r.refuel}</td>
    </tr>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${name} — Fueling Sheet</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; line-height: 1.6; color: #0a0a0a; background: #fff; max-width: 960px; margin: 0 auto; padding: 36px 32px; }
.header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; padding-bottom: 16px; border-bottom: 2px solid #0a0a0a; }
.brand { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 1.5px; }
.athlete { font-size: 20px; font-weight: 600; }
.meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #666; margin-top: 2px; }
h2 { font-size: 11px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 12px; }
table { width: 100%; border-collapse: collapse; }
thead th { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #999; text-align: left; padding: 6px 10px; border-bottom: 1px solid #e0e0e0; }
tbody tr { border-bottom: 1px solid #f0f0f0; }
tbody tr:hover { background: #fafafa; }
td { padding: 10px 10px; vertical-align: top; font-size: 12.5px; }
.session-col { width: 26%; font-weight: 500; }
.carb-col { width: 10%; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #2D5A3D; white-space: nowrap; }
.detail-col { width: 21%; font-size: 12px; color: #444; }
.prep-note { font-size: 11px; color: #b7791f; margin-top: 4px; font-weight: 400; }
.legend { margin-top: 24px; font-size: 11px; color: #888; border-top: 1px solid #e0e0e0; padding-top: 12px; }
@media print {
  body { padding: 24px; }
  .header { page-break-after: avoid; }
  tr { page-break-inside: avoid; }
}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">RIK Athletica · Fueling Sheet</div>
    <div class="athlete">${name}</div>
    <div class="meta">${event} · Race: ${raceDate}</div>
  </div>
  <div style="text-align:right">
    <div class="brand">Full protocol: see Protocol PDF</div>
    <div class="meta">Generated ${formatDate(draft.generatedAt)}</div>
  </div>
</div>

<h2>Session-by-Session Fueling Plan</h2>
<table>
  <thead>
    <tr>
      <th>Session</th>
      <th>Carb target</th>
      <th>Pre-session</th>
      <th>During session</th>
      <th>Recovery</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows || '<tr><td colspan="5" style="color:#999;text-align:center;padding:20px">No session data extracted — view full protocol PDF for details.</td></tr>'}
  </tbody>
</table>

<div class="legend">
  <strong>Key:</strong> All carb targets in g/hr. Pre-session = Euphoria sachet 20–30 min before session start. Recovery = Refuel sachet within 30 min of finish. ⚑ = prep action required the night before.
  <br><br><strong>Products to have on hand:</strong> Euphoria sachets · Refuel sachets · Maurten DM160/DM320 sachets · Maurten Gel 100 · SiS Beta Fuel Gel · SaltStick FastChews · (Race only: Maurten GEL 100 CAF 100)
</div>
</body>
</html>`;
}
