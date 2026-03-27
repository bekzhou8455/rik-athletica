import type {
  AthleteProfile,
  TrainingSession,
  FeedbackData,
  ProtocolIteration,
  CarbAdjustment,
} from './types.ts';

// Hard limits
const CARB_FLOOR = 30; // g/hr minimum
const CARB_CEILING_NON_RACE = 90; // g/hr maximum for non-race sessions

/**
 * Calculate base carb target for a single training session.
 * Uses: duration bucket → GI history modifier → gut training modifier
 */
export function calculateBaseTarget(
  session: TrainingSession,
  profile: AthleteProfile
): number {
  const { duration, type, intensity } = session;

  // Sessions under 60min: no intra-session carbs needed
  if (duration < 60) {
    return 0;
  }

  let baseTarget: number;

  // 60–90 minutes: moderate carbs
  if (duration <= 90) {
    baseTarget = 35; // midpoint of 30–40g/hr range
  } else {
    // >90 minutes: intensity-adjusted target
    if (intensity === 'race-sim' || type === 'brick') {
      // Race-sim / brick: use race-day targets
      if (profile.eventType === 'ironman_140') {
        if (type === 'bike' || type === 'brick') {
          baseTarget = 80; // ironman bike: 70–90 → midpoint 80
        } else {
          baseTarget = 52; // ironman run: 45–60 → midpoint 52
        }
      } else {
        // 70.3
        if (type === 'bike' || type === 'brick') {
          baseTarget = 70; // 70.3 bike: 60–80 → midpoint 70
        } else {
          baseTarget = 50; // 70.3 run: 40–60 → midpoint 50
        }
      }
    } else {
      // Non-race-day long sessions
      baseTarget = 75; // midpoint of 60–90 MTC range
    }
  }

  // Apply GI history modifier
  if (profile.giHistory === 'significant') {
    baseTarget -= 10;
  } else if (profile.giHistory === 'mild') {
    baseTarget -= 5;
  }

  // Apply gut training modifier (stacks with GI history)
  if (!profile.hasGutTrained) {
    baseTarget -= 10;
  }

  // Enforce floor
  baseTarget = Math.max(baseTarget, CARB_FLOOR);

  // Enforce ceiling (non-race)
  if (intensity !== 'race-sim') {
    baseTarget = Math.min(baseTarget, CARB_CEILING_NON_RACE);
  }

  return Math.round(baseTarget);
}

/**
 * Apply feedback modifiers to the current carb target.
 * Returns the new target and a list of adjustments applied.
 */
export function applyFeedbackModifiers(
  currentTarget: number,
  feedback: FeedbackData,
  priorIterations: ProtocolIteration[]
): { newTarget: number; adjustments: CarbAdjustment[] } {
  const adjustments: CarbAdjustment[] = [];
  let delta = 0;

  // Rule 1: GI distress (giRating 4–5) → -10g/hr
  // Rule 2: Energy bonk (energyRating 1–2) → +10g/hr
  // GI distress WINS if both apply (safety priority)
  const hasGIDistress = feedback.giRating >= 4;
  const hasEnergyBonk = feedback.energyRating <= 2;

  if (hasGIDistress) {
    delta -= 10;
    adjustments.push({
      reason: 'gi_distress',
      delta: -10,
      description: `GI distress reported (rating ${feedback.giRating}/5) — reducing carb target by 10g/hr`,
      affectedSessions: ['bike', 'run', 'brick'],
    });
    // Also flag product swap candidate (noted in description, Architect handles)
  } else if (hasEnergyBonk) {
    // Only apply energy bonk if no GI distress
    delta += 10;
    adjustments.push({
      reason: 'energy_bonk',
      delta: 10,
      description: `Energy bonking reported (rating ${feedback.energyRating}/5) — increasing carb target by 10g/hr`,
      affectedSessions: ['bike', 'run', 'brick'],
    });
  }

  // Rule 3: Progressive GI progress — requires 2 consecutive low GI ratings
  // giRating 1–2 this week AND giRating 1–2 in the prior iteration
  if (!hasGIDistress && feedback.giRating <= 2) {
    const priorFeedback = priorIterations.length > 0
      ? priorIterations[priorIterations.length - 1].feedbackInput
      : null;

    if (priorFeedback && priorFeedback.giRating <= 2) {
      delta += 5;
      adjustments.push({
        reason: 'gi_progress',
        delta: 5,
        description: `Progressive GI tolerance detected (rating ≤2 for 2 consecutive weeks) — increasing carb target by 5g/hr toward MTC`,
        affectedSessions: ['bike', 'run', 'brick'],
      });
    }
  }

  // Rule 4: Protocol too complex (non-adherent + complexity mention)
  if (
    !feedback.protocolAdherence &&
    feedback.adherenceNotes &&
    /complex|complicated|confus|too many|hard to follow|overwhelm/i.test(feedback.adherenceNotes)
  ) {
    // No delta — just a flag for the Architect to simplify
    adjustments.push({
      reason: 'adherence_simplify',
      delta: 0,
      description: `Protocol adherence issues (complexity noted) — Architect should simplify next iteration`,
      affectedSessions: ['swim', 'bike', 'run', 'brick'],
    });
  }

  // Rule 5: Intolerable product → blacklist + substitute (no carb delta)
  if (feedback.intolerableProducts.length > 0) {
    adjustments.push({
      reason: 'product_intolerance',
      delta: 0,
      description: `Products blacklisted: ${feedback.intolerableProducts.join(', ')} — Architect must find substitutes`,
      affectedSessions: ['swim', 'bike', 'run', 'brick', 'race'],
    });
  }

  let newTarget = currentTarget + delta;

  // Enforce floor
  newTarget = Math.max(newTarget, CARB_FLOOR);

  // Enforce ceiling (non-race)
  newTarget = Math.min(newTarget, CARB_CEILING_NON_RACE);

  return { newTarget: Math.round(newTarget), adjustments };
}
