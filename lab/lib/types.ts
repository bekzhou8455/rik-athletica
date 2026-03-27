// ── Programme Config ──────────────────────────────────────────────────────────
export const PROGRAMME_CONFIG = {
  WEEKS: 4,
  CHECKINS_PER_WEEK: 1,
  MAX_REVISION_LOOPS: 3,
  NO_NEW_PRODUCTS_WEEKS_BEFORE_RACE: 4, // absolute rule
} as const;

// ── Core Athlete Types ────────────────────────────────────────────────────────

export interface AthleteProfile {
  // Identity
  athleteId: string; // lowercase-hyphenated slug e.g. "sarah-jones"
  name: string;

  // Race Profile
  eventType: 'ironman_140' | 'ironman_70';
  raceDate: string; // ISO date
  historicalFinishTime?: string;
  goalFinishTime?: string;

  // Training Load
  weeklyVolume: { swim: number; bike: number; run: number }; // hours
  longSessionDurations: { swim?: number; bike?: number; run?: number }; // minutes
  trainingPhase: 'base' | 'build' | 'peak' | 'taper';

  // Current Fueling
  currentProducts: string[];
  currentCarbTarget?: number; // g/hr
  giHistory: 'none' | 'mild' | 'significant';
  hasGutTrained: boolean;

  // Physiological
  bodyWeight: number; // kg
  sweatRate?: number; // mL/hr (self-reported)
  heatContext?: string;
  hasCGMData: boolean;

  // Dietary
  dietaryRestrictions?: string;

  // Lifestyle
  occupation?: string;
  travelFrequency?: string;
  coachRelationship?: string;

  // Data quality per field
  qualityScores: Record<string, 'high' | 'medium' | 'low'>;
}

export interface TrainingSession {
  date: string; // ISO date
  type: 'swim' | 'bike' | 'run' | 'brick' | 'rest';
  duration: number; // minutes
  intensity: 'easy' | 'moderate' | 'hard' | 'race-sim';
  description?: string;
}

// ── Protocol Draft Types ──────────────────────────────────────────────────────

export interface SessionCarbTarget {
  sessionType: 'swim' | 'bike' | 'run' | 'brick' | 'race';
  carbsPerHour: number;
  notes?: string;
}

export interface SessionProtocol {
  date: string;
  sessionType: 'swim' | 'bike' | 'run' | 'brick' | 'rest';
  duration: number; // minutes
  carbTarget: number; // g/hr
  euphoriaPreSession: boolean;
  euphoriaTimingMinutes?: number; // minutes before start
  refuelIntra: boolean;
  refuelTimingMinutes?: number[]; // minutes into session
  refuelPost: boolean;
  thirdPartyProducts: string[];
  notes?: string;
}

export interface WeeklyProtocol {
  weekNumber: 1 | 2 | 3 | 4;
  phase: string;
  sessions: SessionProtocol[];
  weeklyNotes?: string;
}

export interface RaceDayEvent {
  hourMark: number; // hours into race
  kmMark?: number;
  description: string;
  products: string[];
  carbsConsumed?: number; // g
  fluidsMl?: number;
}

export interface ProtocolDraft {
  athleteId: string;
  generatedAt: string;
  weeksGenerated: number; // 4 (or 12 when extended)
  carbTargets: SessionCarbTarget[];
  weeklySchedule: WeeklyProtocol[];
  raceDayPlan: RaceDayEvent[];
  assumptionFlags: string[]; // low-confidence field warnings
  thirdPartyRecommendations: string[];
  rawMarkdown?: string; // the raw markdown from Architect AI
}

// ── Audit Types ───────────────────────────────────────────────────────────────

export interface AuditIssue {
  dimension: 'scientificAccuracy' | 'catastrophicOutcomeCheck' | 'productSpecCompliance' | 'coherenceAndCompleteness';
  severity: 'FLAG' | 'FAIL';
  description: string;
  affectedSection?: string;
}

export interface AuditVerdict {
  outcome: 'PASS' | 'FLAG' | 'FAIL';
  dimensionScores: {
    scientificAccuracy: 'PASS' | 'FLAG' | 'FAIL';
    catastrophicOutcomeCheck: 'PASS' | 'FLAG' | 'FAIL';
    productSpecCompliance: 'PASS' | 'FLAG' | 'FAIL';
    coherenceAndCompleteness: 'PASS' | 'FLAG' | 'FAIL';
  };
  issues: AuditIssue[];
  revisionBrief?: string; // populated on FLAG, to pass back to Architect
}

// ── Iteration Types ───────────────────────────────────────────────────────────

export interface FeedbackData {
  weekNumber: 1 | 2 | 3;
  sessionsCompleted: number; // of planned sessions
  giRating: 1 | 2 | 3 | 4 | 5; // 1=no issues, 5=severe GI distress
  energyRating: 1 | 2 | 3 | 4 | 5; // 1=bonking/crashing, 5=excellent
  protocolAdherence: boolean;
  adherenceNotes?: string;
  intolerableProducts: string[]; // product names to blacklist going forward
  adjustmentRequests?: string; // free text from athlete
}

export interface CarbAdjustment {
  reason: 'gi_distress' | 'gi_progress' | 'energy_bonk' | 'adherence_simplify' | 'product_intolerance';
  delta: number; // g/hr change (negative = reduction)
  description: string; // human-readable rationale for Bek
  affectedSessions: ('swim' | 'bike' | 'run' | 'brick' | 'race')[];
}

export interface ProtocolIteration {
  iterationNumber: 0 | 1 | 2 | 3;
  weekCovered: 1 | 2 | 3 | 'race';
  feedbackInput?: FeedbackData; // undefined for iteration 0 (initial build)
  trainingPlanInput?: TrainingSession[]; // undefined for iteration 3 (race week — no new plan)
  adjustmentsApplied: CarbAdjustment[]; // empty for iteration 0
  cumulativeCarbTarget: number; // g/hr entering this iteration (after all adjustments)
  blacklistedProducts: string[]; // cumulative list — grows across iterations
  draft: ProtocolDraft;
  verdict: AuditVerdict;
  humanDecision: 'approved' | 'escalated';
  exportedAt: string;
}

// ── Session State ─────────────────────────────────────────────────────────────

export interface SessionState {
  athleteId: string;
  step:
    | 'uploaded'
    | 'parsed'
    | 'flagged'
    | 'generating'
    | 'auditing'
    | 'review'
    | 'approved'
    | 'exported'
    | 'awaiting_feedback';
  currentIteration: 0 | 1 | 2 | 3;
  intake: AthleteProfile | null;
  sessions: TrainingSession[] | null; // current week's training sessions
  redFlags: string[];
  iterations: ProtocolIteration[]; // completed + approved iterations; grows 0→3
  // Working state for current iteration (cleared on approval, persisted in iterations[])
  currentDraft: ProtocolDraft | null;
  currentVerdict: AuditVerdict | null;
  revisionCount: number;
  humanDecision: 'pending' | 'approved' | 'escalated' | null;
}

// ── Quality Scoring ───────────────────────────────────────────────────────────

export interface QualityScore {
  qualityScores: Record<string, 'high' | 'medium' | 'low'>;
  overallQuality: 'High' | 'Medium' | 'Low';
  lowConfidenceFields: string[];
}

// ── Red Flag Result ───────────────────────────────────────────────────────────

export interface RedFlagResult {
  blocked: boolean;
  flags: string[];
  reason?: string;
}
