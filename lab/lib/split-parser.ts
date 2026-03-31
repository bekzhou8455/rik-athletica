// lib/split-parser.ts
// Parses standard Ironman race splits CSV (exported from Ironman Tracker or Athlinks).
// Non-blocking: if the CSV doesn't match expected format, returns null.

export interface RaceSplits {
  swimMins: number;
  t1Mins: number;
  bikeMins: number;
  t2Mins: number;
  runMins: number;
  finishMins: number;
  distanceKm: number; // 226 for full, 113 for 70.3
}

// Expected column names (case-insensitive, partial match OK)
const COL_SWIM  = ['swim', 'swim_time', 'swim time'];
const COL_T1    = ['t1', 'transition 1', 'transition1', 't1_time'];
const COL_BIKE  = ['bike', 'cycle', 'bike_time', 'bike time', 'cycle_time'];
const COL_T2    = ['t2', 'transition 2', 'transition2', 't2_time'];
const COL_RUN   = ['run', 'run_time', 'run time'];
const COL_DIST  = ['distance', 'dist', 'race_distance', 'race distance', 'event_distance'];

function findCol(headers: string[], candidates: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    if (candidates.some(c => h.includes(c))) return i;
  }
  return -1;
}

/**
 * Parse HH:MM:SS or MM:SS or bare minutes into decimal minutes.
 * Returns NaN if unparseable.
 */
function parseTime(raw: string): number {
  const s = raw.trim();
  if (!s) return NaN;

  // HH:MM:SS
  const hms = s.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (hms) return parseInt(hms[1]) * 60 + parseInt(hms[2]) + parseInt(hms[3]) / 60;

  // MM:SS
  const ms = s.match(/^(\d{1,3}):(\d{2})$/);
  if (ms) return parseInt(ms[1]) + parseInt(ms[2]) / 60;

  // Bare number (assume minutes)
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

/**
 * Parse a CSV buffer into RaceSplits.
 * Accepts the first data row — athletes upload their own results file.
 * Returns null if the CSV doesn't have recognisable split columns.
 */
export function parseSplitsCsv(csv: string): RaceSplits | null {
  const lines = csv.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;

  const headers = lines[0].split(',');
  const row = lines[1].split(',');

  const swimIdx  = findCol(headers, COL_SWIM);
  const t1Idx    = findCol(headers, COL_T1);
  const bikeIdx  = findCol(headers, COL_BIKE);
  const t2Idx    = findCol(headers, COL_T2);
  const runIdx   = findCol(headers, COL_RUN);

  // Need at minimum swim, bike, run
  if (swimIdx === -1 || bikeIdx === -1 || runIdx === -1) return null;

  const get = (idx: number) => idx === -1 ? NaN : parseTime(row[idx] || '');

  const swimMins = get(swimIdx);
  const bikeMins = get(bikeIdx);
  const runMins  = get(runIdx);

  if (isNaN(swimMins) || isNaN(bikeMins) || isNaN(runMins)) return null;

  const t1Mins = isNaN(get(t1Idx)) ? 5 : get(t1Idx);   // default 5min if missing
  const t2Mins = isNaN(get(t2Idx)) ? 3 : get(t2Idx);   // default 3min if missing
  const finishMins = swimMins + t1Mins + bikeMins + t2Mins + runMins;

  // Infer distance from bike split: full IM bike ≈ 240-420min, 70.3 ≈ 120-240min
  const distIdx = findCol(headers, COL_DIST);
  let distanceKm = 226; // assume full unless we can tell otherwise
  if (distIdx !== -1) {
    const distRaw = (row[distIdx] || '').toLowerCase();
    if (distRaw.includes('70') || distRaw.includes('half')) distanceKm = 113;
  } else if (bikeMins < 200) {
    distanceKm = 113; // 70.3 bike is typically <3h20
  }

  return { swimMins, t1Mins, bikeMins, t2Mins, runMins, finishMins, distanceKm };
}
