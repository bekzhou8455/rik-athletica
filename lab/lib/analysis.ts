// lib/analysis.ts
// Fueling minutes-lost analysis — computes how much time the athlete likely lost
// in their last race due to suboptimal carbohydrate intake.
//
// Three confidence tiers:
//   insufficient_data — no race history at all (first-timer or no data provided)
//   low              — intake questionnaire only (current carb target vs bracket floor)
//   medium           — intake + self-reported finish time
//   high             — intake + splits CSV (run pace collapse attributable to fueling)
//
// Non-blocking: always returns a result; pipeline continues regardless of confidence tier.

import type { AthleteProfile } from './types.ts';
import type { RaceSplits } from './split-parser.ts';

export interface FuelingDiagnosis {
  minutesLost: number | null;       // null on insufficient_data
  confidence: 'insufficient_data' | 'low' | 'medium' | 'high';
  deficitBracket: string;           // e.g. "50g/hr vs recommended 70–80g/hr"
  explanation: string;              // 2–4 sentences for the Architect AI context
}

// ── Literature constants ───────────────────────────────────────────────────────

// Fraction of run time degradation attributable to fueling deficit (Coyle 2004,
// Stellingwerff 2011 consensus): moderate under-fueling accounts for ~40% of
// late-race pace decline vs training pace in athletes running >3hr total.
const FUELING_ATTRIBUTION_FRACTION = 0.40;

// Expected run pace degradation when fueling is optimal vs. sub-optimal:
// ~8–12% slower in the second half of the run for athletes fueling at bracket floor
// vs. ceiling. We use 10% as the working estimate.
const PACE_DEGRADATION_OPTIMAL_DEFICIT = 0.10;

