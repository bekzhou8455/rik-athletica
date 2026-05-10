// RIK Athletica — Methodology constants
// SOURCE OF TRUTH: RIK_Protocol_Engine_Methodology_v3.1.docx
// Reviewed by: Emily Haydon Norman, RDN — CDR #86117608
// DO NOT EDIT NUMBERS without notifying Emily per Citation Agreement §6.1
// (any material change to CHO/sodium/hydration/caffeine targets, gut progression,
//  recovery placement, pre-session meal, or race-week rules triggers re-review).

export const METHODOLOGY_VERSION = 'v3.1';
export const KB_VERSION = '1.1';
export const STOCKLIST_VERSION = '3.1';
export const RD_NAME = 'Emily Haydon Norman, RDN';
export const RD_REGISTRY = 'Commission on Dietetic Registration (USA), reg. #86117608';

// === §2.1 Gut-Week Ceilings ===
// 4-week progressive ramp. SGLT1 saturates ~60 g/hr; GLUT5 unlocks via
// MTC (maltodextrin:fructose 1:0.8). GLUT5 upregulation needs 3-4 weeks.
export const GUT_WEEK_CEILINGS = {
  1: { ceiling: 40, phase: 'Introduction', vehicle: 'BF DM 1:1000ml' },
  2: { ceiling: 58, phase: 'Building',     vehicle: 'BF DM 1:750ml'  },
  3: { ceiling: 80, phase: 'Peak Loading', vehicle: 'BF DM 1:500ml (full)' },
  4: { ceiling: 62, phase: 'Consolidation',vehicle: 'BF DM 1:750ml'  },
};

// === §2.2 Per-Session CHO Targets (g/hr at each gut week) ===
// Bike sessions
export const BIKE_CHO = {
  B1: { 1: 0,  2: 0,  3: 0,  4: 0,  name: 'Recovery Spin' },
  B2: { 1: 40, 2: 55, 3: 80, 4: 57, name: 'Aerobic Build' },
  B3: { 1: 40, 2: 57, 3: 80, 4: 53, name: 'Long Ride' },
  B4: { 1: 40, 2: 57, 3: 80, 4: 53, name: 'Epic / Race Sim' },
  B5: { 1: 40, 2: 40, 3: 40, 4: 40, name: 'Intervals / VO2' },
  B6: { 1: 35, 2: 57, 3: 80, 4: 53, name: 'Sweet Spot / Tempo' },
};
// Run sessions
export const RUN_CHO = {
  R1: { 1: 0,  2: 0,  3: 0,  4: 0,  name: 'Short Easy (≤45min)' },
  R2: { 1: 22, 2: 40, 3: 40, 4: 40, name: 'Medium Easy' },
  R3: { 1: 22, 2: 40, 3: 45, 4: 45, name: 'Long Run' },
  R4: { 1: null, 2: null, 3: 50, 4: 45, name: 'Ultra Long' },
  R5: { 1: 35, 2: 35, 3: 35, 4: 35, name: 'Intervals' },
  R6: { 1: 22, 2: 35, 3: 35, 4: 35, name: 'Tempo / Race Pace' },
};

// === Race-day delivery rates (derived from gut-week ceilings) ===
// Per §2.2: race day uses athlete's achieved gut-week ceiling.
// Approximate target ranges by race distance for trained-gut athletes (Wk3 peak):
export const RACE_TARGETS = {
  '70.3':     { trained_min: 70, trained_max: 90,  duration_hr_typical: 5.0 },
  'full':     { trained_min: 70, trained_max: 90,  duration_hr_typical: 11.0 },
  'olympic':  { trained_min: 30, trained_max: 60,  duration_hr_typical: 2.5 },
  'marathon': { trained_min: 60, trained_max: 90,  duration_hr_typical: 3.5 },
  'ultra':    { trained_min: 60, trained_max: 90,  duration_hr_typical: 8.0 },
  'other':    { trained_min: 60, trained_max: 90,  duration_hr_typical: 4.0 },
};

// === §3.5 GI-Flag Track ===
// Athletes with "Often" GI issues route to Maurten products throughout.
// Maurten DM160 (Wk1), DM320 (Wk2-4). Maurten Gel 100 replaces BF+E on run.
export const GI_FLAG_TRIGGER = ['often']; // gi_history values that flip GI track

// === §3.6 Iteration Engine — adjustment rules (informational on Audit) ===
export const G_TIER_CEILINGS = { G1: 55, G2: 80, G3: 90 }; // g/hr ceilings by gut tier

