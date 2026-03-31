import type { AthleteProfile, TrainingSession, QualityScore } from './types.ts';

interface FieldScore {
  field: string;
  score: 'high' | 'medium' | 'low';
  note?: string;
}

function scoreIntakeFields(profile: AthleteProfile): FieldScore[] {
  const scores: FieldScore[] = [];

  // Required fields — present and plausible
  const requiredChecks: Array<{
    field: string;
    value: unknown;
    validate?: (v: unknown) => boolean;
    plausibilityNote?: string;
  }> = [
    {
      field: 'eventType',
      value: profile.eventType,
      validate: (v) => ['ironman_140', 'ironman_70'].includes(v as string),
    },
    {
      field: 'raceDate',
      value: profile.raceDate,
      validate: (v) => {
        const d = new Date(v as string);
        return !isNaN(d.getTime());
      },
    },
    {
      field: 'bodyWeight',
      value: profile.bodyWeight,
      validate: (v) => {
        const n = v as number;
        return n > 30 && n < 200;
      },
      plausibilityNote: 'body weight outside plausible range (30–200kg)',
    },
    {
      field: 'weeklyVolume.swim',
      value: profile.weeklyVolume.swim,
      validate: (v) => {
        const n = v as number;
        return n >= 0 && n <= 30;
      },
    },
    {
      field: 'weeklyVolume.bike',
      value: profile.weeklyVolume.bike,
      validate: (v) => {
        const n = v as number;
        return n >= 0 && n <= 40;
      },
    },
    {
      field: 'weeklyVolume.run',
      value: profile.weeklyVolume.run,
      validate: (v) => {
        const n = v as number;
        return n >= 0 && n <= 25;
      },
    },
    {
      field: 'trainingPhase',
      value: profile.trainingPhase,
      validate: (v) => ['base', 'build', 'peak', 'taper'].includes(v as string),
    },
    {
      field: 'giHistory',
      value: profile.giHistory,
      validate: (v) => ['none', 'mild', 'significant'].includes(v as string),
    },
    {
      field: 'gutTrainingStatus',
      value: profile.gutTrainingStatus,
      validate: (v) => ['none', 'partial', 'trained'].includes(v as string),
    },
    {
      field: 'hasCGMData',
      value: profile.hasCGMData,
      validate: (v) => typeof v === 'boolean',
    },
  ];

  for (const check of requiredChecks) {
    if (check.value === undefined || check.value === null || check.value === '') {
      scores.push({ field: check.field, score: 'low', note: `Required field "${check.field}" is missing` });
    } else if (check.validate && !check.validate(check.value)) {
      scores.push({
        field: check.field,
        score: 'medium',
        note: check.plausibilityNote || `"${check.field}" value may be implausible: ${check.value}`,
      });
    } else {
      scores.push({ field: check.field, score: 'high' });
    }
  }

  // Optional fields — missing → low (with note)
  const optionalChecks: Array<{ field: string; value: unknown }> = [
    { field: 'historicalFinishTime', value: profile.historicalFinishTime },
    { field: 'goalFinishTime', value: profile.goalFinishTime },
    { field: 'longSessionDurations.swim', value: profile.longSessionDurations.swim },
    { field: 'longSessionDurations.bike', value: profile.longSessionDurations.bike },
    { field: 'longSessionDurations.run', value: profile.longSessionDurations.run },
    { field: 'currentCarbTarget', value: profile.currentCarbTarget },
    { field: 'sweatRate', value: profile.sweatRate },
    { field: 'heatContext', value: profile.heatContext },
    { field: 'dietaryRestrictions', value: profile.dietaryRestrictions },
    { field: 'occupation', value: profile.occupation },
    { field: 'travelFrequency', value: profile.travelFrequency },
    { field: 'coachRelationship', value: profile.coachRelationship },
  ];

  for (const check of optionalChecks) {
    if (check.value === undefined || check.value === null || check.value === '') {
      scores.push({
        field: check.field,
        score: 'low',
        note: `${check.field}: not provided — will use population estimate`,
      });
    } else {
      scores.push({ field: check.field, score: 'high' });
    }
  }

  return scores;
}

function scoreTrainingPlan(sessions: TrainingSession[]): 'high' | 'medium' | 'low' {
  if (!sessions || sessions.length === 0) return 'low';

  const hasValidDates = sessions.every(s => s.date && !isNaN(new Date(s.date).getTime()));
  const hasReasonableDurations = sessions.every(s => s.duration >= 0 && s.duration <= 600);
  const hasDiverseTypes = new Set(sessions.map(s => s.type)).size >= 2;

  if (hasValidDates && hasReasonableDurations && hasDiverseTypes && sessions.length >= 5) {
    return 'high';
  }
  if (sessions.length >= 3 && hasReasonableDurations) {
    return 'medium';
  }
  return 'low';
}

function worstScore(...scores: ('high' | 'medium' | 'low')[]): 'high' | 'medium' | 'low' {
  if (scores.includes('low')) return 'low';
  if (scores.includes('medium')) return 'medium';
  return 'high';
}

function capitalise(s: 'high' | 'medium' | 'low'): 'High' | 'Medium' | 'Low' {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as 'High' | 'Medium' | 'Low';
}

export function scoreQuality(
  profile: AthleteProfile,
  sessions: TrainingSession[]
): QualityScore {
  const fieldScores = scoreIntakeFields(profile);
  const trainingPlanScore = scoreTrainingPlan(sessions);

  const qualityScores: Record<string, 'high' | 'medium' | 'low'> = {};
  const lowConfidenceFields: string[] = [];

  for (const fs of fieldScores) {
    qualityScores[fs.field] = fs.score;
    if (fs.score !== 'high' && fs.note) {
      lowConfidenceFields.push(`⚠ ${fs.note}`);
    }
  }

  qualityScores['trainingPlan'] = trainingPlanScore;
  if (trainingPlanScore !== 'high') {
    lowConfidenceFields.push(`⚠ trainingPlan: quality is ${trainingPlanScore} — ${sessions.length} sessions parsed`);
  }

  // Overall quality = worst of intake + training plan
  const intakeWorst = worstScore(...fieldScores.map(f => f.score));
  const overallWorstRaw = worstScore(intakeWorst, trainingPlanScore);

  return {
    qualityScores,
    overallQuality: capitalise(overallWorstRaw),
    lowConfidenceFields,
  };
}

// Separate function to score just intake (without training plan)
export function scoreIntakeQuality(profile: AthleteProfile): 'High' | 'Medium' | 'Low' {
  const fieldScores = scoreIntakeFields(profile);
  const worst = worstScore(...fieldScores.map(f => f.score));
  return capitalise(worst);
}

// Separate function to score training plan quality
export function scoreTrainingPlanQuality(sessions: TrainingSession[]): 'High' | 'Medium' | 'Low' {
  return capitalise(scoreTrainingPlan(sessions));
}
