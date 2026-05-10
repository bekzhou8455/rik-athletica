// RIK Audit — Deterministic Engine
// Pure function: athlete inputs → tier recommendation + targets + gap analysis.
// No randomness. Version-stamped. Same input → same output forever.

import {
  METHODOLOGY_VERSION,
  KB_VERSION,
  STOCKLIST_VERSION,
  GUT_WEEK_CEILINGS,
  RACE_TARGETS,
  GI_FLAG_TRIGGER,
  SWEAT_RATE_TIERS,
  SODIUM_BIKE_PER_HR,
  SODIUM_RUN_PER_HR,
  bikeFluidTargetMlPerHr,
  CARBS_PER_HOUR_ESTIMATE,
  WEEKLY_HOURS_MEAN,
  PACING_LOSS_MIN_PER_G_DEFICIT,
  bodyWeightKg,
} from './methodology.js';

export const ROUTING_VERSION = '1.0.0';

// === Pure helpers ===

function weeksUntilRace(raceDate) {
  if (!raceDate) return null;
  const d = new Date(raceDate);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 7));
}

function carbsEstimate(carbsPerHour) {
  return CARBS_PER_HOUR_ESTIMATE[carbsPerHour] ?? 35;
}

function sodiumTier(sweatRate) {
  return SWEAT_RATE_TIERS[sweatRate] ?? 'SR2';
}

function carbDeficitGPerHr(athleteEstimate, raceTarget) {
  const deficit = raceTarget - athleteEstimate;
  return deficit > 0 ? deficit : 0;
}

function minutesLostRange(deficitGPerHr, raceDistance) {
  // TRACK B — RIK estimate, NOT RD-validated. Surfaced with disclaimer.
  const range = PACING_LOSS_MIN_PER_G_DEFICIT[raceDistance] ?? PACING_LOSS_MIN_PER_G_DEFICIT.other;
  const target = RACE_TARGETS[raceDistance] ?? RACE_TARGETS.other;
  const hours = target.duration_hr_typical;
  const lo = Math.round(deficitGPerHr * range[0] * hours);
  const hi = Math.round(deficitGPerHr * range[1] * hours);
  return { lo, hi };
}

// === Top-level: tier routing ===

export function routeToTier({
  weeksOut,
  giHistory,
  hasCoach,
  weeklyHours,
  carbDeficit,
  raceDistance,
}) {
  // Race-week freeze: <2 weeks → Bundle only (Sprint won't fit)
  if (weeksOut !== null && weeksOut < 2) {
    return {
      tier: 'bundle',
      label: 'Bundle (race-week protocol only)',
      reason: 'race-week-freeze',
      explanation: 'Race is inside 2 weeks. Per methodology §9, no protocol changes belong this close to race day. Bundle gives you the products to execute what your gut already knows — no new gut training.',
    };
  }

  // Strong GI history → Premium recommended (closer hand-holding)
  if (giHistory === 'often') {
    return {
      tier: 'premium',
      label: 'Premium ($1,599)',
      reason: 'gi-flagged',
      explanation: 'GI issues "often" puts you on the GI-flagged track (methodology §3.5). Premium gives you weekly RDN-reviewed adjustments through gut-training weeks instead of a one-shot protocol.',
    };
  }

  // Coached + high volume → Bundle+PDF (they execute themselves with our gear)
  if (hasCoach === 'yes' && (weeklyHours === '16-20' || weeklyHours === '20-plus')) {
    return {
      tier: 'bundle_pdf',
      label: 'Bundle + Race-Day PDF ($179)',
      reason: 'coached-high-volume',
      explanation: 'You\'ve got a coach managing training and you\'re doing the volume. You don\'t need a full Sprint — Bundle gives you the products and the PDF gives your coach the race-day fueling math.',
    };
  }

  // Tight window (2-5 weeks) with coach → Bundle+PDF (no time for Sprint's 4-week ramp)
  if (weeksOut !== null && weeksOut < 6 && hasCoach === 'yes') {
    return {
      tier: 'bundle_pdf',
      label: 'Bundle + Race-Day PDF ($179)',
      reason: 'tight-window-coached',
      explanation: 'Race is inside 6 weeks — too tight for the full 4-week gut ramp. Bundle gets the gear in your hands now and the PDF gives your coach the race-day numbers.',
    };
  }

  // Sweet spot for Sprint: 6-12 weeks out, deficit present
  if (weeksOut !== null && weeksOut >= 6 && weeksOut <= 12 && carbDeficit >= 15) {
    return {
      tier: 'sprint',
      label: 'Sprint ($569-$899)',
      reason: 'sweet-spot-deficit',
      explanation: 'You\'re 6-12 weeks out with a real fueling gap. This is exactly the window Sprint is built for — full 4-week gut ramp ending at peak race-week ceiling.',
    };
  }

  // 12+ weeks out → Sprint optional, Bundle to learn the gut first
  if (weeksOut !== null && weeksOut > 12 && carbDeficit < 15) {
    return {
      tier: 'bundle',
      label: 'Bundle ($119)',
      reason: 'long-window-low-deficit',
      explanation: 'You\'re more than 12 weeks out and your current intake isn\'t far off target. Start with Bundle to learn your gut\'s response. If you want a full prescriptive protocol closer to race week, upgrade to Sprint then.',
    };
  }

  // Default fallback: Sprint (the core product)
  return {
    tier: 'sprint',
    label: 'Sprint ($569-$899)',
    reason: 'default',
    explanation: 'Your timeline and fueling profile fit the Sprint window — 4 weeks of gut training, race-week protocol, weekly check-ins.',
  };
}

