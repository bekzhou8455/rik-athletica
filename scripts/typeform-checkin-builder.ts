/**
 * scripts/typeform-checkin-builder.ts
 *
 * Builds (or updates) the Sprint/Premium per-key-session check-in Typeform
 * via the Typeform Create API. Requires Business tier.
 *
 * Setup:
 *   1. Typeform dashboard → top-right avatar → Settings → Personal tokens
 *      → Generate new token → scopes: forms:read, forms:write, themes:read
 *      → copy the token (starts with `tfp_`)
 *   2. Save it to ~/.config/rik/typeform-token (chmod 600), or export inline:
 *
 *        export TYPEFORM_TOKEN="tfp_..."
 *
 *   3. Run:
 *        bun scripts/typeform-checkin-builder.ts          # creates a new form
 *        bun scripts/typeform-checkin-builder.ts <id>     # updates existing form
 *
 *   The current live check-in form ID is `01KPBSN0NVX9TGYX94M38YSSDQ` (the one
 *   embedded on /checkin via data-tf-live). To overwrite that form, pass it as
 *   the first arg. To create a parallel form for testing, pass nothing.
 *
 * What this script does NOT do:
 *   - Apply a custom theme (set via dashboard after creation — see DESIGN
 *     DIMENSIONS comment block at bottom for image specs)
 *   - Wire the webhook (set via dashboard: Form Settings → Connect → Webhooks
 *     → POST https://www.rikathletica.com/api/checkin)
 *   - Wire data passing into Kit (handled by api/checkin.js)
 */

const TYPEFORM_API = 'https://api.typeform.com';
const TOKEN = process.env.TYPEFORM_TOKEN;
if (!TOKEN) {
  console.error('Missing TYPEFORM_TOKEN env var. See header comment for setup.');
  process.exit(1);
}

