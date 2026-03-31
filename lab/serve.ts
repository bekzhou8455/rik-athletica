import { join } from 'path';
import { parseIntakeCSV } from './lib/intake-parser.ts';
import { parseTrainingPlan } from './lib/training-plan-parser.ts';
import { scoreQuality, scoreIntakeQuality, scoreTrainingPlanQuality } from './lib/quality-scorer.ts';
import { checkRedFlags } from './lib/red-flag-checker.ts';
import { parseFeedbackCSV, buildAdjustmentBrief } from './lib/feedback-parser.ts';
import { applyFeedbackModifiers } from './lib/carb-calculator.ts';
import { formatForAudit, formatForPrint, formatCarrySheet } from './lib/protocol-formatter.ts';
import { validateProtocol } from './lib/validator.ts';
import { analyseRaceFueling } from './lib/analysis.ts';
import { parseSplitsCsv } from './lib/split-parser.ts';
import { generateICS } from './lib/ics-generator.ts';
import {
  notifyGenerationFailed,
  notifyProtocolReady,
  notifyEscalated,
  notifyApproved,
} from './lib/notifier.ts';
import type { SessionState, ProtocolDraft, AuditVerdict, AthleteProfile, TrainingSession } from './lib/types.ts';

// Load .env.local manually — Bun's --env-file doesn't reliably populate process.env
const LAB_DIR = import.meta.dir;
try {
  const envFile = Bun.file(join(LAB_DIR, '.env.local'));
  if (await envFile.exists()) {
    const envText = await envFile.text();
    for (const line of envText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (key && value) process.env[key] = value;
    }
  }
} catch { /* ignore */ }

const PORT = 3457;
const SESSIONS_DIR = join(LAB_DIR, 'sessions');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB

// Ensure sessions directory exists
await Bun.file(SESSIONS_DIR).exists().catch(() => false);
try {
  await Bun.write(join(SESSIONS_DIR, '.gitkeep'), '');
} catch {
  // Directory may already exist
}

// ── Session persistence ────────────────────────────────────────────────────────

async function loadSession(sessionId: string): Promise<SessionState | null> {
  const path = join(SESSIONS_DIR, `${sessionId}.json`);
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  try {
    return JSON.parse(await file.text()) as SessionState;
  } catch {
    return null;
  }
}

async function saveSession(sessionId: string, state: SessionState): Promise<void> {
  const path = join(SESSIONS_DIR, `${sessionId}.json`);
  await Bun.write(path, JSON.stringify(state, null, 2));
}

async function listSessions(): Promise<string[]> {
  const glob = new Bun.Glob('*.json');
  const sessions: string[] = [];
  for await (const file of glob.scan({ cwd: SESSIONS_DIR })) {
    if (file !== '.gitkeep.json') {
      sessions.push(file.replace('.json', ''));
    }
  }
  return sessions.sort().reverse();
}

// ── SSE helpers ───────────────────────────────────────────────────────────────

function sseEvent(type: string, data: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...data })}\n\n`;
}

function createSSEStream() {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  function send(type: string, data: Record<string, unknown>) {
    controller.enqueue(encoder.encode(sseEvent(type, data)));
  }

  function close() {
    try {
      controller.close();
    } catch {
      // Already closed
    }
  }

  return { stream, send, close };
}

// ── Claude API helpers ────────────────────────────────────────────────────────

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 8192
): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as { content: { type: string; text: string }[] };
  return data.content[0]?.text || '';
}

async function callClaudeWithRetry(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 8192,
  retries = 1
): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await callClaude(systemPrompt, userMessage, maxTokens);
    } catch (e) {
      lastError = e as Error;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
      }
    }
  }
  throw lastError!;
}

// ── Load prompt files ─────────────────────────────────────────────────────────

async function loadPrompt(filename: string): Promise<string> {
  const path = join(LAB_DIR, 'prompts', filename);
  return Bun.file(path).text();
}

// ── Build Architect user message ──────────────────────────────────────────────

function buildArchitectMessage(
  profile: AthleteProfile,
  sessions: TrainingSession[],
  iterationContext: string,
  productsCsv: string,
  weeksToGenerate: number = 1
): string {
  const eventLabel = profile.eventType === 'ironman_140' ? 'IRONMAN 140.6' : 'IRONMAN 70.3';

  return `# Athlete Profile

**Name:** ${profile.name}
**Event:** ${eventLabel}
**Race Date:** ${profile.raceDate}
**Training Phase:** ${profile.trainingPhase}
${profile.historicalFinishTime ? `**Historical Finish Time:** ${profile.historicalFinishTime}` : ''}
${profile.goalFinishTime ? `**Goal Finish Time:** ${profile.goalFinishTime}` : ''}

