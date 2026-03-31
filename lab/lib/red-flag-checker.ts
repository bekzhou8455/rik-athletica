import type { AthleteProfile, RedFlagResult } from './types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// RIK Athletica — Medical Screening Gate
//
// Purpose: hard-block athlete intake before any AI protocol is generated.
// Standard: cite-able clinical defensibility. Every gate references a specific
// guideline, position stand, or clinical paper.
//
// Gate types:
//   HARD BLOCK — blocked: true. Pipeline stops entirely.
//   SOFT FLAG  — blocked: false, flags non-empty. Pipeline continues but
//                operator is alerted to review before approving protocol.
//
// Solicitor note: this file implements the screening criteria. It does NOT
// constitute medical advice. All rejection language must be reviewed against
// the platform ToS and applicable jurisdiction's consumer protection law
// before the platform goes live with paying customers.
// ─────────────────────────────────────────────────────────────────────────────

// ── Term lists ────────────────────────────────────────────────────────────────

// GI conditions that make high-concentration carbohydrate protocols unsafe
const GI_CONDITIONS = [
  'ibs', 'irritable bowel', 'crohn', "crohn's", 'crohns',
  'ulcerative colitis', 'inflammatory bowel', 'ibd', 'colitis',
  'coeliac', 'celiac', 'sprue',
];

// Cardiac conditions — Euphoria (100mg caffeine) + GEL 100 CAF (100mg) = 200mg
// caffeine. Contraindicated with active arrhythmia per ISSN 2021 + cardiology guidance.
const ARRHYTHMIA_TERMS = [
  'arrhythmia', 'arrhythmias', 'atrial fibrillation', 'afib', 'a-fib',
  'palpitation', 'palpitations', 'irregular heartbeat', 'supraventricular',
  'svt', 'ventricular tachycardia', 'vt', 'wolff-parkinson-white', 'wpw',
  'long qt', 'lqt', 'heart rhythm', 'cardiac arrhythmia',
];

// Hyponatremia history — previous episode indicates abnormal sodium handling;
// high-carbohydrate protocol with electrolyte-dense products requires careful
// management. Speedy 1999; Noakes 2012.
const HYPONATREMIA_TERMS = [
  'hyponatremia', 'hyponatraemia', 'low sodium', 'sodium deficiency',
  'water intoxication', 'exercise-associated hyponatremia', 'eah',
];

// Type 1 Diabetes — carbohydrate delivery at 60-90g/hr causes rapid glycemic
// excursion requiring real-time insulin adjustment. Outside scope of nutrition
// coaching. ADA 2023 Standards of Care; ACSM 2016 Special Populations.
const T1D_TERMS = [
  'type 1 diabetes', 'type 1', 'type one diabetes', 't1d', 't1dm',
  'insulin dependent', 'insulin pump', 'insulin use', 'lada',
  'latent autoimmune', 'juvenile diabetes',
];

// Type 2 Diabetes on Metformin — Metformin + high-carbohydrate protocol
// creates risk of lactic acidosis under exercise stress. Contraindicated.
// Davies et al. 2018; EASD/ADA Consensus; BNF clinical guidance.
const T2D_METFORMIN_TERMS = [
  'metformin', 'glucophage', 'type 2 diabetes on medication', 'diabetic medication',
  'blood sugar medication', 'glucose lowering', 'antidiabetic',
];

// MAOI interactions — MAOIs + caffeine (Euphoria 100mg + gel 100mg) can cause
// hypertensive crisis (mechanism: MAOI inhibits MAO-A/B → tyramine accumulation
// + caffeine potentiates catecholamine effect). Absolute contraindication.
// BNF; Bazire 2021 Psychotropic Drug Directory.
const MAOI_TERMS = [
  'maoi', 'monoamine oxidase', 'phenelzine', 'tranylcypromine', 'isocarboxazid',
  'selegiline', 'rasagiline', 'moclobemide', 'nardil', 'parnate',
];

