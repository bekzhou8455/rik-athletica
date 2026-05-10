/**
 * POST /api/screen-capture
 *
 * Persists Sprint screening-form submissions (name + email + race details)
 * from the inline form on /sprint to Postgres `sprint_screenings`. The daily
 * cron at /api/cron/daily-sweep.js then fires:
 *   - S1 email (cart-abandonment recovery) for `result=pass` athletes who
 *     didn't reach Stripe inside ~1 hour and haven't paid in 7 days
 *   - S2 email (screening-fail explainer) for `result=fail` athletes
 *
 * Frontend wiring (sprint.html line ~1192):
 *   fetch('/api/screen-capture', {
 *     method: 'POST',
 *     headers: {'Content-Type': 'application/json'},
 *     body: JSON.stringify({name, email, distance, race_date, hours, coach, result, referral, submitted_at}),
 *     keepalive: true   // fire-and-forget; we don't block the Stripe redirect
 *   });
 *
 * Server-side validation:
 *   We re-validate the screen result here even though the client claims
 *   `result: 'pass'` — never trust client. If race-window math says fail,
 *   we override the client value and persist as fail so S2 fires (and S1
 *   doesn't).
 *
 * Privacy: email + name are PII per /privacy. 18-month retention enforced
 * by daily cron purge (lib/db.js → purgeOldScreenings).
 *
 * Required env vars: POSTGRES_URL (set by Vercel Postgres integration)
 */

import { insertScreening } from '../lib/db.js';

// ─── Server-side re-validation of the screen-window logic ───
// Mirror of sprint.html's client-side rules. SOURCE OF TRUTH.
function recomputeResult({ raceDateStr, coach, distance, hours }) {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const minDate = new Date(today.getTime() + 28 * 86400 * 1000);
  const maxDate = new Date(today.getTime() + 56 * 86400 * 1000);
  const raceDate = new Date(raceDateStr);

  if (isNaN(raceDate.getTime())) {
    return { result: 'fail', failReason: 'Invalid race date.' };
  }
  if (raceDate < minDate) {
    const days = Math.ceil((raceDate - today) / 86400000);
    return { result: 'fail', failReason: `Race is ${days} days from sign-up — under our 28-day floor` };
  }
  if (raceDate > maxDate) {
    const days = Math.ceil((raceDate - today) / 86400000);
    return { result: 'fail', failReason: `Race is ${days} days from sign-up — over our 56-day ceiling` };
  }
  if (coach !== 'yes') {
    return { result: 'fail', failReason: 'Sprint requires an active coach or structured training plan' };
  }
  // Distance + hours are required but not gating; if they're missing we still
  // fail the row so the user gets a sane S2.
  if (!['703', 'full'].includes(distance)) {
    return { result: 'fail', failReason: 'Race distance not selected' };
  }
  if (!['low', 'mid', 'high'].includes(hours)) {
    return { result: 'fail', failReason: 'Training-volume tier not selected' };
  }
  return { result: 'pass', failReason: null };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  // ─── Method + CORS ───
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  // Same-origin only (rikathletica.com). Block cross-origin abuse.
  const origin = req.headers.origin || '';
  if (origin && !/^https:\/\/(www\.)?rikathletica\.com$/i.test(origin) && !/localhost/.test(origin)) {
    console.warn(`[screen-capture] Rejected cross-origin: ${origin}`);
    return res.status(403).json({ ok: false, error: 'Forbidden origin' });
  }

  // ─── Parse body (Vercel auto-parses JSON for us) ───
  const body = req.body || {};
  const name      = String(body.name      || '').trim().slice(0, 100);
  const email     = String(body.email     || '').trim().toLowerCase().slice(0, 200);
  const distance  = String(body.distance  || '');
  const raceDate  = String(body.race_date || '');
  const hours     = String(body.hours     || '');
  const coach     = String(body.coach     || '');
  const referral  = String(body.referral  || '').slice(0, 100) || null;
  const submitted = String(body.submitted_at || new Date().toISOString());

  // ─── Validation ───
  if (!name)               return res.status(400).json({ ok: false, error: 'name required' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'valid email required' });

  // Server re-runs the screen logic — client `result` is advisory, server overrides.
  const { result, failReason } = recomputeResult({ raceDateStr: raceDate, coach, distance, hours });

  // ─── Persist ───
  try {
    const row = await insertScreening({
      email,
      name,
      distance: ['703', 'full'].includes(distance) ? distance : '703', // safe default if missing — fail row anyway
      raceDate: raceDate || new Date().toISOString().slice(0, 10),
      hours:    ['low', 'mid', 'high'].includes(hours) ? hours : 'mid',
      coach:    coach || 'no',
      result,
      failReason,
      referral,
      submittedAt: submitted,
    });
    console.log(`[screen-capture] Persisted id=${row.id} email=${email} result=${result} reason=${failReason || ''}`);
    return res.status(200).json({ ok: true, id: row.id, result, fail_reason: failReason });
  } catch (err) {
    console.error('[screen-capture] DB write failed:', err.message);
    // Still return 200 so the keepalive fetch doesn't blow up the athlete's redirect to Stripe.
    // Ops sees the error in Vercel logs.
    return res.status(200).json({ ok: false, error: 'internal' });
  }
}