## Training Load
- Weekly swim: ${profile.weeklyVolume.swim}hr
- Weekly bike: ${profile.weeklyVolume.bike}hr
- Weekly run: ${profile.weeklyVolume.run}hr
${profile.longSessionDurations.swim ? `- Longest swim: ${profile.longSessionDurations.swim}min` : ''}
${profile.longSessionDurations.bike ? `- Longest bike: ${profile.longSessionDurations.bike}min` : ''}
${profile.longSessionDurations.run ? `- Longest run: ${profile.longSessionDurations.run}min` : ''}

## Current Fueling
- Current products: ${profile.currentProducts.length > 0 ? profile.currentProducts.join(', ') : 'None specified'}
${profile.currentCarbTarget ? `- Current carb target: ${profile.currentCarbTarget}g/hr` : '- Current carb target: not specified'}
- GI history: ${profile.giHistory}
- Gut training status: ${profile.gutTrainingStatus}

## Physiological
- Body weight: ${profile.bodyWeight}kg
${profile.sweatRate ? `- Sweat rate: ${profile.sweatRate}mL/hr` : '- Sweat rate: not provided — use population estimate (~750mL/hr)'}
${profile.heatContext ? `- Heat context: ${profile.heatContext}` : '- Heat context: not specified — assume temperate'}
- CGM data available: ${profile.hasCGMData ? 'Yes' : 'No'}
${profile.dietaryRestrictions ? `- Dietary restrictions: ${profile.dietaryRestrictions}` : ''}

## Race Logistics
- Race type: ${profile.raceType === 'im_branded' ? 'Official IRONMAN-branded event (Maurten at aid stations on bike every 25km — compensates for supply gaps)' : profile.raceType === 'independent' ? 'Independent race (NO external nutrition at aid stations — full self-carry required on bike and run)' : 'Not specified — assume IRONMAN-branded for safety'}
- Bike configuration: ${profile.bikeConfig === 'standard_cages' ? 'Standard cages (Bottle A = DM320, Bottle B = plain water)' : profile.bikeConfig === 'aero_bars' ? 'Aero bars with cage (Aero bars = plain water ONLY — do not put fuel here; Cage = DM320)' : profile.bikeConfig === 'integrated_reservoir' ? 'Integrated reservoir (Reservoir = plain water; Cages = DM320)' : 'Not specified — assume standard cages'}
${profile.raceTemperature ? `- Expected race temperature: ${profile.raceTemperature} (${profile.raceTemperature === 'hot' ? 'electrolyte dosing UP — SaltStick every 20min not 30min' : profile.raceTemperature === 'extreme' ? 'EXTREME heat — consult race director; electrolytes every 15min; sodium target 1000-1500mg/hr' : profile.raceTemperature === 'cool' ? 'cool conditions — electrolytes standard frequency; hyponatremia risk from overdrinking still applies' : 'standard electrolyte frequency'})` : '- Expected race temperature: not specified — assume temperate'}
${profile.maxComfortableCarbsPerHour ? `- Self-reported max comfortable carbs: ${profile.maxComfortableCarbsPerHour}g/hr (binding ceiling — do not exceed)` : ''}

## Medical Notes
${profile.currentConditions ? `- Disclosed conditions: ${profile.currentConditions}` : '- No medical conditions disclosed'}
${profile.medications ? `- Prescription medications: ${profile.medications}` : '- No prescription medications'}
${profile.medicalHistory ? `- Additional health notes: ${profile.medicalHistory}` : ''}

## Lifestyle
${profile.occupation ? `- Occupation: ${profile.occupation}` : ''}
${profile.travelFrequency ? `- Travel frequency: ${profile.travelFrequency}` : ''}
${profile.coachRelationship ? `- Coach relationship: ${profile.coachRelationship}` : ''}

---

# Training Sessions (${sessions.length} sessions)

${sessions.map(s => `- ${s.date}: ${s.type} ${s.duration}min [${s.intensity}]${s.description ? ` — ${s.description}` : ''}`).join('\n')}

---

# Available Products (from products.csv)

${productsCsv}

---

${iterationContext ? `# Iteration Context\n\n${iterationContext}\n\n---\n\n` : ''}

---

# Generation Instructions

Generate **${weeksToGenerate} week${weeksToGenerate > 1 ? 's' : ''}** of protocol. ${weeksToGenerate === 1 ? 'Week 1 only. Do NOT include Week 2, Week 3, or Week 4 sections — they are not requested.' : `Weeks 1–${weeksToGenerate}. Do not generate beyond Week ${weeksToGenerate}.`} Always include the Race Day Plan and Assumption Flags regardless of week count.