// === Top-level: full engine output ===

export function runEngine(answers) {
  const weeksOut = weeksUntilRace(answers.raceDate);
  const athleteCarbs = carbsEstimate(answers.carbsPerHour);
  const srTier = sodiumTier(answers.sweatRate);
  const distance = answers.raceDistance ?? 'other';
  const raceTargetBlock = RACE_TARGETS[distance] ?? RACE_TARGETS.other;
  // Use trained-gut ceiling midpoint as the race-day target
  const raceTargetGPerHr = Math.round((raceTargetBlock.trained_min + raceTargetBlock.trained_max) / 2);
  const deficit = carbDeficitGPerHr(athleteCarbs, raceTargetGPerHr);
  const minutesLost = minutesLostRange(deficit, distance);

  const tier = routeToTier({
    weeksOut,
    giHistory: answers.giHistory,
    hasCoach: answers.hasCoach,
    weeklyHours: answers.weeklyHours,
    carbDeficit: deficit,
    raceDistance: distance,
  });

  const giFlagged = GI_FLAG_TRIGGER.includes(answers.giHistory);
  const fluidMlPerHr = bikeFluidTargetMlPerHr(srTier);

  // Top-3 actions templated from gap analysis (used as a backstop if AI draft fails)
  const topActions = buildTopActions({
    deficit,
    giFlagged,
    weeksOut,
    raceTargetGPerHr,
  });

  return {
    routing_version: ROUTING_VERSION,
    methodology_version: METHODOLOGY_VERSION,
    kb_version: KB_VERSION,
    stocklist_version: STOCKLIST_VERSION,
    inputs_summary: {
      race_distance: distance,
      weeks_out: weeksOut,
      weekly_hours: answers.weeklyHours,
      gi_history: answers.giHistory,
      has_coach: answers.hasCoach,
      sweat_rate: answers.sweatRate,
      body_weight_kg: bodyWeightKg(answers.bodyWeight, answers.weightUnit),
      brands: answers.brands ?? [],
    },
    tier_recommendation: tier,
    track_a: {
      // RD-covered numbers from v3.1 — Emily citation safe here
      gut_week_ceilings: GUT_WEEK_CEILINGS,
      race_day_target_g_per_hr: raceTargetGPerHr,
      race_day_target_range: [raceTargetBlock.trained_min, raceTargetBlock.trained_max],
      sodium_tier: srTier,
      sodium_bike_mg_per_hr: SODIUM_BIKE_PER_HR[srTier],
      sodium_run_mg_per_hr: SODIUM_RUN_PER_HR[srTier],
      bike_fluid_ml_per_hr: fluidMlPerHr,
      gi_flagged: giFlagged,
    },
    track_b: {
      // RIK estimate — disclaimer required, no Emily citation
      athlete_carbs_per_hour_estimate: athleteCarbs,
      carb_deficit_g_per_hour: deficit,
      minutes_lost_estimate: minutesLost,
      race_duration_hr_typical: raceTargetBlock.duration_hr_typical,
    },
    top_actions: topActions,
  };
}

function buildTopActions({ deficit, giFlagged, weeksOut, raceTargetGPerHr }) {
  const actions = [];

  if (deficit >= 30) {
    actions.push({
      priority: 1,
      title: 'Close the carb gap',
      detail: `Current intake estimate is ${deficit} g/hr below race-day target (${raceTargetGPerHr} g/hr). Start gut training at Week 1 ceiling (40 g/hr) and ramp weekly per §2.1.`,
    });
  } else if (deficit >= 15) {
    actions.push({
      priority: 1,
      title: 'Lift carbs to race target',
      detail: `You're ${deficit} g/hr short of race-day target. Two-to-three week gut ramp gets you there.`,
    });
  } else {
    actions.push({
      priority: 1,
      title: 'Lock in race-day delivery',
      detail: `Carb intake is roughly on target — focus shifts to consistent delivery vehicle, sodium, and fluid.`,
    });
  }

  if (giFlagged) {
    actions.push({
      priority: 2,
      title: 'Switch to GI-flagged products',
      detail: 'Maurten DM160 (Wk1) → DM320 (Wk2-4). Hydrogel format is what gets you to target without GI events.',
    });
  } else {
    actions.push({
      priority: 2,
      title: 'Add tested products to your kit',
      detail: 'Use SiS Beta Fuel + Maurten gels per §3. Test in training, not on race day.',
    });
  }

  if (weeksOut !== null && weeksOut < 6) {
    actions.push({
      priority: 3,
      title: 'Tighten race-week execution',
      detail: 'Inside 6 weeks — focus on race-week tapering and pre-session meal (§8). No new products in the final 14 days.',
    });
  } else {
    actions.push({
      priority: 3,
      title: 'Book your gut-training weeks',
      detail: 'Pick 1 long bike + 1 long run per week as gut-training sessions. Practice race-day intake, race-day products.',
    });
  }

  return actions;
}