// Blood thinners — NSAIDs in protocol context + anticoagulants = GI bleed risk.
// Not a direct protocol contraindication but requires operator flag.
const ANTICOAGULANT_TERMS = [
  'warfarin', 'coumadin', 'rivaroxaban', 'xarelto', 'apixaban', 'eliquis',
  'dabigatran', 'pradaxa', 'edoxaban', 'heparin', 'anticoagulant', 'blood thinner',
  'clexane', 'enoxaparin',
];

// NSAID use — Van Wijck et al. 2012: NSAIDs before/during endurance exercise
// increases intestinal permeability and GI complication risk 3-5×. Protocol
// high-concentration carbohydrate delivery amplifies this.
const NSAID_TERMS = [
  'ibuprofen', 'naproxen', 'aspirin', 'nsaid', 'advil', 'motrin', 'aleve',
  'diclofenac', 'celecoxib', 'indomethacin', 'anti-inflammatory regularly',
  'take painkillers', 'take pain relief before races', 'voltaren', 'nurofen',
];

// Pregnancy — carbohydrate-dense nutrition protocol designed for peak sport
// performance is not appropriate during pregnancy. High caffeine (200mg/day)
// is above NICE/WHO recommendation of 200mg/day maximum in pregnancy and
// leaves no margin. RCOG 2010; NICE 2008.
const PREGNANCY_TERMS = [
  'pregnant', 'pregnancy', 'expecting', 'with child', 'trimester',
  'prenatal', 'antenatal', 'baby due', 'due date',
];

// Kidney disease — CKD changes electrolyte handling (potassium, sodium).
// High-electrolyte protocol (SaltStick FastChews: Na + K + Ca + Mg per serving
// every 20-30min) requires nephrologist supervision. KDIGO 2012; NKF-KDOQI.
const KIDNEY_TERMS = [
  'kidney disease', 'renal disease', 'chronic kidney', 'ckd', 'renal failure',
  'dialysis', 'nephropathy', 'nephrotic', 'glomerulonephritis', 'kidney failure',
  'reduced kidney function', 'low egfr',
];

// Active cancer treatment — chemotherapy and radiotherapy alter gut mucosa
// integrity, carbohydrate absorption, and electrolyte homeostasis.
// High-intensity protocol during active treatment = contraindicated.
const CANCER_TREATMENT_TERMS = [
  'chemotherapy', 'chemo', 'radiotherapy', 'radiation therapy', 'cancer treatment',
  'oncology treatment', 'currently being treated for cancer',
];

// Recent cardiac event — any cardiac event within 12 months makes high-intensity
// endurance racing and associated nutrition protocol contraindicated without
// cardiologist sign-off. ESC 2020 Guidelines on Sports Cardiology.
const RECENT_CARDIAC_TERMS = [
  'heart attack', 'myocardial infarction', 'mi', 'cardiac arrest',
  'heart surgery', 'stent', 'bypass surgery', 'recent cardiac',
  'heart failure', 'cardiomyopathy',
];

// RED-S indicators — IOC Consensus Statement (Mountjoy 2018). Absent/irregular
// menstrual cycle is the primary clinical marker of relative energy deficiency.
// High-carbohydrate protocol without adequate total energy intake amplifies
// hormonal suppression and bone stress injury risk.
const REDS_TERMS = [
  'absent period', 'no period', 'irregular period', 'amenorrhea', 'amenorrhoea',
  'oligomenorrhea', 'oligomenorrhoea', 'no menstruation', 'lost period',
  'missed period', 'period stopped', 'period irregular', 'no cycle',
  'disordered eating', 'eating disorder', 'anorexia', 'bulimia', 'orthorexia',
  'restrict food', 'restrict calories', 'binge', 'purge', 'fear of eating',
];

// Fructose malabsorption — GLUT5 transporter dysfunction. Any product above
// 60g/hr MUST contain fructose (MTC-based). Fructose malabsorption makes this
// physiologically impossible above 60g/hr. Jeukendrup 2010; Barrett 2011.
const FRUCTOSE_MALABSORPTION_TERMS = [
  'fructose malabsorption', 'fructose intolerance', 'fructose sensitivity',
  'fructose intolerant', 'fodmap', 'fructose allergy',
];