Please build the complete nutrition protocol for this athlete following the system prompt instructions exactly.`;
}

// ── Demo mode protocol builder (no API key required) ──────────────────────────

function buildDemoProtocol(profile: AthleteProfile, sessions: TrainingSession[], iteration: number): string {
  const event = profile.eventType === 'ironman_140' ? 'IRONMAN 140.6' : 'IRONMAN 70.3';
  const weekLabel = iteration === 0 ? 1 : iteration + 1;
  const carbTarget = Math.max(40, (profile.currentCarbTarget || 60) - (profile.giHistory === 'significant' ? 10 : profile.giHistory === 'mild' ? 5 : 0) - (profile.gutTrainingStatus === 'none' ? 10 : profile.gutTrainingStatus === 'partial' ? 5 : 0));
  const raceBikeCarbTarget = profile.eventType === 'ironman_140' ? Math.min(80, carbTarget + 10) : Math.min(70, carbTarget + 5);
  const raceRunCarbTarget = profile.eventType === 'ironman_140' ? Math.min(55, carbTarget - 5) : Math.min(50, carbTarget - 5);
  const iterNote = iteration > 0 ? `\n> **Iteration ${iteration} adjustment** — protocol refined based on Week ${iteration} session feedback.\n` : '';

  const sessionRows = sessions.filter(s => s.type !== 'rest' && s.duration >= 60).slice(0, 5).map(s => {
    const sc = s.duration < 60 ? 0 : s.duration < 90 ? 35 : carbTarget;
    const euphoria = s.duration >= 60 ? `- **Euphoria:** 20–30 min pre-session (CNS priming, 100mg caffeine)\n` : '';
    const refuel = s.duration >= 90 ? `- **Refuel (intra):** at ${Math.floor(s.duration * 0.6)}min\n- **Refuel (post):** within 30min of finish\n` : `- **Refuel (post):** within 30min of finish\n`;
    const thirdParty = sc > 0 && s.type !== 'swim' ? `- **Carb target:** ${sc}g/hr → Maurten Gel 100 × ${Math.ceil(sc / 25)} per hour\n` : '';
    return `**${s.date} — ${s.type.charAt(0).toUpperCase() + s.type.slice(1)} (${s.duration}min, ${s.intensity})**\n${euphoria}${thirdParty}${refuel}`;
  }).join('\n---\n\n');

  return `## Week ${weekLabel} Protocol — ${profile.name}
### ${event} · Race: ${profile.raceDate}
${iterNote}
> ⚠ **DEMO MODE** — This protocol was generated without a live Claude API key. It uses a rule-based placeholder. Real AI-generated protocols will be significantly more detailed and personalised. Set \`ANTHROPIC_API_KEY\` to enable full generation.

---

## Athlete Summary

| Field | Value |
|-------|-------|
| Event | ${event} |
| Race date | ${profile.raceDate} |
| Training phase | ${profile.trainingPhase} |
| Body weight | ${profile.bodyWeight}kg |
| GI history | ${profile.giHistory} |
| Gut training status | ${profile.gutTrainingStatus} |
| Weekly volume | Swim ${profile.weeklyVolume.swim}hr · Bike ${profile.weeklyVolume.bike}hr · Run ${profile.weeklyVolume.run}hr |

---

## Carb Targets (Calculated)

| Session type | Duration | Carb target |
|-------------|----------|-------------|
| Swim | Any | No intra-session carbs |
| Bike/Run | 60–90min | 35g/hr |
| Bike/Run | >90min | **${carbTarget}g/hr** |
| Race — Bike | Full distance | **${raceBikeCarbTarget}g/hr** |
| Race — Run | Full distance | **${raceRunCarbTarget}g/hr** |

**Rationale:** Base target reduced from maximum for ${profile.giHistory} GI history${profile.gutTrainingStatus !== 'trained' ? ` and ${profile.gutTrainingStatus} gut training status` : ''}.

---

## Session Protocols — Week ${weekLabel}

${sessionRows || '_No sessions >60min found in training plan._'}

---

## Race-Day Plan — ${event}

### Pre-Race
- **T−30min:** Euphoria × 1 (CNS priming, 100mg caffeine from Yerba Mate)
- **T−15min:** 500mL electrolyte drink (sodium 600–800mg)

### Swim (no intra-swim fuelling)

### Bike — Target: ${raceBikeCarbTarget}g/hr
| Time | Action |
|------|--------|
| T+30min | Maurten Gel 100 × 1 + 250mL water |
| T+1hr | Refuel × 1 (23g carb, BCAA recovery matrix) |
| T+1hr30 | Maurten Gel 100 × 1 + 250mL water |
| T+2hr | Maurten Gel 100 × 1 |
| T+2hr30 | Refuel × 1 |
| Every 45min | Repeat pattern |

### Run — Target: ${raceRunCarbTarget}g/hr
- Maurten Gel 100 at km 5, 15, 25 (if ${event === 'IRONMAN 140.6' ? '42km' : '21km'} run)
- Refuel × 1 at mid-run
- Electrolyte drink at every aid station

---

## Assumption Flags

${!profile.sweatRate ? '- ⚠ **sweatRate:** not provided — using population estimate (750mL/hr)\n' : ''}\
${!profile.heatContext ? '- ⚠ **heatContext:** not specified — assuming temperate conditions\n' : ''}\
- ⚠ **Demo mode:** Replace with real AI-generated protocol once \`ANTHROPIC_API_KEY\` is configured`;
}

