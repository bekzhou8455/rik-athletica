// RIK Audit — Gap identification + ranking + tactic copy.
// Self-contained. Does NOT import or modify methodology.js.
// Pure deterministic function: intake → primary gap + minute cost + tactics + routing.
//
// Spec: docs/RIK_Audit_Engine_Prompt.md
// Pricing: Bundle $83 Founding 50 (30% off $119) / Sprint $569 (70.3) / $659 (Full)

// === Numeric carbsPerHour midpoint per form enum ===
const CARB_INTAKE_GHR = {
  'under-30':  20,
  '30-45':     37,
  '45-60':     52,
  '60-90':     75,
  '90-plus':   95,
  'dont-know': null, // unknown — treated as no_system signal
};

// === Race-day g/hr target (mid of trained range) ===
const RACE_TARGET_GHR = {
  '70.3':     80,
  'full':     80,
  'olympic':  45,
  'marathon': 75,
  'ultra':    75,
  'other':    70,
};

// === Minute-cost matrix per spec ===
const MINUTE_COST = {
  carb_deficit: {
    'full':     [15, 30],
    '70.3':     [8, 18],
    'marathon': [8, 18],
    'ultra':    [12, 25],
    'olympic':  [3, 8],
    'other':    [5, 15],
  },
  gi_distress: {
    'full':     { often: [15, 25], sometimes: [8, 15] },
    '70.3':     { often: [10, 18], sometimes: [5, 12] },
    'marathon': { often: [8, 15],  sometimes: [5, 12] },
    'ultra':    { often: [15, 25], sometimes: [10, 20] },
    'olympic':  { often: [3, 8],   sometimes: [2, 5] },
    'other':    { often: [5, 12],  sometimes: [3, 8] },
  },
  sodium_hydration: {
    'full':     [5, 12],
    '70.3':     [3, 8],
    'marathon': [3, 8],
    'ultra':    [5, 15],
    'olympic':  [2, 5],
    'other':    [3, 8],
  },
  no_system: [10, 25],
  recovery:  [3, 8],
};