// ─── Form definition ────────────────────────────────────────────────────────
// Using ref values lets logic-jumps + webhook payloads reference fields by a
// stable string instead of fragile auto-generated IDs.
const formSpec = {
  title: 'RIK Sprint · Per-Key-Session Check-in',
  type: 'form',

  // ─── Welcome screen ───
  welcome_screens: [{
    ref: 'welcome',
    title: 'How did Your key session go?',
    properties: {
      description: 'Quick tune-up after Your key session. ~90 seconds. Honest answers tune next week.',
      show_button: true,
      button_text: 'Start',
    },
  }],

  // ─── Hidden fields (URL-prefilled by S4 + P3 emails via {{checkin_link}}) ───
  hidden: ['email', 'athlete_name', 'session_date'],

  // ─── Questions ───
  fields: [
    {
      ref: 'q1_email_confirm',
      title: 'Confirm Your email',
      type: 'email',
      validations: { required: true },
      properties: {
        description: 'Pre-filled from Your link. Just hit Enter to continue.',
      },
    },
    {
      ref: 'q2_session_date',
      title: 'Which session is this for?',
      type: 'date',
      validations: { required: true },
      properties: {
        description: 'Today or yesterday. Older sessions roll into next week\'s review.',
        structure: 'YYYY-MM-DD',
      },
    },
    {
      ref: 'q3_session_type',
      title: 'Session type',
      type: 'multiple_choice',
      validations: { required: true },
      properties: {
        allow_multiple_selection: false,
        allow_other_choice: false,
        choices: [
          { ref: 'long_bike',      label: 'Long bike' },
          { ref: 'long_run',       label: 'Long run' },
          { ref: 'brick',          label: 'Brick (bike → run)' },
          { ref: 'threshold',      label: 'Threshold / intervals' },
          { ref: 'race_pace',      label: 'Race-pace simulation' },
          { ref: 'recovery',       label: 'Recovery / Z2 endurance' },
          { ref: 'other',          label: 'Other' },
        ],
      },
    },
    {
      ref: 'q4_protocol_adherence',
      title: 'Did You execute the prescribed fueling exactly?',
      type: 'multiple_choice',
      validations: { required: true },
      properties: {
        description: 'Pillar 1 — follow the protocol. Honest answers, not aspirational.',
        allow_multiple_selection: false,
        allow_other_choice: false,
        choices: [
          { ref: 'yes_exact',   label: 'Yes — exactly as prescribed' },
          { ref: 'mostly',      label: 'Mostly — minor deviations' },
          { ref: 'no_drifted',  label: 'No — drifted significantly' },
          { ref: 'skipped',     label: 'Skipped fueling entirely' },
        ],
      },
    },
    {
      ref: 'q5_gut_tolerance',
      title: 'Gut tolerance during the session',
      type: 'opinion_scale',
      validations: { required: true },
      properties: {
        description: '1 = bloat / cramping / diarrhea forced a stop · 5 = nothing felt off',
        steps: 5,
        start_at_one: true,
        labels: { left: 'Forced a stop', right: 'Felt nothing' },
      },
    },
    {
      ref: 'q6_energy_curve',
      title: 'Energy curve',
      type: 'multiple_choice',
      validations: { required: true },
      properties: {
        allow_multiple_selection: false,
        allow_other_choice: true,
        choices: [
          { ref: 'steady',          label: 'Steady throughout' },
          { ref: 'late_crash',      label: 'Late-session crash' },
          { ref: 'mid_crash',       label: 'Mid-session crash' },
          { ref: 'strong_to_bonk',  label: 'Felt strong → bonked' },
        ],
      },
    },
    {
      ref: 'q7_surprise',
      title: 'One thing that surprised You',
      type: 'long_text',
      validations: { required: false },
      properties: {
        description: 'Optional. Anything: gel taste, hydration timing, gut feedback, energy at hour 3.',
      },
    },
    // ─── NEW Pillar-3 questions ───
    {
      ref: 'q8_plan_status',
      title: "Have You uploaded next week's training plan?",
      type: 'multiple_choice',
      validations: { required: true },
      properties: {
        description: 'Pillar 3 — submit next week\'s plan so We can calibrate fueling against it.',
        allow_multiple_selection: false,
        allow_other_choice: false,
        choices: [
          { ref: 'plan_yes',     label: "Yes — I'll upload it below" },
          { ref: 'plan_no',      label: "No — I'll send it later this week" },
          { ref: 'plan_pending', label: "Coach hasn't sent it yet" },
        ],
      },
    },
    {
      ref: 'q9_plan_upload',
      title: "Upload next week's training plan",
      type: 'file_upload',
      validations: { required: false },
      properties: {
        description: 'PDF · JPG · PNG · screenshots all OK. Skip if Q8 said \'No\' or \'Pending\'.',
      },
    },
  ],

  // ─── Logic jumps ───
  logic: [
    // If Q2 (session date) is more than 36h old, jump to a hard-stop thank-you.
    // Typeform doesn't have a direct "older than X" comparator at the top of
    // form-build — but Q2 has a built-in relative-date validator that's set
    // via dashboard post-import (see README addendum).
    //
    // If Q8 ≠ 'plan_yes', skip Q9 (skip the upload).
    {
      type: 'field',
      ref: 'q8_plan_status',
      actions: [
        {
          action: 'jump',
          details: { to: { type: 'field', value: 'q9_plan_upload' } },
          condition: {
            op: 'equal',
            vars: [
              { type: 'field', value: 'q8_plan_status' },
              { type: 'choice', value: 'plan_yes' },
            ],
          },
        },
        {
          // else → jump straight to thank-you, skipping Q9
          action: 'jump',
          details: { to: { type: 'thankyou', value: 'thanks' } },
          condition: { op: 'always', vars: [] },
        },
      ],
    },
  ],

  // ─── Thank-you screen ───
  thankyou_screens: [{
    ref: 'thanks',
    title: "Got it. Your protocol revision is queued.",
    properties: {
      show_button: true,
      button_text: 'Open WhatsApp',
      button_mode: 'redirect',
      redirect_url: 'https://wa.me/16263609822?text=Hi%20RIK%20%E2%80%94%20',
      share_icons: false,
    },
  }],

  // ─── Settings ───
  settings: {
    language: 'en',
    progress_bar: 'percentage',
    show_progress_bar: true,
    show_typeform_branding: false, // requires Business tier
    is_public: true,
    is_trial: false,
    meta: {
      allow_indexing: false, // noindex — athlete-only utility
    },
  },

  variables: {
    score: 0, // unused but Typeform's API is happier when this is declared
  },
};