// Beta blockers — reduce maximum heart rate, alter perceived exertion, and
// mask hypoglycemia symptoms. Do not directly contraindicate the protocol
// but make carb target calibration unreliable. Operator soft flag.
const BETA_BLOCKER_TERMS = [
  'beta blocker', 'beta-blocker', 'metoprolol', 'atenolol', 'bisoprolol',
  'propranolol', 'carvedilol', 'nebivolol', 'inderal',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function containsAnyTerm(text: string, terms: string[]): boolean {
  const normalized = text.toLowerCase();
  return terms.some(term => {
    // Use word-boundary matching for all terms to prevent abbreviations like 'mi',
    // 'vt', 'ibs', 'ckd' from matching inside longer words ('mild', 'vital', 'inhibit').
    // Escape any regex-special characters in the term (e.g. hyphen in 'a-fib').
    try {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`).test(normalized);
    } catch {
      return normalized.includes(term); // fallback — should never be reached
    }
  });
}

function buildAllText(profile: AthleteProfile): string {
  return [
    profile.giHistory,
    profile.heatContext || '',
    profile.dietaryRestrictions || '',
    (profile as any).adherenceNotes || '',    // feedback field (iteration loop)
    (profile as any).adjustmentRequests || '', // feedback field (iteration loop)
    profile.medications || '',
    profile.medicalHistory || '',
    profile.currentConditions || '',
  ].join(' ').toLowerCase();
}

// ── Main checker ───────────────────────────────────────────────────────────────

export function checkRedFlags(profile: AthleteProfile): RedFlagResult {
  const hardBlockFlags: string[] = [];
  const softFlags: string[] = [];

  const allText = buildAllText(profile);

  // ── HARD BLOCK GATES ────────────────────────────────────────────────────────
  // These stop the pipeline entirely. blocked: true.

  // Gate 1: GI conditions (IBS, Crohn's, UC, Coeliac)
  if (containsAnyTerm(allText, GI_CONDITIONS)) {
    hardBlockFlags.push(
      'MEDICAL HARD STOP — GI condition: IBS, Crohn\'s disease, Ulcerative Colitis, or Coeliac disease disclosed. ' +
      'Protocol delivers 40-90g carbohydrate/hr via concentrated gels and drink mix. ' +
      'Active inflammatory bowel disease or malabsorption syndrome makes this protocol a direct harm risk. ' +
      'Athlete must be cleared by a gastroenterologist before any high-carbohydrate nutrition programme. ' +
      'Clinical reference: CCFA Clinical Practice Guidelines; Crohn\'s & Colitis Foundation of America.'
    );
  }

  // Gate 2: Cardiac arrhythmia — caffeine contraindication
  if (containsAnyTerm(allText, ARRHYTHMIA_TERMS)) {
    hardBlockFlags.push(
      'MEDICAL HARD STOP — Cardiac arrhythmia disclosed. ' +
      'Protocol contains Euphoria (100mg caffeine, Yerba Mate) + optional caffeinated gel (100mg) = up to 200mg caffeine. ' +
      'Caffeine at this dose during high-intensity exercise is contraindicated with active arrhythmia. ' +
      'Mechanism: adenosine receptor antagonism removes vagal brake on heart rate, amplifying ectopic beats. ' +
      'Reference: ISSN 2021 Position Stand on Caffeine §4.3; European Heart Rhythm Association guidance.'
    );
  }

  // Gate 3: Type 1 Diabetes
  if (containsAnyTerm(allText, T1D_TERMS)) {
    hardBlockFlags.push(
      'MEDICAL HARD STOP — Type 1 Diabetes (insulin-dependent) disclosed. ' +
      'Protocol delivers 60-90g carbohydrate/hr. In T1D, this rate causes rapid glycemic excursion ' +
      'requiring real-time insulin dose adjustment based on continuous glucose monitoring and clinical judgement. ' +
      'This is beyond the scope of a nutrition coaching programme. ' +
      'Athlete must be managed by an endocrinologist/sports physician with T1D exercise experience. ' +
      'Reference: ADA 2023 Standards of Medical Care §5 (Physical Activity); Riddell et al. 2017 (Lancet Diabetes).'
    );
  }

  // Gate 4: Pregnancy
  if (containsAnyTerm(allText, PREGNANCY_TERMS)) {
    hardBlockFlags.push(
      'MEDICAL HARD STOP — Pregnancy disclosed. ' +
      'Protocol is designed for peak athletic performance in Ironman racing, not for pregnancy. ' +
      'Contains 200mg/day caffeine (Euphoria + caffeinated gel) — at the maximum safe limit per NICE 2008/WHO 2016. ' +
      'High-intensity endurance racing and associated fueling is contraindicated in pregnancy without obstetric clearance. ' +
      'Reference: RCOG 2010 Exercise in Pregnancy; NICE 2008 Antenatal Care Guideline.'
    );
  }

  // Gate 5: Kidney disease
  if (containsAnyTerm(allText, KIDNEY_TERMS)) {
    hardBlockFlags.push(
      'MEDICAL HARD STOP — Kidney disease/renal impairment disclosed. ' +
      'Protocol prescribes SaltStick FastChews (100mg Na + 30mg K + 10mg Ca + 6mg Mg per serving) ' +
      'every 20-30 minutes throughout race. Impaired renal clearance makes this electrolyte load clinically dangerous. ' +
      'Hyperkalaemia (elevated potassium) risk in CKD is life-threatening under exercise stress. ' +
      'Reference: KDIGO 2012 Clinical Practice Guideline for CKD; NKF-KDOQI Nutrition Guidelines.'
    );
  }

  // Gate 6: MAOI drug interactions (hypertensive crisis risk)
  if (containsAnyTerm(allText, MAOI_TERMS)) {
    hardBlockFlags.push(
      'MEDICAL HARD STOP — MAOI (monoamine oxidase inhibitor) medication disclosed. ' +
      'Protocol contains Euphoria (100mg caffeine from Yerba Mate). ' +
      'MAOIs + caffeine can cause hypertensive crisis (mechanism: MAO inhibition → tyramine accumulation ' +
      '+ catecholamine potentiation from caffeine). This is a potentially life-threatening interaction. ' +
      'Absolute contraindication regardless of dose. ' +
      'Reference: BNF 2024 Drug Interactions; Bazire 2021 Psychotropic Drug Directory §MAOI.'
    );
  }

  // Gate 7: Active cancer treatment
  if (containsAnyTerm(allText, CANCER_TREATMENT_TERMS)) {
    hardBlockFlags.push(
      'MEDICAL HARD STOP — Active cancer treatment (chemotherapy/radiotherapy) disclosed. ' +
      'Cytotoxic chemotherapy damages intestinal mucosa, impairing carbohydrate absorption. ' +
      'Gut integrity compromised by treatment makes high-concentration carbohydrate delivery unsafe. ' +
      'Radiotherapy to abdomen directly damages small intestinal epithelium. ' +
      'Athlete must be cleared by their oncologist before any performance nutrition programme. ' +
      'Reference: Arends et al. 2017 ESPEN Guidelines on Nutrition in Cancer.'
    );
  }

  // Gate 8: Recent cardiac event (within 12 months context)
  if (containsAnyTerm(allText, RECENT_CARDIAC_TERMS)) {
    hardBlockFlags.push(
      'MEDICAL HARD STOP — Recent cardiac event or cardiac surgery disclosed. ' +
      'Ironman triathlon is classified as Class IV (very heavy) dynamic exercise. ' +
      'Return to high-intensity endurance sport after cardiac event requires cardiologist sign-off ' +
      'and graded exercise testing. Protocol assumes cardiac clearance — this intake cannot proceed. ' +
      'Reference: ESC 2020 Guidelines on Sports Cardiology and Physical Activity in Patients with CVD.'
    );
  }

  // Gate 9: Hyponatremia history
  if (containsAnyTerm(allText, HYPONATREMIA_TERMS)) {
    hardBlockFlags.push(
      'MEDICAL HARD STOP — History of hyponatremia (low blood sodium) disclosed. ' +
      'Previous EAH (exercise-associated hyponatremia) indicates abnormal sodium handling during exercise. ' +
      'Protocol\'s sodium-dense electrolyte strategy must be calibrated individually with medical supervision. ' +
      'Primary risk: overdrinking plain water during race (dilutional EAH) — not a sodium dose issue. ' +
      'Athlete requires individual sweat testing and medical clearance before protocol is prescribed. ' +
      'Reference: Noakes 2012 (Waterlogged); Speedy 1999 (Med Sci Sports Exerc); Hew-Butler 2015 (BJSM).'
    );
  }

  // Gate 10: Type 2 Diabetes on Metformin
  if (containsAnyTerm(allText, T2D_METFORMIN_TERMS)) {
    hardBlockFlags.push(
      'MEDICAL HARD STOP — T2D medication (Metformin or equivalent) disclosed. ' +
      'Metformin inhibits hepatic gluconeogenesis. During high-intensity prolonged exercise, ' +
      'reduced hepatic glucose output + high exogenous carbohydrate delivery creates unpredictable ' +
      'glycemic pattern. Risk of exercise-induced hypoglycemia and, in dehydration, lactic acidosis. ' +
      'Protocol requires diabetologist/sports physician oversight for any T2D athlete on medication. ' +
      'Reference: Davies et al. 2018 ADA/EASD Consensus; BNF 2024 Metformin; ADA 2023 §5.'
    );
  }

  // Gate 11: Fructose malabsorption
  if (
    containsAnyTerm(allText, FRUCTOSE_MALABSORPTION_TERMS) ||
    (profile.dietaryRestrictions || '').toLowerCase().includes('fructose')
  ) {
    hardBlockFlags.push(
      'MEDICAL HARD STOP — Fructose malabsorption disclosed. ' +
      'Protocol products above 60g/hr MUST use Multiple Transportable Carbohydrates (MTC): ' +
      'maltodextrin + fructose at 2:1 or 1:0.8 ratio (Maurten, SiS Beta Fuel). ' +
      'Fructose malabsorption (GLUT5 transporter dysfunction) makes any MTC product above 60g/hr ' +
      'a direct osmotic diarrhoea risk. Protocol is capped at 60g/hr maximum in this case. ' +
      'A 60g/hr-capped protocol can still be built — but this flag requires operator review before proceeding. ' +
      'Reference: Jeukendrup 2010 (Nutr Rev); Barrett 2011 (Aliment Pharmacol Ther).'
    );
  }

  // ── SOFT FLAGS ──────────────────────────────────────────────────────────────
  // Pipeline continues but operator is alerted. blocked: false.

  // Soft 1: NSAID use
  if (containsAnyTerm(allText, NSAID_TERMS)) {
    softFlags.push(
      'SOFT FLAG — NSAID use disclosed. ' +
      'Regular NSAID use before/during racing increases intestinal permeability and GI complication risk 3-5×. ' +
      'Protocol high-concentration carbohydrate delivery amplifies mucosal damage risk. ' +
      'Operator: advise athlete to avoid NSAIDs for 48hr before race and during race. ' +
      'If NSAID use is for chronic pain management, medical clearance recommended before high-intensity racing. ' +
      'Reference: Van Wijck 2012 (Med Sci Sports Exerc); Peters 2001 (Am J Gastroenterol).'
    );
  }

  // Soft 2: RED-S indicators
  if (containsAnyTerm(allText, REDS_TERMS)) {
    softFlags.push(
      'SOFT FLAG — RED-S risk indicator: absent/irregular menstrual cycle or disordered eating pattern disclosed. ' +
      '~30% of female endurance athletes exhibit RED-S markers (IOC 2018). ' +
      'High-carbohydrate protocol without adequate total energy availability amplifies hormonal suppression ' +
      'and bone stress injury risk. ' +
      'Operator: complete LEAF-Q screening tool before proceeding. Consider referral to sports dietitian ' +
      'experienced in female athlete health before issuing protocol. ' +
      'Reference: Mountjoy et al. 2018 IOC Consensus Statement on RED-S (BJSM).'
    );
  }

  // Soft 3: Anticoagulant medication
  if (containsAnyTerm(allText, ANTICOAGULANT_TERMS)) {
    softFlags.push(
      'SOFT FLAG — Anticoagulant medication disclosed. ' +
      'Protocol itself does not directly interact with anticoagulants. ' +
      'However: competitive Ironman racing on anticoagulants carries heightened trauma/bleed risk. ' +
      'Operator: confirm athlete has clearance from prescribing physician for high-intensity endurance racing. ' +
      'Do not proceed if athlete is on anticoagulants for active thromboembolism without medical sign-off. ' +
      'Reference: ESC 2020 Sports Cardiology Guidelines §anticoagulation and sport.'
    );
  }

  // Soft 4: Beta blocker medication
  if (containsAnyTerm(allText, BETA_BLOCKER_TERMS)) {
    softFlags.push(
      'SOFT FLAG — Beta blocker medication disclosed. ' +
      'Beta blockers reduce maximum heart rate (typically −20 to −30bpm). ' +
      'Carbohydrate target calculation based on finish time and training load may underestimate true intensity. ' +
      'Beta blockers also blunt hypoglycemia awareness. ' +
      'Operator: treat carb target as the lower bound of bracket range. ' +
      'Verify athlete\'s prescribing physician approves Ironman competition while on beta blockers. ' +
      'Reference: Maron BJ et al. 2015 (JACC); Levine 2008 (J Appl Physiol).'
    );
  }

  // Soft 5: Programme suitability — no confirmed race date
  if (!profile.raceDate || profile.raceDate === '') {
    softFlags.push(
      'SOFT FLAG — No confirmed race date provided. ' +
      'Protocol build requires a race date to calculate week-by-week progression and Race Pack supply. ' +
      'Operator: confirm race date before generating protocol. Without a date, race-day plan cannot be built.'
    );
  }

  // Soft 6: Race < 28 days away with no gut training
  if (profile.raceDate && profile.gutTrainingStatus === 'none') {
    const raceDate = new Date(profile.raceDate);
    const today = new Date();
    const daysToRace = Math.round((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysToRace < 28 && daysToRace > 0) {
      softFlags.push(
        `SOFT FLAG — Race is ${daysToRace} days away and athlete reports no gut training at race-level carbs. ` +
        'Cox et al. 2010 demonstrates 28 days of gut training is needed for meaningful adaptation. ' +
        'Starting a high-carbohydrate protocol with <28 days to race and no training history = elevated GI failure risk on race day. ' +
        'Operator: reduce carb targets to bottom of bracket range and prioritise product familiarity over target optimisation. ' +
        'Consider advising athlete that full protocol benefits may not be achievable before this race.'
      );
    }
  }

  // ── Result assembly ────────────────────────────────────────────────────────

  const allFlags = [...hardBlockFlags, ...softFlags];

  if (hardBlockFlags.length > 0) {
    const primaryFlag = hardBlockFlags[0];
    const reason = hardBlockFlags.length === 1
      ? primaryFlag
      : `${hardBlockFlags.length} medical hard stops detected. Review all flags.`;

    return {
      blocked: true,
      flags: allFlags,
      reason,
    };
  }

  return {
    blocked: false,
    flags: softFlags,
  };
}

// ── Type extension for feedback fields ────────────────────────────────────────
// medications, medicalHistory, currentConditions are now in AthleteProfile in types.ts
declare module './types.ts' {
  interface AthleteProfile {
    adherenceNotes?: string;
    adjustmentRequests?: string;
  }
}