// === Tactic copy per primary gap (3-4 specific actions, product-agnostic) ===
const TACTICS = {
  carb_deficit: [
    { title: 'Measure what You actually take in',
      body: 'Count the grams You consume per hour on Your next long session — bottles, gels, chews, everything. Most athletes overestimate by 20–30%. The first move is knowing Your real baseline before You change anything.' },
    { title: 'Ramp gut training: +10 g/hr each week',
      body: 'Don\'t jump from 40 g/hr to 80 — Your gut won\'t tolerate it. Increase by 10 g/hr each week. SGLT1 carb transporters physically upregulate with structured exposure. Four weeks gets most athletes from "common" to "performance" range.' },
    { title: 'Use dual-transport carbs (glucose + fructose)',
      body: 'Single-source glucose maxes at ~60 g/hr regardless of effort. Dual-transport products in a 1:0.8 glucose:fructose ratio push absorption above 60. Read the label — if it lists only one carb source, You\'re capped.' },
    { title: 'Anchor fueling to a timer, not hunger',
      body: 'Set a 20-minute repeating alarm. Take a fixed dose at every beep. Decision fatigue at hour 6 is real — remove the decision in advance and You\'ll hit Your target consistently.' },
  ],
  gi_distress: [
    { title: 'Train Your gut like You train Your legs',
      body: 'The single biggest predictor of race-day GI distress is whether You\'ve practiced race-intensity fueling in training. If You only fuel easy sessions, Your gut isn\'t prepared for race effort. Three weeks of race-pace fueling sessions changes more than three months of easy-pace ones.' },
    { title: 'Start lower than You think',
      body: 'Begin at 30 g/hr on Your next race-pace session. If it holds, push to 40 g/hr the following week. The ramp matters more than the peak — going hot and bonking the experiment teaches You nothing.' },
    { title: 'Cut high-fiber, fat, and protein 3 hours pre-session',
      body: 'These slow gastric emptying and compete with exercise for gut blood flow. White rice, banana, honey-on-toast types of foods are race-day friendly. Save eggs, beans, and salads for rest days.' },
    { title: 'Test every product at race intensity, 3× minimum',
      body: 'Never race with anything You haven\'t used at race effort at least three times. This includes aid-station nutrition — if the race serves Gatorade Endurance and You\'ve never trained with it, that\'s a future problem.' },
  ],
  sodium_hydration: [
    { title: 'Get a real sweat-rate number',
      body: 'Your symptom history suggests heavier-than-average sodium loss. Precision Hydration\'s sweat test (~$50, mail-in) gives You mg sodium per liter sweat. In the meantime, target 300–500 mg sodium per hour on sessions over 90 minutes.' },
    { title: 'Separate fluid from carb tracking',
      body: 'They\'re two different systems. Drink to thirst under 90 minutes. Above 90 minutes, target 500–800 mL/hr depending on conditions. Track them independently — carb shortfall and dehydration feel similar but have different fixes.' },
    { title: 'Add sodium independent of carbs',
      body: 'Electrolyte capsules (SaltStick, Precision Hydration) let You tune sodium without changing carb dose. Two caps per hour for high sweat, one for moderate. This is the cleanest way to fix sodium without overhauling Your fuel.' },
    { title: 'Second-half cramps = sodium debt, not fitness',
      body: 'If You\'re cramping after hour 3, it\'s almost always cumulative sodium loss — not magnesium, not hydration volume, not lack of training. Pre-load 500 mg in the 2 hours before start to bank an early buffer.' },
  ],
  no_system: [
    { title: 'Measure before changing anything',
      body: 'On Your next long session, write down exactly what You consumed, when, and how much. Don\'t change products yet — just track. You can\'t fix what You can\'t measure, and most athletes are off by 30%+ from what they think they\'re doing.' },
    { title: 'Pick one session per week as Your fueling lab',
      body: 'Use it to test a specific variable: a new product, a higher carb target, a different timing interval. Keep everything else the same. One change per session, every week. Inside two months, You\'ll have data You actually trust.' },
    { title: 'Build a race-day plan in 30-minute blocks',
      body: 'Specify product, dose, and timing for every 30 minutes of the race. Write it on a piece of tape on Your top tube. The plan should be executable without thinking — because at hour 8, You won\'t be.' },
    { title: 'Pre-calculate Your total race-day needs',
      body: 'Target g/hr × expected race hours = total grams. Source the exact products and quantities in advance. Don\'t rely on aid stations as Your primary fuel — they\'re Your backup. Pack what You need.' },
  ],
  recovery: [
    { title: 'Within 30 minutes of finishing: protein + carbs',
      body: 'The glycogen window closes fast. Target 20–30 g protein and 0.5–1.0 g carb/kg bodyweight. Doesn\'t need to be fancy — chocolate milk hits the macro split. Skip the bar that takes 4 hours of digesting.' },
    { title: 'Replace what You sweated out',
      body: 'Weigh Yourself before and after long sessions. Every 1 lb lost = ~16 oz fluid debt. Replace 125–150% of that over the next 2–4 hours, with sodium. Plain water alone dilutes Your blood sodium.' },
    { title: 'Sleep is the only real recovery tool',
      body: 'Supplements, ice baths, compression — all marginal. Sleep is the multiplier. Treat it like training: a long ride is 4 hours, sleep should be 8+. Skip the late strength session if it costs an hour of bedtime.' },
    { title: 'Use easy days as easy days',
      body: 'A "Z1 recovery spin" at Z2 isn\'t recovery — it\'s low-quality training. If You\'re training 12+ hours a week, easy days have to actually be easy or the next quality session will be compromised.' },
  ],
};

// === Helpers ===

function weeksUntilRace(raceDateStr) {
  if (!raceDateStr) return null;
  const d = new Date(raceDateStr);
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7));
}

function ghrFromCarbsEnum(enumValue) {
  return CARB_INTAKE_GHR[enumValue] ?? null;
}

function isImDistance(rd) { return rd === '70.3' || rd === 'full'; }
function isShortDistance(rd) { return rd === 'olympic'; }

export function distanceLabel(rd) {
  return rd === '70.3'    ? 'half Ironman'
       : rd === 'full'    ? 'full Ironman'
       : rd === 'olympic' ? 'Olympic-distance triathlon'
       : rd === 'marathon'? 'marathon'
       : rd === 'ultra'   ? 'ultra'
       : 'race';
}

// === Gap scoring (each returns null if not triggered, or a data object if active) ===

function scoreCarbDeficit({ raceDistance, athleteGhr, targetGhr }) {
  if (athleteGhr == null) return null;
  const deficit = targetGhr - athleteGhr;
  if (deficit < 15) return null;
  const range = MINUTE_COST.carb_deficit[raceDistance] ?? MINUTE_COST.carb_deficit.other;
  return { min: range[0], max: range[1], _mid: (range[0] + range[1]) / 2, deficit, athleteGhr, targetGhr };
}

function scoreGiDistress({ raceDistance, giHistory }) {
  if (giHistory !== 'sometimes' && giHistory !== 'often') return null;
  const matrix = MINUTE_COST.gi_distress[raceDistance] ?? MINUTE_COST.gi_distress.other;
  const range = matrix[giHistory];
  if (!range) return null;
  return { min: range[0], max: range[1], _mid: (range[0] + range[1]) / 2, giHistory };
}

