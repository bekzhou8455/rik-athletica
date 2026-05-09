// RIK Audit — Postgres data layer.
// Schema lives in scripts/migrate.js. Queries here are the only DB surface area.

import { sql } from '@vercel/postgres';
import { randomBytes } from 'node:crypto';

// === Slug generation (8 chars, URL-safe, unguessable) ===
export function newSlug() {
  // 6 random bytes → 8-char base64url
  return randomBytes(6).toString('base64url').slice(0, 8);
}

// === Insert at submit time ===
export async function insertAudit({
  email,
  firstName,
  answers,
  engine,
  drafts,
  utmSource,
  utmMedium,
  utmCampaign,
  clubRef,
}) {
  const result = await sql`
    INSERT INTO audits (
      email, first_name, answers, engine, drafts,
      utm_source, utm_medium, utm_campaign, club_ref,
      status, methodology_version, routing_version
    ) VALUES (
      ${email}, ${firstName},
      ${JSON.stringify(answers)},
      ${JSON.stringify(engine)},
      ${JSON.stringify(drafts)},
      ${utmSource}, ${utmMedium}, ${utmCampaign}, ${clubRef},
      'drafted',
      ${engine.methodology_version},
      ${engine.routing_version}
    )
    RETURNING id, email, first_name, status, submitted_at;
  `;
  return result.rows[0];
}

// === Fetch one row by id (admin) ===
export async function getAuditById(id) {
  const result = await sql`
    SELECT * FROM audits WHERE id = ${id} LIMIT 1;
  `;
  return result.rows[0] ?? null;
}

// === Fetch one row by slug (public renderer) ===
export async function getAuditBySlug(slug) {
  const result = await sql`
    SELECT id, email, first_name, answers, engine, drafts_final, slug,
           delivered_at, pdf_url
    FROM audits
    WHERE slug = ${slug} AND status = 'delivered'
    LIMIT 1;
  `;
  return result.rows[0] ?? null;
}

// === Update drafts (admin edits AI draft text) ===
export async function updateDrafts(id, drafts) {
  await sql`
    UPDATE audits SET drafts = ${JSON.stringify(drafts)}, updated_at = NOW()
    WHERE id = ${id};
  `;
}

// === Mark approved + delivered (called by approve endpoint) ===
export async function markDelivered(id, { slug, pdfUrl, draftsFinal }) {
  await sql`
    UPDATE audits SET
      status = 'delivered',
      slug = ${slug},
      pdf_url = ${pdfUrl},
      drafts_final = ${JSON.stringify(draftsFinal)},
      delivered_at = NOW(),
      updated_at = NOW()
    WHERE id = ${id};
  `;
}

// === List for admin queue (paginated, by status) ===
export async function listAudits({ status, limit = 50, offset = 0 }) {
  if (status === 'all') {
    const result = await sql`
      SELECT id, email, first_name, answers, engine, drafts, status,
             submitted_at, delivered_at, converted_at, converted_tier, converted_amount, slug
      FROM audits
      ORDER BY submitted_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;
    return result.rows;
  }
  if (status === 'converted') {
    const result = await sql`
      SELECT id, email, first_name, answers, engine, status,
             submitted_at, delivered_at, converted_at, converted_tier, converted_amount, slug
      FROM audits
      WHERE converted_at IS NOT NULL
      ORDER BY converted_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;
    return result.rows;
  }
  const result = await sql`
    SELECT id, email, first_name, answers, engine, drafts, status,
           submitted_at, delivered_at, converted_at, converted_tier, converted_amount, slug
    FROM audits
    WHERE status = ${status}
    ORDER BY submitted_at DESC
    LIMIT ${limit} OFFSET ${offset};
  `;
  return result.rows;
}