// === §4 Sodium Ranges (sweat-rate adjusted) ===
// SR1/SR2/SR3 tiers. Modality-specific. Bike pre-loaded; run chewable tabs.
export const SWEAT_RATE_TIERS = {
  low:        'SR1',
  medium:     'SR2',
  high:       'SR3',
  'dont-know': 'SR2', // default to mid tier per RD methodology
};
export const SODIUM_BIKE_PER_HR = {
  SR1: 637, // mg/hr — SiS BF DM 300mg + PH500 250mg + Refuel bridge 87mg
  SR2: 637,
  SR3: 887, // upgraded PH1000
};
export const SODIUM_RUN_PER_HR = {
  SR1: 400, // mg/hr — BF+E gel 300mg + 2 SaltStick = 100mg
  SR2: 500, // 4 SaltStick = 200mg
  SR3: 600, // 6 SaltStick = 300mg
};

// === §5 Hydration ===
// Bike target = 70% of sweat rate (KB HYD-002).
// Sweat-rate proxy values when athlete doesn't know exact L/hr.
export const SWEAT_RATE_PROXY_LPH = {
  SR1: 0.5,
  SR2: 1.0,
  SR3: 1.5,
};
export function bikeFluidTargetMlPerHr(srTier) {
  const sweat = SWEAT_RATE_PROXY_LPH[srTier] ?? 1.0;
  return Math.round(sweat * 0.7 * 1000); // 70% in mL
}

// Per-session fluid targets (mL/hr) from §5
export const FLUID_TARGETS = {
  swim: 0,
  bike_recovery: 400,
  bike_aerobic_tempo: [500, 700],
  bike_long_epic: [750, 800],
  run_short: 300,
  run_medium_long: [400, 500],
  strength: 400,
  mobility: 300,
};

// === §6 Caffeine (Euphoria gating) ===
// 100 mg caffeine per Euphoria Gel. CHO = 0 (yerba mate, not a fuel source).
// Euphoria only when intensity ≥Z4 OR duration ≥120min OR session in [B4, BR3, RD1, RD2].
export const CAFFEINE_PER_EUPHORIA_MG = 100;
export const EUPHORIA_NA_MG = 87;
export const EUPHORIA_GATE_MIN_DURATION = 120; // minutes

// === §8 Pre-Session Meal ===
// Weight-scaled. CHO = bw_kg × cho_g_per_kg (A0 lookup, typically 1.0).
// Range = 50%-100% of calculated value, 2-3hr before.
export const PRE_SESSION_CHO_PER_KG = 1.0;
export const PRE_SESSION_TIMING_HR = [2, 3];

// === §9 Race-Week Tapering (IT-010) ===
// Trigger: ≤2 weeks to race. FREEZE all changes.
export const RACE_WEEK_FREEZE_DAYS = 14;

// === Citations (for RD-covered Track A blocks) ===
export const CITATIONS = [
  { ref: 'Jeukendrup (2014)', supports: 'CHO/hr targets not weight-scaled' },
  { ref: 'Jeukendrup (2017)', supports: 'Gut training science — SGLT1/GLUT5 upregulation' },
  { ref: 'Costa et al. (2017)', supports: 'Gut training protocol design' },
  { ref: 'Pfeiffer et al. (2012)', supports: 'SGLT1 saturation at ~60 g/hr' },
  { ref: 'Del Coso et al. (RCT)', supports: 'Na supplementation — 26 min faster in IM-distance' },
];

// === Carbs/hr enum from form → numeric estimate (mid of range) ===
// Maps audit.html form values to numeric g/hr for gap calculation.
export const CARBS_PER_HOUR_ESTIMATE = {
  'under-30':   20, // assume 20 if "underfueled"
  '30-45':      37,
  '45-60':      52,
  '60-90':      75,
  '90-plus':    95,
  'dont-know':  35, // population mean — same anchor used in Audit narrative
};

// === Weekly hours enum → numeric mean ===
export const WEEKLY_HOURS_MEAN = {
  'under-8': 6,
  '8-12':    10,
  '12-16':   14,
  '16-20':   18,
  '20-plus': 22,
};

// === RIK pacing-loss factor (TRACK B — RIK estimate, NOT RD-validated) ===
// IMPORTANT: This is RIK's interpretation of how carb deficit translates to
// time loss in endurance races. Cited inline as RIK estimate, never tied to
// Emily's name. See agreement §1.5 / §4.2.
//
// Source: extrapolation from Jeukendrup pacing literature + race-day field
// observations. Ranges are conservative-to-typical.
export const PACING_LOSS_MIN_PER_G_DEFICIT = {
  '70.3':     [0.06, 0.16], // min lost per (g/hr deficit × race hours)
  'full':     [0.08, 0.20],
  'olympic':  [0.04, 0.10],
  'marathon': [0.05, 0.12],
  'ultra':    [0.10, 0.25],
  'other':    [0.06, 0.15],
};

// Helper: weight-unit normalization for pre-session calc
export function bodyWeightKg(bodyWeight, weightUnit) {
  const bw = parseFloat(bodyWeight);
  if (isNaN(bw)) return null;
  return weightUnit === 'lb' ? bw * 0.453592 : bw;
}
