// RIK Audit — Claude Haiku drafts the 3 personalization blocks.
// Locked prompt: voice, FTC-safe phrasing, no Emily citation, references only the engine output.

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

const SYSTEM_PROMPT = `You are drafting personalized text blocks for a RIK Athletica fueling audit. RIK is an endurance sports nutrition brand. The audit recipient is a triathlete or endurance athlete who filled out a 10-question form about their race, training, and current fueling.

VOICE: Direct, prescriptive, warm-but-professional. First-person ("I noticed..."). Like a knowledgeable friend who happens to be a fueling coach. Short sentences. No hype, no marketing language, no exclamation points.

ABSOLUTE RULES — NEVER VIOLATE:
1. Use ONLY the numbers in the engine output provided. Never invent or recall numbers from training. If a number is not in the engine block, do not state it.
2. Never use the words "guaranteed," "proven," "ensures," "cures," "treats," or "diagnoses." These are FTC violations for nutrition.
3. Use "supports," "designed to," "may help," "tends to" when describing nutrition effects.
4. Never name "Emily" or "RDN" or any specific person. The athlete-facing text must read as Bek's perspective.
5. Never mention a specific medical condition the athlete may have. Stay in performance/training language.
6. Never claim the recommended tier WILL produce a specific result. Frame as "this is the right fit for your situation because..."
7. Stop at the word counts specified for each block. Do not add intro/outro flourish.

You will return ONLY valid JSON in this exact shape:
{
  "what_i_noticed": "<3 sentences, ~60-80 words. Bek's read of the athlete's situation. Reference 1-2 specific things from their answers.>",
  "why_this_tier": "<3 sentences, ~60-80 words. Why the recommended tier fits THIS athlete's specific timeline + history. Do not name any other tier.>",
  "specific_question_answer": "<4 sentences, ~80-110 words. Direct answer to whatever they wrote in 'specificConcern'. If they wrote nothing or 'none', return: 'You didn't flag a specific question, so I focused on the gaps I noticed in your training profile.' (verbatim).>"
}

No markdown, no preamble, no apologies, no trailing prose. Pure JSON object only.`;

function buildUserPrompt(answers, engine) {
  const tier = engine.tier_recommendation;
  const trackA = engine.track_a;
  const trackB = engine.track_b;
  return `ATHLETE ANSWERS (verbatim from form):
${JSON.stringify({
  first_name: answers.firstName,
  race_distance: answers.raceDistance,
  race_date: answers.raceDate,
  target_time: answers.targetTime,
  weekly_hours: answers.weeklyHours,
  current_brands: answers.brands,
  carbs_per_hour_self_report: answers.carbsPerHour,
  gi_history: answers.giHistory,
  gi_notes: answers.giNotes,
  body_weight: `${answers.bodyWeight} ${answers.weightUnit}`,
  sweat_rate: answers.sweatRate,
  has_coach: answers.hasCoach,
  coach_name: answers.coachName,
  specific_concern: answers.specificConcern,
}, null, 2)}

ENGINE OUTPUT (use these numbers; do not invent):
- Weeks until race: ${engine.inputs_summary.weeks_out}
- Routed tier: ${tier.label} (reason: ${tier.reason})
- Routing explanation: ${tier.explanation}
- Race-day carb target: ${trackA.race_day_target_g_per_hr} g/hr (range ${trackA.race_day_target_range[0]}–${trackA.race_day_target_range[1]})
- Athlete's current carb estimate: ${trackB.athlete_carbs_per_hour_estimate} g/hr
- Carb deficit: ${trackB.carb_deficit_g_per_hour} g/hr
- Estimated minutes lost (RIK estimate, NOT clinical): ${trackB.minutes_lost_estimate.lo}–${trackB.minutes_lost_estimate.hi} min
- Sodium tier: ${trackA.sodium_tier} (bike ${trackA.sodium_bike_mg_per_hr} mg/hr, run ${trackA.sodium_run_mg_per_hr} mg/hr)
- GI-flagged track: ${trackA.gi_flagged}

Return only the JSON object.`;
}

export async function draftBlocks({ answers, engine }) {
  const client = getClient();
  const userPrompt = buildUserPrompt(answers, engine);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    temperature: 0.4,
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
  // Strip code-fence wrappers if model added them
  const stripped = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(stripped);
  } catch (e) {
    // Try to extract first JSON object from the text
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    throw new Error(`AI drafter returned non-JSON: ${text.slice(0, 200)}`);
  }
}

function validateDrafts(d) {
  const required = ['what_i_noticed', 'why_this_tier', 'specific_question_answer'];
  for (const key of required) {
    if (typeof d[key] !== 'string' || d[key].trim().length < 20) {
      throw new Error(`AI drafter missing or empty field: ${key}`);
    }
  }
  // Soft FTC check — flag any banned words for human review (don't reject; admin will see)
  const banned = ['guaranteed', 'guarantees', 'proven', 'ensures', 'cures', 'treats', 'diagnoses', 'Emily', 'RDN'];
  const allText = `${d.what_i_noticed} ${d.why_this_tier} ${d.specific_question_answer}`.toLowerCase();
  for (const word of banned) {
    if (allText.includes(word.toLowerCase())) {
      d._ftc_warning = (d._ftc_warning ?? []).concat(word);
    }
  }
}

// === Fallback for when AI fails — returns templated drafts so the queue never blocks ===
export function fallbackDrafts({ answers, engine }) {
  const tier = engine.tier_recommendation;
  const deficit = engine.track_b.carb_deficit_g_per_hour;
  const fn = answers.firstName ?? 'there';
  return {
    what_i_noticed:
      `Looking at your responses, your ${answers.raceDistance ?? 'race'} is ${engine.inputs_summary.weeks_out} weeks out and you're currently averaging around ${engine.track_b.athlete_carbs_per_hour_estimate} g/hr of carbs in training. ${deficit > 0 ? `That's ${deficit} g/hr below the race-day target for your distance.` : 'Your intake is roughly on target.'} The next step depends on your timeline more than your fueling per se.`,
    why_this_tier:
      tier.explanation,
    specific_question_answer: answers.specificConcern && answers.specificConcern.trim()
      ? `On your question: this is the kind of thing the recommended tier addresses directly — happy to go deeper if you reply with more context. The tier choice already accounts for your situation. If something isn't clear, hit reply.`
      : `You didn't flag a specific question, so I focused on the gaps I noticed in your training profile.`,
    _meta: { model: 'fallback', generated_at: new Date().toISOString() },
  };
}