// === Stats for admin dashboard + daily summary ===
export async function getStats() {
  const result = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'drafted') AS pending_count,
      COUNT(*) FILTER (WHERE status = 'delivered' AND delivered_at >= NOW() - INTERVAL '1 day') AS delivered_today,
      COUNT(*) FILTER (WHERE status = 'delivered' AND delivered_at >= NOW() - INTERVAL '7 days') AS delivered_7d,
      COUNT(*) FILTER (WHERE converted_at >= NOW() - INTERVAL '14 days') AS conversions_14d,
      COUNT(*) FILTER (WHERE delivered_at >= NOW() - INTERVAL '14 days') AS delivered_14d_cohort,
      COALESCE(SUM(converted_amount) FILTER (WHERE converted_at >= NOW() - INTERVAL '14 days'), 0) AS revenue_14d
    FROM audits;
  `;
  return result.rows[0];
}

// === Pending older than threshold (queue reminders) ===
export async function listOldPending({ olderThanHours = 4 }) {
  const result = await sql`
    SELECT id, first_name, email, submitted_at,
           EXTRACT(EPOCH FROM (NOW() - submitted_at))/3600 AS hours_old
    FROM audits
    WHERE status = 'drafted'
      AND submitted_at < NOW() - (${olderThanHours} || ' hours')::INTERVAL
    ORDER BY submitted_at ASC;
  `;
  return result.rows;
}

// === Mark non-converted at day 14 ===
export async function markNoConvertCohort() {
  const result = await sql`
    UPDATE audits SET no_convert_at = NOW(), updated_at = NOW()
    WHERE status = 'delivered'
      AND delivered_at <= NOW() - INTERVAL '14 days'
      AND converted_at IS NULL
      AND no_convert_at IS NULL
    RETURNING id, email;
  `;
  return result.rows;
}

// === Stripe webhook: lookup audit by buyer email + mark converted ===
export async function markConvertedByEmail(email, { tier, amount, stripeSessionId }) {
  const result = await sql`
    UPDATE audits SET
      converted_at = COALESCE(converted_at, NOW()),
      converted_tier = ${tier},
      converted_amount = ${amount},
      stripe_session_id = ${stripeSessionId},
      updated_at = NOW()
    WHERE LOWER(email) = LOWER(${email})
      AND status = 'delivered'
      AND converted_at IS NULL
    RETURNING id, first_name, email, converted_tier, converted_amount, delivered_at;
  `;
  return result.rows[0] ?? null;
}

// === Recovery: find by email (lets athlete re-request their slug) ===
export async function findDeliveredByEmail(email) {
  const result = await sql`
    SELECT id, slug, first_name, delivered_at
    FROM audits
    WHERE LOWER(email) = LOWER(${email})
      AND status = 'delivered'
    ORDER BY delivered_at DESC
    LIMIT 1;
  `;
  return result.rows[0] ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
//   Sprint screenings (May 2026) — persists /sprint inline form submissions
//   so daily cron can fire S1 (cart-abandon) + S2 (fail) nurture emails.
//   Frontend wired at sprint.html line ~1192. Spec: SPEC_screen_capture_endpoint.md
// ═══════════════════════════════════════════════════════════════════════════

export async function insertScreening({
  email,
  name,
  distance,
  raceDate,
  hours,
  coach,
  result,
  failReason,
  referral,
  submittedAt,
}) {
  const row = await sql`
    INSERT INTO sprint_screenings (
      email, name, distance, race_date, hours, coach, result,
      fail_reason, referral, submitted_at
    ) VALUES (
      ${email.toLowerCase()}, ${name}, ${distance}, ${raceDate}, ${hours}, ${coach}, ${result},
      ${failReason || null}, ${referral || null}, ${submittedAt || new Date().toISOString()}
    )
    RETURNING id, email, result, submitted_at;
  `;
  return row.rows[0];
}

// S1 — race-window pass, idle ≥ 1h, < 7 days, no payment yet
export async function findPendingS1Pass() {
  const result = await sql`
    SELECT id, email, name, distance, race_date, hours, coach, submitted_at
    FROM sprint_screenings
    WHERE result = 'pass'
      AND s1_email_sent IS NULL
      AND stripe_paid_at IS NULL
      AND submitted_at < NOW() - INTERVAL '1 hour'
      AND submitted_at > NOW() - INTERVAL '7 days'
    ORDER BY submitted_at ASC
    LIMIT 100;
  `;
  return result.rows;
}

// S2 — screening fail, < 7 days old, not yet emailed
export async function findPendingS2Fail() {
  const result = await sql`
    SELECT id, email, name, distance, race_date, hours, fail_reason, submitted_at
    FROM sprint_screenings
    WHERE result = 'fail'
      AND s2_email_sent IS NULL
      AND submitted_at > NOW() - INTERVAL '7 days'
    ORDER BY submitted_at ASC
    LIMIT 100;
  `;
  return result.rows;
}

export async function markScreeningS1Sent(id) {
  await sql`UPDATE sprint_screenings SET s1_email_sent = NOW() WHERE id = ${id}`;
}

export async function markScreeningS2Sent(id) {
  await sql`UPDATE sprint_screenings SET s2_email_sent = NOW() WHERE id = ${id}`;
}

// Called by stripe-webhook when a Sprint customer pays — suppresses S1
export async function markScreeningPaidByEmail(email) {
  const result = await sql`
    UPDATE sprint_screenings
    SET stripe_paid_at = NOW()
    WHERE LOWER(email) = LOWER(${email})
      AND result = 'pass'
      AND stripe_paid_at IS NULL
    RETURNING id;
  `;
  return result.rows.length;
}

// Retention: 18 months from submitted_at (called daily from cron)
export async function purgeOldScreenings() {
  const result = await sql`
    DELETE FROM sprint_screenings
    WHERE submitted_at < NOW() - INTERVAL '18 months'
    RETURNING id;
  `;
  return result.rows.length;
}