// ── Parse & Gate endpoint ─────────────────────────────────────────────────────

async function handleParseIntake(req: Request): Promise<Response> {
  const { stream, send, close } = createSSEStream();

  let sessionId = new URL(req.url).searchParams.get('sessionId') || 'unknown';

  (async () => {
    try {
      const formData = await req.formData();
      const intakeFile = formData.get('intake') as File | null;
      const trainingPlanFile = formData.get('trainingPlan') as File | null;
      const feedbackFile = formData.get('feedback') as File | null;
      const splitsFile = formData.get('splits') as File | null;
      const iterationStr = formData.get('iteration') as string | null;
      const iteration = parseInt(iterationStr || '0', 10) as 0 | 1 | 2 | 3;

      // Load or init session (sessionId may be 'new' before athlete name is known)
      let state = await loadSession(sessionId);
      if (!state) {
        state = {
          athleteId: sessionId,
          step: 'uploaded',
          currentIteration: 0,
          intake: null,
          sessions: null,
          redFlags: [],
          iterations: [],
          currentDraft: null,
          currentVerdict: null,
          revisionCount: 0,
          humanDecision: null,
        };
      }

      // Step 1: Parse intake CSV
      send('step', { step: 'parsing_intake', status: 'active', label: 'Parsing intake CSV' });

      let profile = state.intake;

      if (intakeFile && iteration === 0) {
        const intakeBuffer = Buffer.from(await intakeFile.arrayBuffer());
        profile = parseIntakeCSV(intakeBuffer.toString('utf-8'));
        state.intake = profile;
      } else if (!profile) {
        throw new Error('No intake data available. Please upload an intake CSV.');
      }

      send('step', { step: 'parsing_intake', status: 'completed', label: 'Parsing intake CSV' });

      // After parsing athlete name, assign a proper session ID (YYYYMMDD-slug)
      if (sessionId === 'new' || sessionId === 'unknown') {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const nameSlug = profile!.athleteId || 'athlete';
        const newSessionId = `${today}-${nameSlug}`;
        // Move session file if it already exists under 'new'
        const oldPath = join(SESSIONS_DIR, `${sessionId}.json`);
        const oldFile = Bun.file(oldPath);
        if (await oldFile.exists()) {
          await Bun.write(join(SESSIONS_DIR, '.gitkeep'), ''); // ensure dir
          // Delete old 'new.json' after rename
          state.athleteId = newSessionId;
          await saveSession(newSessionId, state);
          try { await (oldFile as any).unlink?.(); } catch {}
          // Best-effort delete of 'new.json' via fs
          try {
            const { unlink } = await import('node:fs/promises');
            await unlink(oldPath);
          } catch {}
        }
        sessionId = newSessionId;
        send('session_created', { sessionId: newSessionId });
      }

      // Step 2: Parse training plan (if provided)
      let trainingSessions = state.sessions || [];

      if (trainingPlanFile && iteration < 3) {
        send('step', { step: 'parsing_training', status: 'active', label: 'Parsing training plan (Claude Vision)' });
        const planBuffer = Buffer.from(await trainingPlanFile.arrayBuffer());
        trainingSessions = await parseTrainingPlan(ANTHROPIC_API_KEY!, planBuffer, trainingPlanFile.name);
        state.sessions = trainingSessions;
        send('step', { step: 'parsing_training', status: 'completed', label: `Parsing training plan — ${trainingSessions.length} sessions found` });
      } else if (iteration < 3 && trainingSessions.length === 0) {
        send('step', { step: 'parsing_training', status: 'skipped', label: 'No training plan uploaded' });
      } else if (iteration === 3) {
        send('step', { step: 'parsing_training', status: 'skipped', label: 'Race week — no training plan needed' });
      }

      // Step 3a: Parse race splits (optional, iteration 0 only, persists in session)
      if (splitsFile && iteration === 0) {
        const splitsText = Buffer.from(await splitsFile.arrayBuffer()).toString('utf-8');
        const parsed = parseSplitsCsv(splitsText);
        state.splitsData = parsed;
        if (parsed) {
          send('step', { step: 'parsing_splits', status: 'completed', label: `Race splits parsed — finish ${Math.round(parsed.finishMins)}min` });
        } else {
          send('step', { step: 'parsing_splits', status: 'skipped', label: 'Race splits CSV format not recognised — skipping' });
        }
      }

      // Step 3: Parse feedback (iterations 1-3)
      let feedbackData = null;
      let adjustmentBrief = null;

      if (feedbackFile && iteration > 0) {
        send('step', { step: 'parsing_feedback', status: 'active', label: 'Parsing feedback CSV' });
        const feedbackBuffer = Buffer.from(await feedbackFile.arrayBuffer());
        feedbackData = parseFeedbackCSV(feedbackBuffer);
        adjustmentBrief = buildAdjustmentBrief(feedbackData, state.iterations);
        send('step', { step: 'parsing_feedback', status: 'completed', label: 'Parsing feedback CSV' });
      }

      // Step 4: Quality check
      send('step', { step: 'quality_check', status: 'active', label: 'Running quality check' });
      const qualityResult = scoreQuality(profile!, trainingSessions);
      profile!.qualityScores = qualityResult.qualityScores;
      const intakeQuality = scoreIntakeQuality(profile!);
      const trainingQuality = scoreTrainingPlanQuality(trainingSessions);
      send('step', {
        step: 'quality_check',
        status: 'completed',
        label: 'Quality check complete',
        intakeQuality,
        trainingQuality,
        lowConfidenceFields: qualityResult.lowConfidenceFields,
      });

      // Step 5: Red flag check
      send('step', { step: 'red_flag_check', status: 'active', label: 'Running red flag check' });
      const redFlagResult = checkRedFlags(profile!);
      send('step', { step: 'red_flag_check', status: 'completed', label: 'Red flag check complete' });

      if (redFlagResult.blocked) {
        state.redFlags = redFlagResult.flags;
        state.step = 'flagged';
        await saveSession(sessionId, state);
        send('red_flag', {
          blocked: true,
          flags: redFlagResult.flags,
          reason: redFlagResult.reason,
        });
        send('done', { success: false, redFlagBlocked: true });
        close();
        return;
      }

      // Save updated state
      state.intake = profile;
      state.sessions = trainingSessions;
      state.redFlags = [];
      state.step = 'parsed';
      state.currentIteration = iteration;
      await saveSession(sessionId, state);

      // Send final summary
      send('parsed', {
        athleteName: profile!.name,
        eventType: profile!.eventType,
        raceDate: profile!.raceDate,
        intakeQuality,
        trainingQuality,
        lowConfidenceFields: qualityResult.lowConfidenceFields,
        sessionCount: trainingSessions.length,
        feedbackData: feedbackData ? {
          weekNumber: feedbackData.weekNumber,
          giRating: feedbackData.giRating,
          energyRating: feedbackData.energyRating,
        } : null,
        adjustmentBrief: adjustmentBrief,
      });
      send('done', { success: true });
    } catch (e) {
      const err = e as Error;
      send('error', { message: err.message });
      send('done', { success: false });
    } finally {
      close();
    }
  })();

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ── Generate endpoint ─────────────────────────────────────────────────────────

async function handleGenerate(req: Request): Promise<Response> {
  const { stream, send, close } = createSSEStream();

  const body = await req.json() as { sessionId: string; revisionBrief?: string; weeksToGenerate?: number };
  const { sessionId, revisionBrief, weeksToGenerate = 1 } = body;

  (async () => {
    try {
      const state = await loadSession(sessionId);
      if (!state || !state.intake) {
        throw new Error('Session not found or intake data missing');
      }

      send('step', { step: 'quality_passed', status: 'completed', label: 'Quality check passed' });

      // Build iteration context
      let iterationContext = '';
      if (state.currentIteration > 0 && state.iterations.length > 0) {
        const priorIter = state.iterations[state.iterations.length - 1];
        const cumulativeTarget = priorIter.cumulativeCarbTarget;
        const blacklisted = priorIter.blacklistedProducts;

        iterationContext = `**Current iteration:** ${state.currentIteration} of 3\n`;
        iterationContext += `**Carb target entering this iteration:** ${cumulativeTarget}g/hr\n`;
        if (blacklisted.length > 0) {
          iterationContext += `**BLACKLISTED PRODUCTS (do not include):** ${blacklisted.join(', ')}\n`;
        }
        if (priorIter.feedbackInput) {
          const fb = priorIter.feedbackInput;
          iterationContext += `\n**Prior week feedback:**\n`;
          iterationContext += `- GI rating: ${fb.giRating}/5\n`;
          iterationContext += `- Energy rating: ${fb.energyRating}/5\n`;
          iterationContext += `- Protocol adherence: ${fb.protocolAdherence ? 'Yes' : 'No'}\n`;
          if (fb.adherenceNotes) iterationContext += `- Adherence notes: ${fb.adherenceNotes}\n`;
          if (fb.intolerableProducts.length > 0) {
            iterationContext += `- Intolerable products: ${fb.intolerableProducts.join(', ')}\n`;
          }
        }
      }

      if (revisionBrief) {
        // Pass full issues JSON first (richer context than 200-word text alone)
        if (state.currentVerdict?.issues && state.currentVerdict.issues.length > 0) {
          iterationContext += `\n**REVISION ISSUES (FULL JSON — each must be explicitly resolved):**\n${JSON.stringify(state.currentVerdict.issues, null, 2)}\n`;
        }
        iterationContext += `\n**REVISION BRIEF FROM AUDITOR:**\n${revisionBrief}\n`;
        iterationContext += `This is revision ${state.revisionCount} of ${3}. Address ALL items in the revision brief. Every issue in the JSON above must be resolved in the rebuilt protocol.\n`;
      }

      // Load system prompts
      const [architectPrompt, productsCsv] = await Promise.all([
        loadPrompt('architect-system.md'),
        Bun.file(join(LAB_DIR, 'products.csv')).text(),
      ]);

      const architectPromptWithContext = architectPrompt;

      // Run fueling analysis (non-blocking — always returns a result)
      const diagnosis = analyseRaceFueling(state.intake!, state.splitsData ?? null);
      const diagnosisContext = [
        `## Fueling Diagnosis (pre-computed)`,
        `- Confidence: ${diagnosis.confidence}`,
        `- Estimated minutes lost to fueling: ${diagnosis.minutesLost !== null ? `~${diagnosis.minutesLost} min` : 'insufficient data'}`,
        `- Deficit bracket: ${diagnosis.deficitBracket}`,
        `- Analysis: ${diagnosis.explanation}`,
      ].join('\n');

      // Step: Generate with Architect AI
      send('step', { step: 'generating', status: 'active', label: 'Generating protocol (Architect AI)' });

      const userMessage = buildArchitectMessage(
        state.intake,
        state.sessions || [],
        iterationContext ? `${diagnosisContext}\n\n${iterationContext}` : diagnosisContext,
        productsCsv,
        weeksToGenerate
      );

      let protocolMarkdown: string;
      if (!ANTHROPIC_API_KEY) {
        // Demo mode — realistic placeholder protocol for UI testing without an API key
        await new Promise(r => setTimeout(r, 1800)); // simulate AI latency
        protocolMarkdown = buildDemoProtocol(state.intake!, state.sessions || [], state.currentIteration);
      } else {
        try {
          protocolMarkdown = await callClaudeWithRetry(architectPromptWithContext, userMessage, 8192, 1);
        } catch (e) {
          const err = e as Error;
          await notifyGenerationFailed(sessionId, err.message);
          throw new Error(`Architect AI failed: ${err.message}`);
        }
      }

      send('step', { step: 'generating', status: 'completed', label: 'Protocol generated' });

      // Step: Deterministic validation (before Auditor AI)
      send('step', { step: 'validating', status: 'active', label: 'Validating protocol (deterministic checks)' });
      const validationResult = await validateProtocol(protocolMarkdown, state.intake!, LAB_DIR);
      send('step', {
        step: 'validating',
        status: validationResult.outcome === 'PASS' ? 'completed' : 'failed',
        label: validationResult.outcome === 'PASS'
          ? `Validation passed${validationResult.warnings.length ? ` (${validationResult.warnings.length} warnings)` : ''}`
          : `Validation FAILED — ${validationResult.reasons.length} issue(s)`,
        warnings: validationResult.warnings,
        supplyList: validationResult.supplyList,
      });

      if (validationResult.outcome === 'FAIL') {
        send('error', {
          message: `Protocol failed deterministic validation:\n${validationResult.reasons.map(r => `• ${r}`).join('\n')}`,
          validationFail: true,
          reasons: validationResult.reasons,
        });
        send('done', { success: false });
        close();
        return;
      }

      // Build draft object
      const draft: ProtocolDraft = {
        athleteId: state.athleteId,
        generatedAt: new Date().toISOString(),
        weeksGenerated: 4,
        carbTargets: [],
        weeklySchedule: [],
        raceDayPlan: [],
        assumptionFlags: [],
        thirdPartyRecommendations: [],
        rawMarkdown: protocolMarkdown,
      };

      state.currentDraft = draft;

      // Step: Audit
      send('step', { step: 'auditing', status: 'active', label: 'Auditing protocol' });

      const auditorPrompt = await loadPrompt('auditor-system.md');
      const auditInput = formatForAudit(draft, state.intake);

      let auditResponseText: string;
      if (!ANTHROPIC_API_KEY) {
        // Demo mode — return a PASS verdict
        await new Promise(r => setTimeout(r, 800));
        auditResponseText = JSON.stringify({
          outcome: 'PASS',
          dimensionScores: {
            scientificAccuracy: 'PASS',
            catastrophicOutcomeCheck: 'PASS',
            productSpecCompliance: 'PASS',
            coherenceAndCompleteness: 'PASS',
          },
          issues: [],
          revisionBrief: null,
        });
      } else {
        try {
          auditResponseText = await callClaudeWithRetry(auditorPrompt, auditInput, 4096, 1);
        } catch (e) {
          const err = e as Error;
          throw new Error(`Auditor AI failed: ${err.message}`);
        }
      }

      // Parse audit response
      let verdict: AuditVerdict;
      try {
        const jsonMatch = auditResponseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in auditor response');
        verdict = JSON.parse(jsonMatch[0]) as AuditVerdict;
      } catch (e) {
        // If parsing fails, create a FLAG verdict
        verdict = {
          outcome: 'FLAG',
          dimensionScores: {
            scientificAccuracy: 'FLAG',
            catastrophicOutcomeCheck: 'PASS',
            productSpecCompliance: 'PASS',
            coherenceAndCompleteness: 'FLAG',
          },
          issues: [{
            dimension: 'coherenceAndCompleteness',
            severity: 'FLAG',
            description: `Auditor response could not be parsed: ${auditResponseText.substring(0, 200)}`,
          }],
          revisionBrief: 'Auditor could not parse response. Please review the protocol manually.',
        };
      }

      state.currentVerdict = verdict;
      state.step = 'review';

      await saveSession(sessionId, state);

      send('step', { step: 'auditing', status: 'completed', label: `Audit complete — ${verdict.outcome}` });

      // Notify
      await notifyProtocolReady(sessionId, state.currentIteration);

      send('ready', {
        verdict: verdict.outcome,
        draft: { rawMarkdown: protocolMarkdown },
        supplyList: validationResult.supplyList,
        validationWarnings: validationResult.warnings,
        diagnosis: { confidence: diagnosis.confidence, minutesLost: diagnosis.minutesLost, explanation: diagnosis.explanation },
        sessionId,
      });
      send('done', { success: true });
    } catch (e) {
      const err = e as Error;
      send('error', { message: err.message });
      send('done', { success: false });
    } finally {
      close();
    }
  })();

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ── Export endpoint ───────────────────────────────────────────────────────────

async function handleExport(req: Request): Promise<Response> {
  const body = await req.json() as { sessionId: string; format: 'ics' | 'html' | 'carry-sheet' | 'fueling-sheet' };
  const { sessionId, format } = body;

  const state = await loadSession(sessionId);
  if (!state || !state.intake) {
    return new Response(JSON.stringify({ error: 'Session or draft not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // After approval, currentDraft is cleared — fall back to last approved iteration's draft
  const draft = state.currentDraft
    ?? (state.iterations.length > 0 ? state.iterations[state.iterations.length - 1].draft : null);
  if (!draft) {
    return new Response(JSON.stringify({ error: 'No protocol draft found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (format === 'ics') {
    const { content, filename } = generateICS(
      state.sessions || [],
      draft,
      state.intake,
      state.currentIteration
    );

    return new Response(content, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  if (format === 'html') {
    const html = formatForPrint(draft, state.intake, state.currentIteration);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }

  if (format === 'carry-sheet') {
    const html = formatCarrySheet(draft, state.intake);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (format === 'fueling-sheet') {
    const { formatFuelingSheet } = await import('./lib/protocol-formatter.ts');
    const html = formatFuelingSheet(draft, state.intake);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return new Response(JSON.stringify({ error: 'Unknown format' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Session decision endpoint ─────────────────────────────────────────────────

async function handleDecision(req: Request, sessionId: string): Promise<Response> {
  const body = await req.json() as { decision: 'approved' | 'escalated' | 'return'; revisionBrief?: string };
  const { decision, revisionBrief } = body;

  const state = await loadSession(sessionId);
  if (!state) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (decision === 'approved') {
    // Move current draft to iterations[]
    if (state.currentDraft && state.currentVerdict) {
      const priorBlacklist = state.iterations.length > 0
        ? [...state.iterations[state.iterations.length - 1].blacklistedProducts]
        : [];

      // Collect newly blacklisted products from this iteration
      const newBlacklist: string[] = [];
      for (const iter of state.currentVerdict.issues) {
        // No product blacklisting from audit — that comes from feedback
      }

      state.iterations.push({
        iterationNumber: state.currentIteration,
        weekCovered: state.currentIteration === 3 ? 'race' : (state.currentIteration + 1) as 1 | 2 | 3,
        adjustmentsApplied: [],
        cumulativeCarbTarget: 60, // default; feedback parser sets this
        blacklistedProducts: priorBlacklist,
        draft: state.currentDraft,
        verdict: state.currentVerdict,
        humanDecision: 'approved',
        exportedAt: new Date().toISOString(),
      });
    }

    state.humanDecision = 'approved';
    state.step = state.currentIteration === 3 ? 'exported' : 'awaiting_feedback';
    state.currentDraft = null;
    state.currentVerdict = null;
    state.revisionCount = 0;

    await saveSession(sessionId, state);
    await notifyApproved(sessionId, state.currentIteration);

    return new Response(JSON.stringify({ success: true, step: state.step }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (decision === 'escalated') {
    state.humanDecision = 'escalated';
    state.step = 'exported';
    await saveSession(sessionId, state);
    await notifyEscalated(sessionId);

    return new Response(JSON.stringify({ success: true, step: 'exported' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (decision === 'return') {
    // Return to AI for revision
    state.revisionCount = (state.revisionCount || 0) + 1;

    if (state.revisionCount > 3) {
      // Auto-escalate
      state.humanDecision = 'escalated';
      state.step = 'exported';
      await saveSession(sessionId, state);
      await notifyEscalated(sessionId);
      return new Response(JSON.stringify({ success: true, autoEscalated: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    state.step = 'review';
    await saveSession(sessionId, state);

    return new Response(JSON.stringify({
      success: true,
      revisionCount: state.revisionCount,
      revisionBrief: revisionBrief || state.currentVerdict?.revisionBrief,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Unknown decision' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Static file serving ───────────────────────────────────────────────────────

async function serveStatic(pathname: string): Promise<Response> {
  // Sanitize path
  const safePath = pathname.replace(/\.\./g, '').replace(/^\//, '');
  const filePath = join(LAB_DIR, safePath);

  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(file);
}

// ── Main server ───────────────────────────────────────────────────────────────

const server = Bun.serve({
  port: PORT,
  idleTimeout: 0, // disable timeout — Claude API calls can take >10s
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // API routes
    if (pathname === '/api/parse-intake' && req.method === 'POST') {
      // Check body size
      const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
      if (contentLength > MAX_BODY_SIZE) {
        return new Response(JSON.stringify({ error: 'Request body too large (max 10MB)' }), {
          status: 413,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return handleParseIntake(req);
    }

    if (pathname === '/api/generate' && req.method === 'POST') {
      return handleGenerate(req);
    }

    if (pathname === '/api/export' && req.method === 'POST') {
      return handleExport(req);
    }

    // Session routes
    const sessionMatch = pathname.match(/^\/api\/session\/([^/]+)$/);
    if (sessionMatch && req.method === 'GET') {
      const sessionId = sessionMatch[1];
      const state = await loadSession(sessionId);
      if (!state) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(state), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const decisionMatch = pathname.match(/^\/api\/session\/([^/]+)\/decision$/);
    if (decisionMatch && req.method === 'POST') {
      return handleDecision(req, decisionMatch[1]);
    }

    // Sessions list
    if (pathname === '/api/sessions' && req.method === 'GET') {
      const sessions = await listSessions();
      return new Response(JSON.stringify({ sessions }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Static files — serve tool.html as default
    if (pathname === '/' || pathname === '') {
      return serveStatic('tool.html');
    }

    return serveStatic(pathname);
  },
});

console.log(`RIK Athletica Protocol Builder running at http://localhost:${PORT}`);