// Bracket reference by event (g/hr)
const BRACKETS: Record<string, { floor: number; ceiling: number; runFloor: number; runCeiling: number }> = {
  ironman_140: { floor: 70, ceiling: 90, runFloor: 45, runCeiling: 60 },
  ironman_70:  { floor: 60, ceiling: 80, runFloor: 40, runCeiling: 60 },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseFinishMinutes(raw: string): number | null {
  // Accepts "12h", "12:30", "12h30m", "750" (minutes)
  const hm = raw.match(/(\d+)\s*h(?:ours?)?[:\s]*(\d+)?(?:m|min)?/i);
  if (hm) return parseInt(hm[1]) * 60 + (parseInt(hm[2]) || 0);
  const colon = raw.match(/^(\d+):(\d{2})$/);
  if (colon) return parseInt(colon[1]) * 60 + parseInt(colon[2]);
  const mins = parseFloat(raw);
  return isNaN(mins) ? null : mins;
}

// ── Main analysis ──────────────────────────────────────────────────────────────

export function analyseRaceFueling(
  profile: AthleteProfile,
  splits: RaceSplits | null,
): FuelingDiagnosis {
  const bracket = BRACKETS[profile.eventType] ?? BRACKETS.ironman_140;
  const currentTarget = profile.currentCarbTarget ?? 0;

  // No race history at all
  if (!profile.historicalFinishTime && !splits) {
    return {
      minutesLost: null,
      confidence: 'insufficient_data',
      deficitBracket: `Current intake unknown or first race — target bracket: ${bracket.floor}–${bracket.ceiling}g/hr bike, ${bracket.runFloor}–${bracket.runCeiling}g/hr run`,
      explanation:
        `No prior race data provided. Cannot quantify fueling-induced time loss. ` +
        `Protocol will target the mid-bracket (${Math.round((bracket.floor + bracket.ceiling) / 2)}g/hr bike) ` +
        `adjusted for GI history and gut training status.`,
    };
  }

  // Compute carb deficit
  const midBracket = (bracket.floor + bracket.ceiling) / 2;
  const deficit = Math.max(0, midBracket - currentTarget); // g/hr below mid-bracket

  // ── HIGH confidence: splits available ────────────────────────────────────────
  if (splits) {
    // Run pace collapse: compare expected vs actual run split
    // Expected run for an athlete at this finish time based on typical IM run splits
    // (run ≈ 37% of finish for full IM, 34% for 70.3 — Ironman median data)
    const runFraction = splits.distanceKm > 150 ? 0.37 : 0.34;
    const totalMins = splits.finishMins;
    const expectedRunMins = totalMins * runFraction;
    const actualRunMins = splits.runMins;
    const runSlowdown = Math.max(0, actualRunMins - expectedRunMins); // extra minutes on run

    // Attribution: fueling accounts for FUELING_ATTRIBUTION_FRACTION of run slowdown
    const fuelingMinutes = Math.round(runSlowdown * FUELING_ATTRIBUTION_FRACTION);

    return {
      minutesLost: fuelingMinutes,
      confidence: 'high',
      deficitBracket: `${currentTarget}g/hr vs recommended ${bracket.floor}–${bracket.ceiling}g/hr bike`,
      explanation:
        `Race splits show a ${Math.round(runSlowdown)}min run deficit vs expected pace ` +
        `(${Math.round(splits.bikeMins)}min bike / ${Math.round(splits.runMins)}min run). ` +
        `Based on literature (Coyle 2004; Stellingwerff 2011), fueling deficit accounts for ` +
        `approximately ${Math.round(FUELING_ATTRIBUTION_FRACTION * 100)}% of late-race pace collapse, ` +
        `estimated at ~${fuelingMinutes} minutes lost. ` +
        `Current intake (${currentTarget}g/hr) is ${deficit > 0 ? `${Math.round(deficit)}g/hr below mid-bracket` : 'at or above mid-bracket'}.`,
    };
  }

  // ── MEDIUM confidence: self-reported finish time ──────────────────────────────
  const finishMins = parseFinishMinutes(profile.historicalFinishTime!);
  if (finishMins) {
    // Estimate minutes lost from fueling deficit using pace degradation model
    // Run makes up ~37% of IM finish time. A 10% pace deficit on the run = 3.7% of total time.
    // Scale by how far below mid-bracket the athlete is (deficit/midBracket).
    const runMins = finishMins * (splits?.distanceKm ?? 226 > 150 ? 0.37 : 0.34);
    const deficitFraction = deficit > 0 ? deficit / midBracket : 0;
    const fuelingMinutes = Math.round(runMins * PACE_DEGRADATION_OPTIMAL_DEFICIT * deficitFraction);

    return {
      minutesLost: fuelingMinutes,
      confidence: 'medium',
      deficitBracket: `${currentTarget}g/hr vs recommended ${bracket.floor}–${bracket.ceiling}g/hr bike`,
      explanation:
        `Athlete reported a ${profile.historicalFinishTime} finish. ` +
        `Current carb intake (${currentTarget}g/hr) is ${Math.round(deficit)}g/hr below the mid-bracket target. ` +
        `Applying a 10% run-pace degradation model for sub-optimal fueling, ` +
        `estimated time loss from fueling deficit: ~${fuelingMinutes} minutes. ` +
        `Upload race splits for a higher-confidence estimate.`,
    };
  }

  // ── LOW confidence: intake data only ─────────────────────────────────────────
  const fuelingMinutes = deficit > 0
    ? Math.round(deficit * 0.5)   // rough heuristic: ~0.5 min lost per g/hr deficit
    : 0;

  return {
    minutesLost: fuelingMinutes,
    confidence: 'low',
    deficitBracket: `${currentTarget}g/hr vs recommended ${bracket.floor}–${bracket.ceiling}g/hr bike`,
    explanation:
      `Current carb intake (${currentTarget}g/hr) is ${Math.round(deficit)}g/hr below the ` +
      `mid-bracket target for ${profile.eventType === 'ironman_140' ? 'Ironman 140.6' : 'Ironman 70.3'}. ` +
      `Estimated fueling-induced time loss: ~${fuelingMinutes} minutes (low confidence — no race data). ` +
      `Provide a historical finish time or race splits CSV to improve this estimate.`,
  };
}