// ─── Execute ────────────────────────────────────────────────────────────────
const formId = process.argv[2];
const isUpdate = !!formId;
const url   = isUpdate ? `${TYPEFORM_API}/forms/${formId}` : `${TYPEFORM_API}/forms`;
const method = isUpdate ? 'PUT' : 'POST';

console.log(`${isUpdate ? 'Updating' : 'Creating'} form via ${method} ${url}`);

const res = await fetch(url, {
  method,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type':  'application/json',
  },
  body: JSON.stringify(formSpec),
});

if (!res.ok) {
  const err = await res.text();
  console.error(`✗ Typeform API ${res.status}: ${err}`);
  process.exit(1);
}

const data = await res.json() as { id: string; _links?: { display?: string } };
console.log(`✓ Form ${isUpdate ? 'updated' : 'created'}: id=${data.id}`);
if (data._links?.display) console.log(`  Public URL: ${data._links.display}`);
console.log('');
console.log('Next steps (manual, in Typeform dashboard):');
console.log('  1. Settings → Connect → Webhooks → add https://www.rikathletica.com/api/checkin');
console.log('  2. Design → Theme → upload background image (1920×1080 desktop, 1080×1920 mobile)');
console.log('  3. Design → Theme → Outfit font (or fallback Inter), buttons #0E0E0E, accent #5A5853');
console.log('  4. Q2 settings → Date validation → relative range: today minus 1 day to today');
console.log('  5. Update checkin.html → swap data-tf-live="01KPBSN0NVX9TGYX94M38YSSDQ" → "' + data.id + '"');
console.log('  6. Smoke-test by submitting yourself, verify webhook hit /api/checkin in logs');

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN DIMENSIONS — for the background image You're going to design
   ═══════════════════════════════════════════════════════════════════════════

   Typeform background image specs (Theme panel → Background):

   ┌────────────────┬─────────────────┬────────────────────────────────────┐
   │ Surface         │ Recommended size │ Notes                              │
   ├────────────────┼─────────────────┼────────────────────────────────────┤
   │ Desktop bg      │ 1920 × 1080 px   │ 16:9, ≤5 MB, JPG or PNG. Center-   │
   │                 │                  │ safe area: middle 60% (form panel  │
   │                 │                  │ overlays the right 40% on desktop). │
   │ Desktop @2x     │ 3840 × 2160 px   │ Optional retina. Same composition. │
   │ Mobile bg       │ 1080 × 1920 px   │ 9:16. Form panel overlays bottom   │
   │                 │                  │ 70% on mobile — focus image to    │
   │                 │                  │ top 30% (sky / horizon / hero).   │
   │ Welcome screen  │ Same as desktop  │ Typeform reuses background asset. │
   │ Logo (optional) │ 1000 × 1000 max  │ Transparent PNG, ≤500 KB.         │
   └────────────────┴─────────────────┴────────────────────────────────────┘

   Voice-aligned creative direction (per RIK iter-5):
   - Sand-tone or flat ink overlay (NOT photo-realistic gym shots — feels stocky)
   - Single grain-textured surface (paper / desert / training-log notebook)
   - Optional iter-5 motif: stopwatch · hex grid · gel-foil silhouette
   - Avoid lifestyle photography of athletes mid-race — too literal, feels like
     every other endurance brand. The check-in form is a quiet workspace, not a
     billboard. Think notebook page.
   - Hex code palette (must match):
       Background base:  #EEEDEA  (sand)
       Ink primary:      #0E0E0E  (near-black)
       Ink subdued:      #5A5853  (warm grey)
       Accent (sparse):  #C7A972  (heritage gold — use ≤2% of pixels)

   Claude prompt You can paste into Claude.ai or Photoshop Generative Fill:
   "Generate a 1920×1080 muted sand-paper texture with subtle grain. Tonal
    range #E8E5DE to #EEEDEA, 5% noise, no objects, no text. The middle 60%
    must read as a quiet workspace surface — Typeform's form panel will sit
    over the right 40%. Mood: athlete's training log notebook, not gym
    photography. Output JPG, sRGB, 95 quality."
   ═══════════════════════════════════════════════════════════════════════════ */
