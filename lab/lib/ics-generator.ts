import type { TrainingSession, ProtocolDraft, AthleteProfile, SessionProtocol } from './types.ts';

function formatICSDate(isoDate: string): string {
  // Convert ISO date to YYYYMMDD format
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate.replace(/-/g, '');
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function formatICSDateTime(isoDate: string, hourOffset = 0): string {
  // Convert ISO date to YYYYMMDDTHHmmssZ format
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  d.setHours(d.getHours() + hourOffset);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}${mo}${day}T${h}${mi}${s}`;
}

function foldICSLine(line: string): string {
  // iCal spec: lines > 75 chars should be folded with CRLF + space
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let remaining = line;
  chunks.push(remaining.substring(0, 75));
  remaining = remaining.substring(75);
  while (remaining.length > 0) {
    chunks.push(' ' + remaining.substring(0, 74));
    remaining = remaining.substring(74);
  }
  return chunks.join('\r\n');
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function generateUID(athleteId: string, date: string, type: string): string {
  return `${athleteId}-${date}-${type}-${Date.now()}@rik-athletica.com`;
}

function buildSessionSummary(session: TrainingSession, protocol?: SessionProtocol): string {
  const durationHrs = Math.round(session.duration / 60 * 10) / 10;
  const typeLabel = session.type.charAt(0).toUpperCase() + session.type.slice(1);
  let summary = `[${typeLabel} ${durationHrs}hr]`;

  if (protocol) {
    const parts: string[] = [];
    if (protocol.euphoriaPreSession) {
      parts.push(`Euphoria ${protocol.euphoriaTimingMinutes || 25}min pre`);
    }
    if (protocol.carbTarget > 0) {
      parts.push(`${protocol.carbTarget}g/hr carbs`);
    }
    if (parts.length > 0) {
      summary += ` — ${parts.join(' · ')}`;
    }
  }

  return summary;
}

function buildSessionDescription(session: TrainingSession, protocol?: SessionProtocol): string {
  const lines: string[] = [];
  const durationHrs = Math.round(session.duration / 60 * 10) / 10;
  const typeLabel = session.type.charAt(0).toUpperCase() + session.type.slice(1);

  lines.push(`${typeLabel} Session — ${durationHrs}hr`);
  if (session.description) {
    lines.push(session.description);
  }
  lines.push('');
  lines.push('NUTRITION PROTOCOL:');

  if (protocol) {
    if (protocol.euphoriaPreSession) {
      lines.push(`• Euphoria: ${protocol.euphoriaTimingMinutes || 25}min before start`);
    }
    if (protocol.carbTarget > 0) {
      lines.push(`• Carb target: ${protocol.carbTarget}g/hr`);
    }
    if (protocol.refuelIntra && protocol.refuelTimingMinutes?.length) {
      const timings = protocol.refuelTimingMinutes.map(t => `${t}min`).join(', ');
      lines.push(`• Refuel (intra): at ${timings}`);
    }
    if (protocol.refuelPost) {
      lines.push('• Refuel (post): within 30min of finishing');
    }
    if (protocol.thirdPartyProducts.length > 0) {
      lines.push(`• Products: ${protocol.thirdPartyProducts.join(', ')}`);
    }
    if (protocol.notes) {
      lines.push(`• Note: ${protocol.notes}`);
    }
  } else {
    lines.push('• See protocol document for full details');
  }

  lines.push('');
  lines.push('RIK Athletica Protocol Builder');

  return lines.join('\n');
}

export function generateICS(
  sessions: TrainingSession[],
  draft: ProtocolDraft,
  profile: AthleteProfile,
  iterationNumber: number
): { content: string; filename: string } {
  const vevents: string[] = [];
  const now = formatICSDateTime(new Date().toISOString());

  // Build a map of session protocols by date+type for quick lookup
  const protocolMap = new Map<string, SessionProtocol>();
  if (draft.weeklySchedule) {
    for (const week of draft.weeklySchedule) {
      for (const sessionProtocol of week.sessions) {
        const key = `${sessionProtocol.date}-${sessionProtocol.sessionType}`;
        protocolMap.set(key, sessionProtocol);
      }
    }
  }

  // Generate VEVENT for each non-rest training session
  for (const session of sessions) {
    if (session.type === 'rest') continue;

    const key = `${session.date}-${session.type}`;
    const protocol = protocolMap.get(key);

    const dtstart = formatICSDate(session.date);
    const summary = buildSessionSummary(session, protocol);
    const description = buildSessionDescription(session, protocol);
    const uid = generateUID(profile.athleteId, session.date, session.type);

    const durationStr = `PT${session.duration}M`;

    vevents.push([
      'BEGIN:VEVENT',
      foldICSLine(`UID:${uid}`),
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dtstart}`,
      foldICSLine(`DURATION:${durationStr}`),
      foldICSLine(`SUMMARY:${escapeICSText(summary)}`),
      foldICSLine(`DESCRIPTION:${escapeICSText(description)}`),
      'CATEGORIES:RIK Protocol',
      'END:VEVENT',
    ].join('\r\n'));
  }

  // Generate race day VEVENT (if race date is set)
  if (draft.raceDayPlan && draft.raceDayPlan.length > 0 && profile.raceDate) {
    const raceDescLines: string[] = ['RACE DAY NUTRITION PLAN', ''];
    for (const event of draft.raceDayPlan) {
      const label = event.kmMark ? `Hour ${event.hourMark} (${event.kmMark}km)` : `Hour ${event.hourMark}`;
      raceDescLines.push(`${label}:`);
      raceDescLines.push(event.description);
      if (event.products.length > 0) {
        raceDescLines.push(`Products: ${event.products.join(', ')}`);
      }
      if (event.carbsConsumed !== undefined) {
        raceDescLines.push(`Carbs: ${event.carbsConsumed}g`);
      }
      raceDescLines.push('');
    }
    raceDescLines.push('RIK Athletica Protocol Builder');

    const raceEventType = profile.eventType === 'ironman_140' ? 'IRONMAN 140.6' : 'IRONMAN 70.3';
    const raceDurationHours = profile.eventType === 'ironman_140' ? 17 : 9; // max event time
    const raceDtStart = formatICSDateTime(profile.raceDate + 'T06:00:00', 0);
    const raceUid = generateUID(profile.athleteId, profile.raceDate, 'race');

    vevents.push([
      'BEGIN:VEVENT',
      foldICSLine(`UID:${raceUid}`),
      `DTSTAMP:${now}`,
      foldICSLine(`DTSTART:${raceDtStart}`),
      `DURATION:PT${raceDurationHours}H`,
      foldICSLine(`SUMMARY:${escapeICSText(`RACE DAY — ${raceEventType}`)}`),
      foldICSLine(`DESCRIPTION:${escapeICSText(raceDescLines.join('\n'))}`),
      'CATEGORIES:RIK Protocol,Race Day',
      'END:VEVENT',
    ].join('\r\n'));
  }

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RIK Athletica//Protocol Builder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:RIK Protocol — ${profile.name}`,
    `X-WR-CALDESC:Nutrition protocol for ${profile.name} — ${profile.eventType === 'ironman_140' ? 'IRONMAN 140.6' : 'IRONMAN 70.3'}`,
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n');

  const filename = `${profile.athleteId}-iteration-${iterationNumber}-protocol.ics`;

  return { content: icsContent, filename };
}
