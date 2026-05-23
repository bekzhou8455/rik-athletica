// RIK Audit — Claude Haiku drafts the 4 personalized prose blocks for the
// new 4-section diagnostic deliverable.
// Spec: docs/RIK_Audit_Engine_Prompt.md
//
// Output keys (consumed by lib/render.js):
//   section_1_gap        — 2-3 sentences expanding the primary gap with their data
//   section_2_impact     — 2-3 sentences contextualizing the minute cost
//   section_3_lead       — 1-2 sentence lead-in to the deterministic tactic cards
//   section_4_routing    — 2-3 sentences of honest routing recommendation
//
// Tactics themselves are NOT AI-generated — they come from audit-gaps.js
// (hand-written, product-agnostic, per-gap-type).

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';

let _client = null;
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  _client = new Anthropic({ apiKey });
  return _client;
}

const SYSTEM_PROMPT = `You are drafting four short personalized prose blocks for a RIK Athletica Free Race Fuel Audit. RIK is an endurance sports nutrition brand. The recipient is a triathlete or endurance athlete who just filled out an 8-question intake.

This is a DIAGNOSTIC document, not a protocol. You are NOT producing a week grid, session schedule, or full Sprint output. You're writing four short prose blocks that wrap a deterministic gap analysis.

VOICE — non-negotiable:
- Friend test: would a knowledgeable friend say this over a beer? If no, rewrite.
- Capital "You" always — "You", "Your", "You've". Treat the athlete as a peer.
- Plain English. Short sentences. No marketing language.
- BANNED words (FTC + voice): guaranteed, proven, ensures, cures, treats, diagnoses, unlock, elevate, robust, optimize, revolutionary, prescription, prescriptive, clinical, therapeutic, miracle, breakthrough.
- USE INSTEAD: supports, designed to, may help, tends to, in the trained range, when athletes do X.
- Never name "Emily", "RDN", or any specific person except "Bek" once at the end of section_4 if natural.
- Never make individualized medical claims. Use population framings ("athletes at Your intake level…", "in the trained-gut range…").

REFERENCE THEIR DATA:
- Always use the athlete's name from \`first_name\`.
- Reference their specific carb intake number, GI history, race distance, and weekly hours where natural.
- If they wrote a \`specific_question\`, address it within section_1_gap or section_3_lead.

SECTION RULES:

section_1_gap (60–90 words, 2-3 sentences)
- Expand the identified primary gap with their data. Don't restate the gap title.
- Reference specifics: their intake number, their gut history, their race.
- End with the implication: what this gap means for race day.

section_2_impact (50–80 words, 2-3 sentences)
- Translate the minute-cost number into something the athlete feels.
- If they gave a goal_time, reference it concretely ("the difference between Your 5:15 goal and a 5:33 finish").
- Avoid restating the gap. Stay on time/cost.

section_3_lead (20–40 words, 1-2 sentences)
- A short bridge into the tactics list. Frame the tactics as "this week" actions.
- Do NOT enumerate tactics — those are hand-written and rendered separately.

section_4_routing (50–80 words, 2-3 sentences)
- Honest routing recommendation. Use the routing.tier and routing.explanation as the spine.
- Make it specific to THIS athlete's situation (race date, gut, distance).
- One clear next step. End with "— Bek" if natural; otherwise just end the recommendation.
- Never promise a result. Never say "you will" — say "the Sprint is built for…" or "this gives You…".

HARD CONSTRAINTS:
- Total combined word count across all 4 sections: 180–290 words.
- Return ONLY valid JSON in this exact shape:
{
  "section_1_gap": "<text>",
  "section_2_impact": "<text>",
  "section_3_lead": "<text>",
  "section_4_routing": "<text>"
}

No markdown, no preamble, no apologies, no trailing prose. Pure JSON object only.`;

