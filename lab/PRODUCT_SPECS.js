// LOCKED — DO NOT EDIT — Single source of truth for RIK Athletica product specifications.
// Changes to these specs require product reformulation sign-off from Bek Zhou.
// Last verified: 2026-03-26

export const PRODUCT_SPECS = {
  EUPHORIA: {
    format: 'tear-open RTD liquid gel',
    carbohydrates_g: 11,
    sugar_g: 0,
    sugar_alcohol_g: 2.6,
    caffeine_mg: 100,
    caffeine_source: 'standardised Yerba Mate',
    l_carnitine_mg: 1000,
    taurine_mg: 500,
    beta_alanine_mg: 1200,
    electrolyte_complex_mg: 400,
    timing: 'pre-session: 20-30 min before start',
    role: 'CNS priming + fat oxidation support + glycogen sparing',
    does_not_contribute_to_carb_target: true,
    // Usage rules
    max_per_day: 2, // caffeine safety: max 200mg from Euphoria per day
    do_not_combine_with_high_caffeine_products: true, // combined caffeine >250mg/day = flag
  },

  REFUEL: {
    format: 'tear-open RTD liquid gel',
    carbohydrates_g: 23,
    maltodextrin_de19_g: 13,
    maltodextrin_de6_g: 7,
    bcaa_total_mg: 3000,
    leucine_mg: 1500,
    isoleucine_mg: 750,
    valine_mg: 750,
    l_citrulline_mg: 2000,
    l_glutamine_mg: 1000,
    curcumin_mg: 100,
    tart_cherry_mg: 500,
    green_tea_mg: 50,
    electrolyte_complex_mg: 400,
    timing_intra: 'back half of sessions >90min',
    timing_post: 'within 30min post-session (all sessions)',
    role_intra: 'sustained fuel delivery',
    role_post: 'glycogen resynthesis + recovery',
    leucine_below_mps_threshold: true, // 1.5g < 2g MPS threshold
    complete_protein_supplement_needed: true, // for high muscle-damage athletes
  },
};

// Caffeine safety rules derived from specs
export const CAFFEINE_RULES = {
  EUPHORIA_PER_SERVING_MG: PRODUCT_SPECS.EUPHORIA.caffeine_mg,
  FLAG_THRESHOLD_MG_PER_DAY: 250, // total daily caffeine from all protocol products
  FAIL_THRESHOLD_MG_PER_DAY: 400, // absolute safety limit
};
