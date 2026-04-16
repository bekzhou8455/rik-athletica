/**
 * POST /api/intake
 * Typeform Full Intake webhook handler.
 * Fires when an athlete submits the full intake form after payment.
 * Sends two immediate emails via Resend:
 *   1. Internal alert: "Race Pack for [name] — race [date] — ship by [date - 10 days]"
 *   2. Athlete confirmation: "We have your intake. Your Race Pack ships ~10 days before your race."
 *
 * Required env vars:
 *   RESEND_API_KEY            — re_... from resend.com
 *   INTERNAL_ALERT_EMAIL      — your email for Race Pack ship reminders
 *   TYPEFORM_WEBHOOK_SECRET   — from Typeform → Connect → Webhooks (intake form)
 *
 * Typeform webhook setup:
 *   URL: https://www.rikathletica.com/api/intake
 *   Enable signing
 *   Connect to: Full Intake Form
 *
 * IMPORTANT — Typeform field refs:
 *   After adding race_date, race_distance, email, name fields to the Typeform intake form,
 *   find each field's `ref` value in Typeform Builder → click field → Settings → Ref.
 *   Replace the placeholder values below with the actual ref strings.
 *
 *   TODO: replace these refs with actual values from your Typeform dashboard:
 */

// ─── TYPEFORM FIELD REFS ─────────────────────────────────────────────────────
// Sourced from: Typeform Builder → Block References (April 16 2026)
const FIELD_REFS = {
  // Core — used by webhook to send confirmation emails
  name:                        'athlete_name',
  email:                       'athlete_email',
  race_date:                   'race_date',
  race_distance:               'race_distance',

  // Race & goal
  training_phase:              'training_phase',
  body_weight:                 'body_weight_kg',
  biological_sex:              'biological_sex',
  occupation:                  'occupation',
  goal_finish_time:            'goal_finish_time',
  historical_finish_time_1406: 'historical_1406_finish_time',
  historical_finish_time_703:  'historical_703_finish_time',

  // Training load
  total_training_hours:        'total_training_hours',
  longest_bike:                'longest_bike_min',
  longest_run:                 'longest_run_min',
  coach_relationship:          'coach_relationship',
  travel_frequency:            'travel_frequency',

  // Fueling
  current_products:            'current_products',
  current_carb_target:         'current_carb_target',
  max_carbs_per_hour:          'max_carbs_per_hour',
  gi_history:                  'gi_history',
  intra_session_fueling:       'intra_session_fueling',
  gut_training_status:         'gut_training_status',

  // Physiology
  sweat_rate:                  'sweat_rate',
  heat_context:                'heat_context',
  cgm_data:                    'cgm_data',
  dietary_restrictions:        'dietary_restrictions',
  other_dietary:               'other_dietary',

  // Race logistics
  race_type:                   'race_type',
  bike_config:                 'bike_config',
  race_temperature:            'race_temperature',

  // File uploads
  training_plan_file:          'training_plan_file',
  activity_screenshots:        'activity_screenshots',
  race_splits_file:            'race_splits_file',

  // Medical
  arrhythmia_caffeine:         'arrhythmia_caffeine',
  hyponatremia:                'hyponatremia',
  cardiac_conditions:          'cardiac_conditions',
  gi_condition:                'gi_condition',
  gi_condition_description:    'gi_condition_description',
  pregnancy:                   'pregnancy',
  rhabdomyolysis:              'rhabdomyolysis',
  medications_yn:              'medications_yn',
  medications_list:            'medications_list',
  medical_history:             'medical_history',

  // Agreement
  age_confirm:                 'age_confirm',
  terms_agree:                 'terms_agree',
  athlete_signature:           'athlete_signature',
  signature_date:              'athlete_signature_date',
};
// ────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import { sendMail, mailerReady } from './mailer.js';

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatDate(dateStr) {
  if (!dateStr) return 'unknown date';
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- Verify Typeform HMAC signature ---
  const secret = process.env.TYPEFORM_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers['typeform-signature'] || '';
    const payload = JSON.stringify(req.body);
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('base64');
    if (sig !== expected) {
      console.warn('[intake] Invalid Typeform signature');
      return res.status(403).json({ error: 'Invalid signature' });
    }
  }

  // Skip partial responses — only process completed submissions
  const eventType = req.body?.event_type || '';
  if (eventType === 'form_response_partial') {
    console.log('[intake] Skipping partial response');
    return res.status(200).json({ ok: true, skipped: 'partial' });
  }

  const form = req.body?.form_response || {};
  const answers = form.answers || [];

  // Extract fields by ref
  const findAnswer  = (ref) => answers.find(a => a.field?.ref === ref);
  const txt  = (ref) => findAnswer(ref)?.text || '';
  const em   = (ref) => findAnswer(ref)?.email || '';
  const dt   = (ref) => findAnswer(ref)?.date || '';
  const ch   = (ref) => findAnswer(ref)?.choice?.label || findAnswer(ref)?.choices?.labels?.join(', ') || '';
  const num  = (ref) => findAnswer(ref)?.number ?? '';

  const name      = txt(FIELD_REFS.name) || 'Athlete';
  const email     = em(FIELD_REFS.email);
  const raceDate  = dt(FIELD_REFS.race_date);
  const distance  = ch(FIELD_REFS.race_distance);

  // Additional fields for internal summary
  const bodyWeight       = num(FIELD_REFS.body_weight);
  const biologicalSex    = ch(FIELD_REFS.biological_sex);
  const trainingPhase    = ch(FIELD_REFS.training_phase);
  const goalFinish       = txt(FIELD_REFS.goal_finish_time);
  const hist1406         = txt(FIELD_REFS.historical_finish_time_1406);
  const hist703          = txt(FIELD_REFS.historical_finish_time_703);
  const totalHours       = num(FIELD_REFS.total_training_hours);
  const longestBike      = num(FIELD_REFS.longest_bike);
  const longestRun       = num(FIELD_REFS.longest_run);
  const currentCarb      = num(FIELD_REFS.current_carb_target);
  const maxCarbs         = num(FIELD_REFS.max_carbs_per_hour);
  const giHistory        = ch(FIELD_REFS.gi_history);
  const gutTraining      = ch(FIELD_REFS.gut_training_status);
  const sweatRate        = ch(FIELD_REFS.sweat_rate);
  const heatContext      = ch(FIELD_REFS.heat_context);
  const raceTemp         = ch(FIELD_REFS.race_temperature);
  const currentProducts  = txt(FIELD_REFS.current_products);
  const dietaryRestrict  = ch(FIELD_REFS.dietary_restrictions);
  const medicalHistory   = txt(FIELD_REFS.medical_history);
  const occupation       = ch(FIELD_REFS.occupation);

  const shipByDate    = raceDate ? addDays(raceDate, -10) : '';
  const raceDateFmt   = formatDate(raceDate);
  const shipByFmt     = formatDate(shipByDate);
  const submittedAt   = form.submitted_at || new Date().toISOString();

  console.log(`[intake] name=${name} email=${email} race=${raceDate} distance=${distance} shipBy=${shipByDate} ts=${submittedAt}`);

  const alertEmail = process.env.INTERNAL_ALERT_EMAIL;

  if (!mailerReady()) {
    console.warn('[intake] Gmail credentials not set — emails not sent');
    return res.status(200).json({ ok: true, sent: false });
  }

  // Send both emails concurrently
  const sendEmail = async (to, subject, html) => {
    try {
      await sendMail({ to, subject, html });
      return true;
    } catch (err) {
      console.error(`[intake] Mail error for ${to}:`, err.message);
      return false;
    }
  };

  const emails = [];

  // Email 1: Internal new intake alert + Race Pack reminder (merged)
  if (alertEmail) {
    const row = (label, value) => value
      ? `<tr><td style="padding:7px 16px 7px 0;color:#888;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:7px 0;color:#111;">${value}</td></tr>`
      : '';
    emails.push(sendEmail(
      alertEmail,
      `New intake: ${name} — ${distance} — race ${raceDate}`,
      `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Helvetica,Arial,sans-serif;padding:32px;max-width:600px;color:#111;">

  <h2 style="margin:0 0 4px;color:#2D5A3D;">New Intake Received</h2>
  <p style="font-size:13px;color:#aaa;margin:0 0 28px;">Submitted ${submittedAt.replace('T',' ').slice(0,16)} UTC</p>

  <!-- Athlete & Race -->
  <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#2D5A3D;margin:0 0 8px;">Athlete</h3>
  <table style="font-size:14px;border-collapse:collapse;margin-bottom:24px;">
    ${row('Name', name)}
    ${row('Email', email)}
    ${row('Distance', distance)}
    ${row('Race Date', raceDateFmt)}
    ${row('Sex', biologicalSex)}
    ${row('Weight', bodyWeight ? bodyWeight + ' kg' : '')}
    ${row('Occupation', occupation)}
  </table>

  <!-- Performance -->
  <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#2D5A3D;margin:0 0 8px;">Performance</h3>
  <table style="font-size:14px;border-collapse:collapse;margin-bottom:24px;">
    ${row('Goal finish', goalFinish)}
    ${row('Historical 140.6', hist1406)}
    ${row('Historical 70.3', hist703)}
    ${row('Training phase', trainingPhase)}
    ${row('Weekly hours', totalHours ? totalHours + ' hrs' : '')}
    ${row('Longest bike', longestBike ? longestBike + ' min' : '')}
    ${row('Longest run', longestRun ? longestRun + ' min' : '')}
  </table>

  <!-- Fueling -->
  <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#2D5A3D;margin:0 0 8px;">Fueling</h3>
  <table style="font-size:14px;border-collapse:collapse;margin-bottom:24px;">
    ${row('Current carb target', currentCarb ? currentCarb + ' g/hr' : '')}
    ${row('Max carbs/hr', maxCarbs ? maxCarbs + ' g/hr' : '')}
    ${row('GI history', giHistory)}
    ${row('Gut training', gutTraining)}
    ${row('Current products', currentProducts)}
    ${row('Dietary restrictions', dietaryRestrict)}
  </table>

  <!-- Environment -->
  <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#2D5A3D;margin:0 0 8px;">Environment</h3>
  <table style="font-size:14px;border-collapse:collapse;margin-bottom:24px;">
    ${row('Sweat rate', sweatRate)}
    ${row('Heat context', heatContext)}
    ${row('Race temperature', raceTemp)}
  </table>

  ${medicalHistory ? `
  <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#c0392b;margin:0 0 8px;">Medical notes</h3>
  <p style="font-size:14px;color:#111;margin:0 0 24px;">${medicalHistory}</p>
  ` : ''}

  <!-- Race Pack action -->
  <div style="background:#fff5f5;border:1px solid #f5c6c6;border-radius:8px;padding:20px;margin-top:8px;">
    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#c0392b;">📦 Race Pack — ship by ${shipByFmt}</p>
    <p style="margin:0;font-size:13px;color:#888;">Submit pick list to ShipWizard before this date. Set a calendar reminder.</p>
  </div>

</body>
</html>`,
    ));
  }

  // Email 2: Athlete Race Pack confirmation
  if (email) {
    emails.push(sendEmail(
      email,
      'Your intake is in — here\'s what happens next',
      `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F5F1;font-family:Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">

  <div style="margin-bottom:32px;">
    <img src="https://cdn.jsdelivr.net/gh/bekzhou8455/rik-athletica@main/assets/media/rik-logo.png" alt="RIK Athletica" style="height:40px;width:auto;">
  </div>

  <h1 style="font-size:24px;font-weight:600;color:#111410;letter-spacing:-0.03em;margin:0 0 10px;">
    Intake received, ${name}.
  </h1>
  <p style="font-size:15px;color:#6B6860;line-height:1.65;margin:0 0 28px;">
    We're building your fueling protocol now. Here's what's happening next.
  </p>

  <div style="height:1px;background:#E4E1DA;margin:0 0 28px;"></div>

  <div style="margin-bottom:20px;">
    <div style="font-size:11px;font-weight:700;color:#2D5A3D;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">Training Box</div>
    <p style="font-size:14px;color:#6B6860;line-height:1.6;margin:0;">
      Shipping within 5 days. Your RIK Bundle + Layer 1 training products, packed to your protocol.
    </p>
  </div>

  <div style="margin-bottom:20px;">
    <div style="font-size:11px;font-weight:700;color:#2D5A3D;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">3 Protocol Iterations</div>
    <p style="font-size:14px;color:#6B6860;line-height:1.6;margin:0 0 14px;">
      After each key session — long bike, long run, brick, or race simulation — fill in a quick check-in. We use it to refine your protocol each week. By Week 4, your race-day protocol is locked in.
    </p>
    <a href="https://www.rikathletica.com/checkin?email=${encodeURIComponent(email)}&athlete_name=${encodeURIComponent(name)}"
       style="display:inline-block;background:#2D5A3D;color:#fff;text-decoration:none;font-size:13px;font-weight:500;padding:11px 22px;border-radius:36px;">
      Bookmark your check-in page →
    </a>
  </div>

  <div style="margin-bottom:36px;">
    <div style="font-size:11px;font-weight:700;color:#2D5A3D;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">Race Pack (Add-on)</div>
    <p style="font-size:14px;color:#6B6860;line-height:1.6;margin:0;">
      Want race-day products selected to your final protocol? Add the Race Pack before Week 4 and it ships approximately 10 days before your race${raceDate ? ` on <strong style="color:#111410;">${raceDateFmt}</strong>` : ''}.
    </p>
  </div>

  <div style="height:1px;background:#E4E1DA;margin:0 0 20px;"></div>
  <p style="font-size:11px;color:#9C9890;line-height:1.6;margin:0;">
    Questions? Reply to this email or WhatsApp us.
    &nbsp;·&nbsp; <a href="https://www.rikathletica.com/privacy" style="color:#9C9890;">Privacy</a>
    &nbsp;·&nbsp; RIK Athletic Nutrition Inc.
  </p>

</div>
</body>
</html>`,
    ));
  }

  await Promise.all(emails);

  return res.status(200).json({ ok: true, sent: emails.length > 0 });
}
