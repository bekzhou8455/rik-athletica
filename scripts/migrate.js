// Postgres schema migration. Idempotent — safe to run multiple times.
// Usage: npm run migrate  (locally, with .env.local containing POSTGRES_URL)
//        Or run once after creating the Vercel Postgres database.

import { sql } from '@vercel/postgres';

const STATEMENTS = [
  // Main table
  `CREATE TABLE IF NOT EXISTS audits (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT NOT NULL,
    first_name    TEXT NOT NULL,
    answers       JSONB NOT NULL,
    engine        JSONB NOT NULL,
    drafts        JSONB,
    drafts_final  JSONB,
    status        TEXT NOT NULL DEFAULT 'drafted',
    slug          TEXT UNIQUE,
    pdf_url       TEXT,
    methodology_version TEXT,
    routing_version     TEXT,

    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at  TIMESTAMPTZ,
    converted_at  TIMESTAMPTZ,
    no_convert_at TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    converted_tier   TEXT,
    converted_amount NUMERIC(10,2),
    stripe_session_id TEXT,

    utm_source    TEXT,
    utm_medium    TEXT,
    utm_campaign  TEXT,
    club_ref      TEXT
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS audits_status_idx ON audits (status, submitted_at DESC)`,
  `CREATE INDEX IF NOT EXISTS audits_email_idx ON audits (LOWER(email))`,
  `CREATE INDEX IF NOT EXISTS audits_slug_idx ON audits (slug) WHERE slug IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS audits_delivered_idx ON audits (delivered_at) WHERE delivered_at IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS audits_converted_idx ON audits (converted_at) WHERE converted_at IS NOT NULL`,

  // Status enum check (soft — allows future statuses without migration)
  `ALTER TABLE audits DROP CONSTRAINT IF EXISTS audits_status_check`,
  `ALTER TABLE audits ADD CONSTRAINT audits_status_check
    CHECK (status IN ('drafted', 'delivered', 'engine_error', 'archived'))`,

  // ─── Sprint screening capture (May 2026 — wires S1/S2 nurture emails) ───
  // Persists name + email + screening result from /sprint inline form so the
  // daily cron can fire S1 (cart-abandonment recovery) and S2 (screening-fail).
  // Frontend (sprint.html L1192) POSTs here via keepalive fetch.
  `CREATE TABLE IF NOT EXISTS sprint_screenings (
    id              BIGSERIAL PRIMARY KEY,
    email           TEXT NOT NULL,
    name            TEXT NOT NULL,
    distance        TEXT NOT NULL,
    race_date       DATE NOT NULL,
    hours           TEXT NOT NULL,
    coach           TEXT NOT NULL,
    result          TEXT NOT NULL,
    fail_reason     TEXT,
    referral        TEXT,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    s1_email_sent   TIMESTAMPTZ,
    s2_email_sent   TIMESTAMPTZ,
    stripe_paid_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // Indexes for cron-trigger queries (see api/cron/daily-sweep.js)
  `CREATE INDEX IF NOT EXISTS sprint_screenings_email_idx     ON sprint_screenings (LOWER(email))`,
  `CREATE INDEX IF NOT EXISTS sprint_screenings_submitted_idx ON sprint_screenings (submitted_at DESC)`,
  `CREATE INDEX IF NOT EXISTS sprint_screenings_s1_pending_idx ON sprint_screenings (submitted_at)
    WHERE result = 'pass' AND s1_email_sent IS NULL AND stripe_paid_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS sprint_screenings_s2_pending_idx ON sprint_screenings (submitted_at)
    WHERE result = 'fail' AND s2_email_sent IS NULL`,

  `ALTER TABLE sprint_screenings DROP CONSTRAINT IF EXISTS sprint_screenings_distance_check`,
  `ALTER TABLE sprint_screenings ADD CONSTRAINT sprint_screenings_distance_check
    CHECK (distance IN ('703', 'full'))`,
  `ALTER TABLE sprint_screenings DROP CONSTRAINT IF EXISTS sprint_screenings_hours_check`,
  `ALTER TABLE sprint_screenings ADD CONSTRAINT sprint_screenings_hours_check
    CHECK (hours IN ('low', 'mid', 'high'))`,
  `ALTER TABLE sprint_screenings DROP CONSTRAINT IF EXISTS sprint_screenings_result_check`,
  `ALTER TABLE sprint_screenings ADD CONSTRAINT sprint_screenings_result_check
    CHECK (result IN ('pass', 'fail'))`,

  // ─── Referral tracking (May 2026 — wires ?ref= param to audits table) ───
  `ALTER TABLE audits ADD COLUMN IF NOT EXISTS referred_by_slug TEXT`,
  `CREATE INDEX IF NOT EXISTS audits_referred_by_idx ON audits (referred_by_slug) WHERE referred_by_slug IS NOT NULL`,
];

async function run() {
  console.log('Running migrations...');
  for (const stmt of STATEMENTS) {
    const preview = stmt.split('\n')[0].slice(0, 60);
    console.log(`  → ${preview}...`);
    await sql.query(stmt);
  }
  console.log('Done.');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