function scoreSodiumHydration({ raceDistance, sweatRate, brands, giNotes }) {
  // Brands considered electrolyte-forward (proxy: PFH + Skratch + LMNT-style)
  const electrolyteForward = ['precision', 'skratch'];
  const usesElectrolyte = (brands ?? []).some(b => electrolyteForward.includes(b));
  const sweatTrigger = (sweatRate === 'high' || sweatRate === 'dont-know') && !usesElectrolyte;
  const crampMentioned = !!(giNotes && /cramp/i.test(giNotes));
  if (!sweatTrigger && !crampMentioned) return null;
  const range = MINUTE_COST.sodium_hydration[raceDistance] ?? MINUTE_COST.sodium_hydration.other;
  return { min: range[0], max: range[1], _mid: (range[0] + range[1]) / 2, sweatRate, crampMentioned };
}

function scoreNoSystem({ brands, carbsPerHour }) {
  const wingingIt = (brands ?? []).includes('nothing');
  const unknown = carbsPerHour === 'dont-know';
  if (!wingingIt && !unknown) return null;
  return { min: MINUTE_COST.no_system[0], max: MINUTE_COST.no_system[1], _mid: 17, wingingIt, unknown };
}

function scoreRecovery({ weeklyHours, brands }) {
  const highVolume = weeklyHours === '12-16' || weeklyHours === '16-20' || weeklyHours === '20-plus';
  if (!highVolume) return null;
  const onlyWingingIt = (brands ?? []).length === 1 && (brands ?? [])[0] === 'nothing';
  if (!onlyWingingIt) return null;
  return { min: MINUTE_COST.recovery[0], max: MINUTE_COST.recovery[1], _mid: 5 };
}

// === Ranking heuristic (from spec) ===
function pickPrimaryGap({ raceDistance, candidates, giHistory, carbsPerHour }) {
  // Hard overrides from spec:
  if (giHistory === 'often' && candidates.gi_distress) {
    return { type: 'gi_distress', data: candidates.gi_distress };
  }
  if (carbsPerHour === 'dont-know' && candidates.no_system) {
    return { type: 'no_system', data: candidates.no_system };
  }
  // Distance-specific priority:
  const order = (raceDistance === 'full')
    ? ['gi_distress', 'carb_deficit', 'sodium_hydration', 'no_system', 'recovery']
    : (raceDistance === '70.3' || raceDistance === 'marathon')
    ? ['carb_deficit', 'gi_distress', 'sodium_hydration', 'no_system', 'recovery']
    : (raceDistance === 'olympic')
    ? ['carb_deficit', 'no_system']
    : ['carb_deficit', 'gi_distress', 'sodium_hydration', 'no_system', 'recovery'];

  for (const t of order) {
    if (candidates[t]) return { type: t, data: candidates[t] };
  }
  return null;
}

// === Routing (Bundle $83 Founding 50 / Sprint $569 70.3 / $659 Full) ===
function chooseRouting({ raceDistance, weeksOut }) {
  if (weeksOut != null && weeksOut < 4) {
    return {
      tier: 'bundle',
      price_text: '$83',
      cta_text: 'Get the Bundle — $83 (Founding 50)',
      cta_url: '/bundle',
      reason: 'race-too-close-for-sprint',
      explanation: 'Your race is close. A full Sprint program needs 4 weeks to run the adaptation cycle. The highest-value move now is to start the Bundle immediately, lock in Your race-day fueling plan using the tactics above, and practice at race intensity on Your remaining long sessions.',
    };
  }
  if (isShortDistance(raceDistance)) {
    return {
      tier: 'bundle',
      price_text: '$83',
      cta_text: 'Get the Bundle — $83 (Founding 50)',
      cta_url: '/bundle',
      reason: 'short-distance',
      explanation: 'At Olympic distance, the fueling window is short enough that a full Sprint program is overkill. The Bundle gives You the functional layer for Your key sessions. The tactics above are Your protocol.',
    };
  }
  if (isImDistance(raceDistance)) {
    const sprintPrice = raceDistance === 'full' ? '$659' : '$569';
    return {
      tier: 'sprint',
      price_text: sprintPrice,
      cta_text: `Start My Sprint — from ${sprintPrice}`,
      cta_url: '/sprint',
      reason: 'im-distance-with-runway',
      explanation: 'Your race window is tight enough that structured iteration matters. The 4-Week Sprint builds Your full protocol — both layers, every product sourced and shipped, weekly revisions based on how Your body responds. You\'ve seen the problem in this audit. Sprint is the system that fixes it.',
    };
  }
  return {
    tier: 'bundle',
    price_text: '$83',
    cta_text: 'Get the Bundle — $83 (Founding 50)',
    cta_url: '/bundle',
    reason: 'non-im-distance-with-runway',
    explanation: 'Your race is far enough out that You have time to build Your fueling foundation. The RIK Bundle gives You the products to start gut training and test the functional layer alongside whatever carb source You\'re already using.',
  };
}

