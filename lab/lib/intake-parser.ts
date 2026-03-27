import type { AthleteProfile } from './types.ts';

// Simple CSV parser — handles quoted fields
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

function parseYesNo(value: string): boolean {
  const v = value.toLowerCase().trim();
  return v === 'yes' || v.startsWith('yes');
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function parseEventType(value: string): 'ironman_140' | 'ironman_70' {
  const normalized = value.toLowerCase();
  if (normalized.includes('70.3') || normalized.includes('70_3') || normalized.includes('half')) {
    return 'ironman_70';
  }
  return 'ironman_140';
}

function parseTrainingPhase(value: string): 'base' | 'build' | 'peak' | 'taper' {
  const normalized = value.toLowerCase().trim();
  if (normalized.includes('taper') || normalized.includes('race week')) return 'taper';
  if (normalized.includes('peak') || normalized.includes('race sim')) return 'peak';
  if (normalized.includes('build') || normalized.includes('race-specific') || normalized.includes('race specific')) return 'build';
  if (normalized.includes('base') || normalized.includes('aerobic')) return 'base';
  return 'base';
}

function parseGIHistory(value: string): 'none' | 'mild' | 'significant' {
  const normalized = value.toLowerCase().trim();
  if (normalized === '' || normalized === 'none' || normalized.includes('never') || normalized.startsWith('no')) return 'none';
  if (normalized.includes('significant') || normalized.includes('severe') || normalized.includes('frequent')) return 'significant';
  return 'mild'; // "Occasionally, minor" and similar
}

// Parse text ranges to hours: "12–15 hours" → 13.5, "Over 2 hours" → 2.25
function parseHoursRange(text: string): number {
  const normalized = text.toLowerCase().replace(/\u2013|\u2014/g, '-');
  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*h/);
  if (rangeMatch) return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
  const overMatch = normalized.match(/(?:over|more than)\s*(\d+(?:\.\d+)?)\s*h/);
  if (overMatch) return parseFloat(overMatch[1]) + 0.25;
  const lessMatch = normalized.match(/less than\s*(\d+(?:\.\d+)?)\s*h/);
  if (lessMatch) return parseFloat(lessMatch[1]) * 0.75;
  const singleMatch = normalized.match(/(\d+(?:\.\d+)?)\s*h/);
  if (singleMatch) return parseFloat(singleMatch[1]);
  return 1; // fallback
}

function parseHoursRangeToMinutes(text: string): number {
  return Math.round(parseHoursRange(text) * 60);
}

// Parse carb ranges: "40–60g/hour" → 50, "60–90" → 75
function parseCarbRange(text: string): number | undefined {
  const normalized = text.toLowerCase().replace(/\u2013|\u2014/g, '-');
  const rangeMatch = normalized.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
  const singleMatch = normalized.match(/(\d+)/);
  if (singleMatch) return parseFloat(singleMatch[1]);
  return undefined;
}

// Map sweat rate text → approximate mL/hr
function parseSweatRate(text: string): number | undefined {
  const normalized = text.toLowerCase();
  if (normalized.includes('heavy') || normalized.includes('saturated')) return 1500;
  if (normalized.includes('moderate') || normalized.includes('noticeable')) return 1000;
  if (normalized.includes('light') || normalized.includes('minimal')) return 600;
  return undefined;
}

// Parse body weight — strip units, convert lbs→kg if needed
function parseBodyWeight(text: string): number {
  const normalized = text.toLowerCase().trim();
  if (normalized.includes('lb')) {
    const match = normalized.match(/(\d+(?:\.\d+)?)/);
    if (match) return Math.round(parseFloat(match[1]) * 0.453592);
  }
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (match) return parseFloat(match[1]);
  throw new Error(`Cannot parse body weight from: "${text}"`);
}

// Combine all checked dietary restriction columns into a single string
function parseDietaryRestrictions(row: Record<string, string>): string | undefined {
  const columns = ['Gluten / wheat', 'Dairy / lactose', 'Soy', 'Tree nuts', 'Fructose malabsorption'];
  const otherKey = Object.keys(row).find(k =>
    k.toLowerCase().includes('other food allergy') || k.toLowerCase().includes('other food intolerance')
  ) ?? '';
  const found = columns.filter(col => row[col] && row[col].trim().length > 0);
  const other = otherKey && row[otherKey] ? row[otherKey].trim() : '';
  if (other) found.push(other);
  return found.length > 0 ? found.join(', ') : undefined;
}