function buildUserPrompt(answers, engine) {
  const gap = engine.audit_gap ?? {};
  const tier = engine.tier_recommendation ?? {};
  return `ATHLETE INTAKE (verbatim from form):
${JSON.stringify({
  first_name: answers.firstName,
  race_distance: answers.raceDistance,
  race_date: answers.raceDate,
  goal_time: answers.targetTime,
  weekly_hours: answers.weeklyHours,
  current_products: answers.brands,
  carbs_per_hour_self_report: answers.carbsPerHour,
  gut_history: answers.giHistory,
  gut_details: answers.giNotes,
  body_weight: `${answers.bodyWeight} ${answers.weightUnit}`,
  sweat_rate: answers.sweatRate,
  has_coach: answers.hasCoach,
  coach_name: answers.coachName,
  specific_question: answers.specificConcern,
}, null, 2)}

GAP ANALYSIS (use these — do not invent numbers):
- Primary gap: ${gap.gap_title ?? 'unknown'} (type: ${gap.gap_type ?? 'unknown'})
- Estimated minute cost: ${gap.minute_cost?.min ?? '?'}–${gap.minute_cost?.max ?? '?'} min
- Athlete's intake (g/hr midpoint): ${gap.athleteGhr ?? 'unknown'}
- Race-day target (g/hr): ${gap.targetGhr ?? 'unknown'}
- Weeks until race: ${gap.weeksOut ?? 'unknown'}
- Deterministic gap description (reference style/tone, don't copy): "${gap.gap_description ?? ''}"

ROUTING RECOMMENDATION (use this as the spine for section_4_routing):
- Tier: ${gap.routing?.tier ?? tier.tier ?? 'unknown'}
- CTA text: ${gap.routing?.cta_text ?? 'see options'}
- Routing reason: ${gap.routing?.reason ?? 'default'}
- Routing explanation (reference, paraphrase don't copy): "${gap.routing?.explanation ?? tier.explanation ?? ''}"

Return only the JSON object with all four sections.`;
}

export async function draftBlocks({ answers, engine }) {
  const client = getClient();
  const userPrompt = buildUserPrompt(answers, engine);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 900,
    temperature: 0.5,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content?.[0]?.text ?? '';
  const drafts = parseJsonStrict(text);
  validateDrafts(drafts);
  return {
    ...drafts,
    _meta: {
      model: MODEL,
      usage: response.usage,
      generated_at: new Date().toISOString(),
    },
  };
}

function parseJsonStrict(text) {
  const stripped = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    throw new Error(`AI drafter returned non-JSON: ${text.slice(0, 200)}`);
  }
}

function validateDrafts(d) {
  const required = ['section_1_gap', 'section_2_impact', 'section_3_lead', 'section_4_routing'];
  for (const key of required) {
    if (typeof d[key] !== 'string' || d[key].trim().length < 12) {
      throw new Error(`AI drafter missing or too-short field: ${key}`);
    }
  }
  // Soft FTC banned-word scan — flag for admin review, don't reject
  const banned = ['guaranteed', 'guarantees', 'proven', 'ensures', 'cures', 'treats', 'diagnoses',
                  'Emily', 'RDN', 'prescription', 'prescriptive', 'clinical', 'therapeutic',
                  'miracle', 'breakthrough', 'unlock', 'elevate', 'robust', 'optimize'];
  const allText = `${d.section_1_gap} ${d.section_2_impact} ${d.section_3_lead} ${d.section_4_routing}`.toLowerCase();
  for (const word of banned) {
    if (allText.includes(word.toLowerCase())) {
      d._ftc_warning = (d._ftc_warning ?? []).concat(word);
    }
  }
}

// === Fallback drafts — used when Anthropic API fails, so admin queue never blocks ===
export function fallbackDrafts({ answers, engine }) {
  const fn = answers.firstName ?? 'there';
  const gap = engine.audit_gap ?? {};
  const minMin = gap.minute_cost?.min ?? 0;
  const maxMin = gap.minute_cost?.max ?? 0;
  const dist = answers.raceDistance ?? 'race';

  return {
    section_1_gap: gap.gap_description ?? `Looking at Your answers, the highest-impact lever is in Your fueling system. The specifics depend on a closer look at race conditions, but Your intake profile points to a meaningful gap worth closing before race day.`,
    section_2_impact: `That gap maps to roughly ${minMin}–${maxMin} minutes of estimated cost on a ${dist}. Ranges reflect normal variation — Your specific number depends on conditions and execution.`,
    section_3_lead: `Four things You can act on this week. Pick one. Don't try all at once.`,
    section_4_routing: gap.routing?.explanation ?? `Your timeline and distance point to a clear next step. The recommendation below matches how We'd route a coached athlete with Your profile.`,
    _meta: { model: 'fallback', generated_at: new Date().toISOString() },
  };
}
