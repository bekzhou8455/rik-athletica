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
