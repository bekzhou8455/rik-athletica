import type { FeedbackData, CarbAdjustment, ProtocolIteration } from './types.ts';
import { applyFeedbackModifiers } from './carb-calculator.ts';

// Simple CSV parser
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function getField(row: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== '') {
      return row[key];
    }
  }
  return undefined;
}

function parseRating(value: string | undefined, fieldName: string): 1 | 2 | 3 | 4 | 5 {
  if (!value) throw new Error(`Required field "${fieldName}" is missing from feedback CSV`);
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 1 || n > 5) {
    throw new Error(`"${fieldName}" must be a number 1–5, got: "${value}"`);
  }
  return n as 1 | 2 | 3 | 4 | 5;
}

function parseWeekNumber(value: string | undefined): 1 | 2 | 3 {
  if (!value) throw new Error('Required field "Week number" is missing from feedback CSV');
  const n = parseInt(value, 10);
  if (n !== 1 && n !== 2 && n !== 3) {
    throw new Error(`"Week number" must be 1, 2, or 3, got: "${value}"`);
  }
  return n as 1 | 2 | 3;
}

export function parseFeedbackCSV(csvBuffer: Buffer): FeedbackData {
  const text = csvBuffer.toString('utf-8');
  const rows = parseCSV(text);

  if (rows.length === 0) {
    throw new Error('Feedback CSV is empty or malformed');
  }

  const row = rows[0]; // one row per feedback submission

  const weekNumberRaw = getField(row, 'Week number', 'week_number', 'WeekNumber', 'Week Number');
  const sessionsCompletedRaw = getField(row, 'Sessions completed', 'sessions_completed', 'SessionsCompleted');
  const giRatingRaw = getField(row, 'GI discomfort rating (1-5)', 'gi_rating', 'GIRating', 'GI Rating', 'GI discomfort rating');
  const energyRatingRaw = getField(row, 'Energy levels (1-5)', 'energy_rating', 'EnergyRating', 'Energy Rating', 'Energy levels');
  const adherenceRaw = getField(row, 'Did you follow the protocol? (Yes/No)', 'protocol_adherence', 'ProtocolAdherence', 'Protocol adherence', 'Did you follow the protocol?');
  const adherenceNotesRaw = getField(row, 'Adherence notes', 'adherence_notes', 'AdherenceNotes');
  const intolerableProductsRaw = getField(row, 'Intolerable products', 'intolerable_products', 'IntolerableProducts');
  const adjustmentRequestsRaw = getField(row, 'Adjustment requests', 'adjustment_requests', 'AdjustmentRequests');

  if (!sessionsCompletedRaw) {
    throw new Error('Required field "Sessions completed" is missing from feedback CSV');
  }
  if (!adherenceRaw) {
    throw new Error('Required field "Did you follow the protocol?" is missing from feedback CSV');
  }

  const intolerableProducts = intolerableProductsRaw
    ? intolerableProductsRaw.split(',').map(p => p.trim()).filter(p => p.length > 0)
    : [];

  return {
    weekNumber: parseWeekNumber(weekNumberRaw),
    sessionsCompleted: parseInt(sessionsCompletedRaw, 10) || 0,
    giRating: parseRating(giRatingRaw, 'GI discomfort rating (1-5)'),
    energyRating: parseRating(energyRatingRaw, 'Energy levels (1-5)'),
    protocolAdherence: adherenceRaw.toLowerCase().trim() === 'yes',
    adherenceNotes: adherenceNotesRaw,
    intolerableProducts,
    adjustmentRequests: adjustmentRequestsRaw,
  };
}

export type AdjustmentFlag =
  | 'SIMPLIFY_PROTOCOL'
  | 'PRODUCT_SWAP_CANDIDATE'
  | 'BLACKLIST'
  | 'REVIEW_EUPHORIA_TIMING';

export function buildAdjustmentBrief(
  feedback: FeedbackData,
  priorIterations: ProtocolIteration[]
): { adjustments: CarbAdjustment[]; flags: AdjustmentFlag[] } {
  // Get current carb target from most recent iteration
  const currentTarget = priorIterations.length > 0
    ? priorIterations[priorIterations.length - 1].cumulativeCarbTarget
    : 60; // default starting target

  const { adjustments } = applyFeedbackModifiers(currentTarget, feedback, priorIterations);

  const flags: AdjustmentFlag[] = [];

  // GI distress → PRODUCT_SWAP_CANDIDATE
  if (feedback.giRating >= 4) {
    flags.push('PRODUCT_SWAP_CANDIDATE');
  }

  // Protocol too complex → SIMPLIFY_PROTOCOL
  if (
    !feedback.protocolAdherence &&
    feedback.adherenceNotes &&
    /complex|complicated|confus|too many|hard to follow|overwhelm/i.test(feedback.adherenceNotes)
  ) {
    flags.push('SIMPLIFY_PROTOCOL');
  }

  // Energy bonk → REVIEW_EUPHORIA_TIMING
  if (feedback.energyRating <= 2) {
    flags.push('REVIEW_EUPHORIA_TIMING');
  }

  // Intolerable products → BLACKLIST
  if (feedback.intolerableProducts.length > 0) {
    flags.push('BLACKLIST');
  }

  return { adjustments, flags };
}