// === Gap-description text using their data ===
function describeGap(type, data, intake) {
  const dist = distanceLabel(intake.raceDistance);
  switch (type) {
    case 'carb_deficit':
      return `You told us You're taking in around ${data.athleteGhr} g/hr on a ${dist}. The trained-gut range for Your distance is ${Math.max(50, data.targetGhr - 10)}–${data.targetGhr + 10} g/hr to avoid late-race energy collapse. That ${data.deficit} g/hr gap is the single biggest lever in Your plan.`;
    case 'gi_distress': {
      const note = intake.giNotes && intake.giNotes.trim()
        ? ` You mentioned: "${intake.giNotes.trim().slice(0, 140)}".`
        : '';
      return `You told us Your gut acts up ${data.giHistory} on long sessions.${note} On a ${dist}, that's the dominant risk — most athletes who DNF or melt down in the final third do so from GI events, not from lack of fitness.`;
    }
    case 'sodium_hydration': {
      const sweatLabel = data.sweatRate === 'dont-know' ? 'self-described unknown'
                       : data.sweatRate === 'high'      ? 'high'
                       : 'moderate';
      const crampNote = data.crampMentioned ? ' You mentioned cramping, which lines up with this.' : '';
      return `You\'re a ${sweatLabel} sweat-rate athlete without electrolyte-forward products in Your current kit.${crampNote} On a ${dist}, accumulated sodium debt is the most common late-race failure mode after carb shortfall.`;
    }
    case 'no_system':
      if (data.unknown) {
        return `You told us You don\'t know Your current carb intake — and that\'s the most common answer. The biggest opportunity here isn\'t a new product, it\'s a measurement and tracking system. You can\'t fix what You can\'t see.`;
      }
      return `You\'re currently fueling without a system — pulling from aid stations, hoping for the best. That works at sprint distance. On a ${dist}, it\'s the most common reason athletes blow up after hour 3.`;
    case 'recovery':
      return `You\'re training ${intake.weeklyHours} hours/week without dedicated recovery support. The session-to-session quality gap shows up most in the back half of a build, when small recovery deficits compound into burnout or illness.`;
    default:
      return `Your current fueling profile looks solid for Your race — no obvious primary gap. Focus shifts to consistency and race-week execution.`;
  }
}

// === Public API ===

const GAP_TITLES = {
  carb_deficit:     'Carbohydrate Deficit',
  gi_distress:      'GI Distress Risk',
  sodium_hydration: 'Sodium / Hydration Gap',
  no_system:        'No Structured Fueling System',
  recovery:         'Recovery Quality Gap',
};

export function identifyPrimaryGap(intake) {
  const raceDistance = intake.raceDistance ?? 'other';
  const weeksOut = weeksUntilRace(intake.raceDate);
  const athleteGhr = ghrFromCarbsEnum(intake.carbsPerHour);
  const targetGhr = RACE_TARGET_GHR[raceDistance] ?? 70;

  const candidates = {
    carb_deficit:     scoreCarbDeficit({ raceDistance, athleteGhr, targetGhr }),
    gi_distress:      scoreGiDistress({ raceDistance, giHistory: intake.giHistory }),
    sodium_hydration: scoreSodiumHydration({ raceDistance, sweatRate: intake.sweatRate, brands: intake.brands, giNotes: intake.giNotes }),
    no_system:        scoreNoSystem({ brands: intake.brands, carbsPerHour: intake.carbsPerHour }),
    recovery:         scoreRecovery({ weeklyHours: intake.weeklyHours, brands: intake.brands }),
  };

  const winner = pickPrimaryGap({ raceDistance, candidates, giHistory: intake.giHistory, carbsPerHour: intake.carbsPerHour });

  if (!winner) {
    return {
      gap_type: 'none',
      gap_title: 'You\'re well-tuned for Your race',
      gap_description: 'Your current fueling profile looks well-set for Your race distance. The audit\'s focus shifts to consistency, race-week execution, and validating Your existing setup.',
      minute_cost: { min: 0, max: 5 },
      tactics: TACTICS.recovery,
      routing: chooseRouting({ raceDistance, weeksOut }),
      athleteGhr,
      targetGhr,
      weeksOut,
    };
  }

  return {
    gap_type: winner.type,
    gap_title: GAP_TITLES[winner.type],
    gap_description: describeGap(winner.type, winner.data, intake),
    minute_cost: { min: winner.data.min, max: winner.data.max },
    tactics: TACTICS[winner.type],
    routing: chooseRouting({ raceDistance, weeksOut }),
    athleteGhr,
    targetGhr,
    weeksOut,
    raw: winner.data,
  };
}

export { TACTICS, GAP_TITLES, RACE_TARGET_GHR };
