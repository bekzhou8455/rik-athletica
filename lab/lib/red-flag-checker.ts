import type { AthleteProfile, RedFlagResult } from './types.ts';

// ToS §3 — Medical Contraindications
// Hard-block on 3 conditions — no AI called until cleared

const GI_CONDITIONS = [
  'ibs',
  'irritable bowel',
  'crohn',
  "crohn's",
  'crohns',
  'ulcerative colitis',
  'inflammatory bowel',
  'ibd',
  'colitis',
];

const ARRHYTHMIA_TERMS = [
  'arrhythmia',
  'arrhythmias',
  'atrial fibrillation',
  'afib',
  'a-fib',
  'palpitation',
  'palpitations',
  'heart palpitation',
  'irregular heartbeat',
  'supraventricular',
  'svt',
  'ventricular tachycardia',
  'vt',
];

const HYPONATREMIA_TERMS = [
  'hyponatremia',
  'hyponatraemia',
  'low sodium',
  'sodium deficiency',
  'water intoxication',
];

function containsAnyTerm(text: string, terms: string[]): boolean {
  const normalized = text.toLowerCase();
  return terms.some(term => normalized.includes(term));
}

export function checkRedFlags(profile: AthleteProfile): RedFlagResult {
  const flags: string[] = [];

  // Collect all free-text fields for scanning
  const textFields = [
    profile.giHistory,
    // Additional text that might be in other fields
  ].filter(Boolean).join(' ');

  // Also check any string fields that might contain medical conditions
  // (In practice the Typeform routes medical info into giHistory and other fields)
  const allText = [
    profile.giHistory,
    profile.heatContext || '',
    profile.dietaryRestrictions || '',
    profile.adherenceNotes || '',
    profile.adjustmentRequests || '',
  ].join(' ').toLowerCase();

  // Gate 1: GI conditions (IBS, Crohn's, Ulcerative Colitis)
  if (
    profile.giHistory === 'significant' ||
    containsAnyTerm(allText, GI_CONDITIONS)
  ) {
    // Check specifically for the hard-block conditions (not just "significant" GI)
    if (containsAnyTerm(allText, GI_CONDITIONS)) {
      flags.push(
        'GI condition detected: IBS, Crohn\'s disease, or Ulcerative Colitis mentioned in intake. ' +
        'Reference: Terms of Service §3 — Medical Contraindications.'
      );
    }
  }

  // Gate 2: Caffeine + arrhythmia
  // Euphoria contains 100mg caffeine. If athlete has cardiac arrhythmia, flag.
  if (containsAnyTerm(allText, ARRHYTHMIA_TERMS)) {
    flags.push(
      'Cardiac condition detected: arrhythmia or palpitations mentioned in intake. ' +
      'Protocol uses Euphoria (100mg caffeine per serving). ' +
      'Reference: Terms of Service §3 — Medical Contraindications.'
    );
  }

  // Gate 3: Hyponatremia history
  if (containsAnyTerm(allText, HYPONATREMIA_TERMS)) {
    flags.push(
      'Hyponatremia risk detected: athlete has disclosed history of hyponatremia or low sodium. ' +
      'Reference: Terms of Service §3 — Medical Contraindications.'
    );
  }

  if (flags.length > 0) {
    const primaryFlag = flags[0];
    // Extract just the condition name for the reason field
    const reason = flags.length === 1
      ? primaryFlag
      : `Multiple conditions detected: ${flags.length} flags`;

    return {
      blocked: true,
      flags,
      reason,
    };
  }

  return {
    blocked: false,
    flags: [],
  };
}

// Type augmentation to handle optional fields that might appear in the profile
declare module './types.ts' {
  interface AthleteProfile {
    adherenceNotes?: string;
    adjustmentRequests?: string;
  }
}