// Infer gut-training status from intra-session fueling columns
function inferGutTrained(row: Record<string, string>): boolean {
  const fueled = ['Gels', 'Chews or bars', 'A combination of the above', 'Electrolyte mix / sports drink',
    'Real food (banana, rice cakes, dates, etc.)'];
  return fueled.some(col => row[col] && row[col].trim().length > 0);
}

export function parseIntakeCSV(csvText: string): AthleteProfile {
  const rows = parseCSV(csvText);

  if (rows.length === 0) {
    throw new Error('Intake CSV is empty or malformed');
  }

  const row = rows[0]; // Typeform produces one row per submission

  // Extract athlete name
  const nameValue =
    row['Full Name'] ||
    row['Name'] ||
    row['name'] ||
    row['Full name'] ||
    Object.values(row)[0] ||
    'unknown-athlete';

  const athleteId = slugify(nameValue);
  const name = nameValue;

  // Required field helpers
  function requireField(fieldName: string, aliases: string[]): string {
    for (const alias of [fieldName, ...aliases]) {
      if (row[alias] !== undefined && row[alias] !== '') {
        return row[alias];
      }
    }
    throw new Error(`Required field "${fieldName}" is missing from intake CSV`);
  }

  function optionalField(fieldName: string, aliases: string[]): string | undefined {
    for (const alias of [fieldName, ...aliases]) {
      if (row[alias] !== undefined && row[alias] !== '') {
        return row[alias];
      }
    }
    return undefined;
  }

  // ── Required fields ──────────────────────────────────────────────────────────

  const eventTypeRaw = requireField('Event type (IRONMAN/70.3)', [
    'What distance are you racing?',
    'Event type', 'event_type', 'EventType',
  ]);

  const raceDate = requireField('Race date', [
    'What is your race date?',
    'race_date', 'RaceDate', 'Race Date',
  ]);

  const trainingPhaseRaw = requireField('Training phase', [
    'What training phase are you currently in?',
    'training_phase', 'TrainingPhase', 'Training Phase',
  ]);

  const bodyWeightRaw = requireField('Body weight (kg)', [
    'What is your current body weight? (Please specify units: kg or lbs)',
    'body_weight_kg', 'BodyWeight', 'Body Weight (kg)', 'body weight (kg)',
  ]);
  const bodyWeight = parseBodyWeight(bodyWeightRaw);

  const giHistoryRaw = requireField('GI history', [
    'Have you experienced GI issues (nausea, bloating, cramping, reflux, urgent bathroom stops) during training or racing?',
    'gi_history', 'GIHistory', 'GI History',
  ]);

  const hasCGMRaw = requireField('CGM data available?', [
    'Do you train with a continuous glucose monitor (CGM)?',
    'cgm_data', 'CGMData', 'CGM Data Available?', 'hasCGMData',
  ]);

  // ── Weekly volume — derive from total hours if per-discipline not provided ──

  const totalHoursRaw = optionalField('Total training hours per week right now', [
    'total_training_hours', 'TotalTrainingHours',
  ]);
  const totalHours = totalHoursRaw ? parseHoursRange(totalHoursRaw) : 10;

  // Try explicit per-discipline fields first; fall back to total-hours estimate
  const weeklySwimRaw = optionalField('Weekly swim volume (hours)', ['weekly_swim_hours', 'WeeklySwim']);
  const weeklyBikeRaw = optionalField('Weekly bike volume (hours)', ['weekly_bike_hours', 'WeeklyBike']);
  const weeklyRunRaw  = optionalField('Weekly run volume (hours)', ['weekly_run_hours', 'WeeklyRun']);

  const weeklySwim = weeklySwimRaw ? parseFloat(weeklySwimRaw) : parseFloat((totalHours * 0.15).toFixed(1));
  const weeklyBike = weeklyBikeRaw ? parseFloat(weeklyBikeRaw) : parseFloat((totalHours * 0.55).toFixed(1));
  const weeklyRun  = weeklyRunRaw  ? parseFloat(weeklyRunRaw)  : parseFloat((totalHours * 0.30).toFixed(1));

  // ── Long session durations ──────────────────────────────────────────────────

  const longestBikeRaw = optionalField('Longest bike session per week (duration)', [
    'Longest bike session (minutes)', 'longest_bike_min', 'LongestBike',
  ]);
  const longestRunRaw = optionalField('Longest run session per week (duration)', [
    'Longest run session (minutes)', 'longest_run_min', 'LongestRun',
  ]);
  const longestSwimRaw = optionalField('Longest swim session (minutes)', [
    'longest_swim_min', 'LongestSwim',
  ]);

  const longestBike = longestBikeRaw ? parseHoursRangeToMinutes(longestBikeRaw) : undefined;
  const longestRun  = longestRunRaw  ? parseHoursRangeToMinutes(longestRunRaw)  : undefined;
  const longestSwim = longestSwimRaw ? parseHoursRangeToMinutes(longestSwimRaw) : undefined;

  // ── Optional fields ─────────────────────────────────────────────────────────

  const historicalFinishTime = optionalField('Historical finish time', [
    'In your most recent Ironman 140.6, what was your approximate finish time? (or \'DNS/DNF\')',
    'In your most recent 70.3, what was your approximate finish time? (or \'DNS/DNF\')',
    'historical_finish_time', 'HistoricalFinishTime',
  ]);

  const goalFinishTime = optionalField('Goal finish time', [
    'What is your primary goal for this race?',
    'goal_finish_time', 'GoalFinishTime', 'Goal Finish Time',
  ]);

  const currentProductsRaw = optionalField('Current products used', [
    'Which carbohydrate brand(s) do you currently use for long sessions or racing?',
    'current_products', 'CurrentProducts', 'Current Products Used',
  ]);
  const currentProducts = currentProductsRaw
    ? currentProductsRaw.split(',').map(p => p.trim()).filter(p => p.length > 0)
    : [];

  const currentCarbTargetRaw = optionalField('Current carb target (g/hr)', [
    'Approximately how many grams of carbohydrate per hour do you target during long sessions?',
    'current_carb_target', 'CurrentCarbTarget', 'Current Carb Target (g/hr)',
  ]);
  const currentCarbTarget = currentCarbTargetRaw ? parseCarbRange(currentCarbTargetRaw) : undefined;

  const sweatRateRaw = optionalField('Sweat rate (mL/hr)', [
    'How would you describe your sweat rate during hard sessions?',
    'sweat_rate', 'SweatRate', 'Sweat Rate (mL/hr)',
  ]);
  const sweatRate = sweatRateRaw ? parseSweatRate(sweatRateRaw) : undefined;

  const heatContext = optionalField('Heat context', [
    'How does your performance change in heat (above 25°C / 77°F)?',
    'heat_context', 'HeatContext', 'Heat Context',
  ]);

  const dietaryRestrictions = parseDietaryRestrictions(row);

  const occupation = optionalField('Occupation', ['occupation']);

  const travelFrequency = optionalField('Travel frequency', [
    'Do you have significant travel planned during the 4 weeks of this programme?',
    'travel_frequency', 'TravelFrequency', 'Travel Frequency',
  ]);

  const coachRelationship = optionalField('Coach relationship', [
    'Do you currently work with a triathlon coach?',
    'coach_relationship', 'CoachRelationship', 'Coach Relationship',
  ]);

  // Gut trained — infer from intra-session fueling if no explicit field
  const hasGutTrainedRaw = optionalField('Gut trained?', [
    'gut_trained', 'GutTrained', 'Gut Trained?', 'Has gut trained?',
  ]);
  const hasGutTrained = hasGutTrainedRaw !== undefined
    ? parseYesNo(hasGutTrainedRaw)
    : inferGutTrained(row);

  const profile: AthleteProfile = {
    athleteId,
    name,
    eventType: parseEventType(eventTypeRaw),
    raceDate,
    historicalFinishTime,
    goalFinishTime,
    weeklyVolume: {
      swim: weeklySwim,
      bike: weeklyBike,
      run: weeklyRun,
    },
    longSessionDurations: {
      swim: longestSwim,
      bike: longestBike,
      run: longestRun,
    },
    trainingPhase: parseTrainingPhase(trainingPhaseRaw),
    currentProducts,
    currentCarbTarget,
    giHistory: parseGIHistory(giHistoryRaw),
    hasGutTrained,
    bodyWeight,
    sweatRate,
    heatContext,
    hasCGMData: parseYesNo(hasCGMRaw),
    dietaryRestrictions,
    occupation,
    travelFrequency,
    coachRelationship,
    qualityScores: {}, // will be populated by quality-scorer
  };

  return profile;
}
