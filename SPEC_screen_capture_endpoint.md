# `/api/screen-capture.js` — Endpoint Specification

**Status:** ✅ **BUILT** — May 10, 2026. Authorized + committed via `ALLOW_BACKEND_TOUCH=1`. Files shipped:
- `api/screen-capture.js` (~110 lines) — POST endpoint with same-origin guard + server-side validation
- `lib/db.js` — `insertScreening`, `findPendingS1Pass`, `findPendingS2Fail`, `markScreeningS1Sent`, `markScreeningS2Sent`, `markScreeningPaidByEmail`, `purgeOldScreenings`
- `lib/email-renderer.js` (NEW) — generic HTML template loader with token substitution + per-deployment cache
- `api/cron/daily-sweep.js` — S1 + S2 trigger blocks + 18-month retention purge
- `api/stripe-webhook.js` — calls `markScreeningPaidByEmail` on `checkout.session.completed` (suppresses S1)
- `scripts/migrate.js` — `sprint_screenings` table + 4 indexes + 3 enum CHECKs
- `vercel.json` — registered `api/screen-capture.js` (10s timeout); bumped daily-sweep to 90s

**Migration to run on first deploy:**
```bash
bun scripts/migrate.js  # idempotent, safe to re-run
```

**Why this endpoint exists:** the `/sprint` screening form now captures name + email + screening result. This endpoint persists that data to Postgres so the daily cron can fire S1 (cart-abandonment) and S2 (screening-fail) emails — which require an email recipient.

---

## 1. Route + method

```
POST /api/screen-capture
Content-Type: application/json
```

CORS: same-origin only (called from `/sprint` page). Reject all other origins.

## 2. Request body

```ts
{
  name:         string,   // required, non-empty after trim
  email:        string,   // required, must match /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  distance:     "703" | "full",
  race_date:    string,   // ISO yyyy-mm-dd
  hours:        "low" | "mid" | "high",   // → 70.3 / Full Ironman / Pro tier
  coach:        "yes" | "no",
  result:       "pass" | "fail",          // server re-validates this; client claim is advisory
  fail_reason?: string,                   // populated when result === "fail"
  referral?:    string,                   // Rewardful referral slug if present
  submitted_at: string                    // ISO timestamp
}
```

## 3. Server-side validation (re-runs the screen logic)

Even though the frontend already validated, server MUST re-validate to prevent abuse:

```js
const today    = new Date(); today.setHours(0,0,0,0);
const minDate  = new Date(today.getTime() + 28 * 86400 * 1000);
const maxDate  = new Date(today.getTime() + 84 * 86400 * 1000);
const raceDate = new Date(body.race_date);

let result    = "pass";
let failReason;

if (raceDate < minDate)    { result = "fail"; failReason = `Race is ${Math.ceil((raceDate - today) / 86400000)} days from sign-up — under our 28-day floor`; }
else if (raceDate > maxDate){ result = "fail"; failReason = `Race is ${Math.ceil((raceDate - today) / 86400000)} days from sign-up — over our 56-day ceiling (window goes to 56d for new + 84d existing-customer race-back)`; }
else if (body.coach === "no") { result = "fail"; failReason = "Sprint requires an active coach or structured training plan"; }
// Note: medical-exclusion checkbox is required at the form level — we trust it; not server-validated
```

If client-provided `result` differs from server-computed, **trust the server** and override.

## 4. Database write — `lib/db.js`

Add a new table `sprint_screenings`:

```sql
CREATE TABLE IF NOT EXISTS sprint_screenings (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  name            TEXT NOT NULL,
  distance        TEXT NOT NULL,        -- '703' | 'full'
  race_date       DATE NOT NULL,
  hours           TEXT NOT NULL,        -- 'low' | 'mid' | 'high'
  coach           TEXT NOT NULL,        -- 'yes' | 'no'
  result          TEXT NOT NULL,        -- 'pass' | 'fail'
  fail_reason     TEXT,
  referral        TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Email-trigger state
  s1_email_sent   TIMESTAMPTZ,          -- when cart-abandonment email fired
  s2_email_sent   TIMESTAMPTZ,          -- when screening-fail email fired
  stripe_paid_at  TIMESTAMPTZ,          -- set by stripe-webhook on successful payment → suppresses S1
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sprint_screenings_email     ON sprint_screenings(email);
CREATE INDEX idx_sprint_screenings_result    ON sprint_screenings(result);
CREATE INDEX idx_sprint_screenings_s1_pending ON sprint_screenings(submitted_at)
  WHERE result = 'pass' AND s1_email_sent IS NULL AND stripe_paid_at IS NULL;
```

Migration script: `scripts/migrate.js` already handles schema runs — add the CREATE TABLE statement to it.

## 5. Email-trigger logic (in `api/cron/daily-sweep.js`)

Add two query blocks:

### S1 — Cart-abandonment (1 hour after pass, no payment)

```js
const s1Pending = await db.query(`
  SELECT * FROM sprint_screenings
  WHERE result = 'pass'
    AND s1_email_sent IS NULL
    AND stripe_paid_at IS NULL
    AND submitted_at < NOW() - INTERVAL '1 hour'
    AND submitted_at > NOW() - INTERVAL '7 days'  -- expire stale screenings
`);

for (const row of s1Pending.rows) {
  await sendEmail({
    template: 'sprint/01-screening-pass',
    to:       row.email,
    tokens: {
      first_name:              row.name.split(' ')[0],
      race_distance:           row.distance === 'full' ? 'Full Ironman' : 'Ironman 70.3',
      race_date:               formatDate(row.race_date),
      tier_name:               TIERS[row.hours].name,
      tier_price:              TIERS[row.hours].price,
      tier_price_discounted:   Math.round(TIERS[row.hours].priceNum * 0.85).toString(),
      stripe_link:             STRIPE_LINKS[row.hours],
      stripe_link_with_promo:  STRIPE_LINKS[row.hours] + '?prefilled_promo_code=WELCOME15&prefilled_email=' + encodeURIComponent(row.email),
      promo_code:              'WELCOME15',
      wa_link:                 'https://wa.me/16263609822?text=Hi%20RIK%20%E2%80%94%20',
      // unsubscribe injected by Resend
    }
  });
  await db.query('UPDATE sprint_screenings SET s1_email_sent = NOW() WHERE id = $1', [row.id]);
}
```

### S2 — Screening fail (immediately, but cron-fired so we don't block /api/screen-capture response)

```js
const s2Pending = await db.query(`
  SELECT * FROM sprint_screenings
  WHERE result = 'fail'
    AND s2_email_sent IS NULL
    AND submitted_at > NOW() - INTERVAL '7 days'
`);

for (const row of s2Pending.rows) {
  await sendEmail({
    template: 'sprint/02-screening-fail',
    to:       row.email,
    tokens: {
      first_name:    row.name.split(' ')[0],
      race_date:     formatDate(row.race_date),
      days_to_race:  Math.ceil((new Date(row.race_date) - new Date()) / 86400000),
      fail_reason:   row.fail_reason,
      wa_link:       'https://wa.me/16263609822?text=Hi%20RIK%20%E2%80%94%20',
    }
  });
  await db.query('UPDATE sprint_screenings SET s2_email_sent = NOW() WHERE id = $1', [row.id]);
}
```

### Stripe webhook — close the loop

`api/stripe-webhook.js` (already exists per HANDOFF.md §4.4) already handles `checkout.session.completed`. Add:

```js
if (event.type === 'checkout.session.completed') {
  const session = event.data.object;
  const customerEmail = session.customer_details?.email?.toLowerCase();
  if (customerEmail) {
    // Mark the screening as paid → suppresses S1 cart-abandonment email
    await db.query(`
      UPDATE sprint_screenings
      SET stripe_paid_at = NOW()
      WHERE LOWER(email) = $1 AND result = 'pass' AND stripe_paid_at IS NULL
    `, [customerEmail]);
  }
}
```

## 6. Response

```ts
// 200 OK
{ "ok": true, "id": 12345, "result": "pass" | "fail", "fail_reason"?: string }

// 400 Bad Request — validation failed (malformed email, missing fields, etc.)
{ "ok": false, "error": "<reason>" }

// 500 — db write failed
{ "ok": false, "error": "internal" }
```

The frontend uses `keepalive: true` and ignores the response (because the user is already redirecting to Stripe), but the response is logged for ops debugging.

## 7. Privacy + retention

- **Email + name** are PII → covered by privacy policy at `/privacy` (already lists "screening form data" as one of the categories collected)
- **Retention:** 18 months from `submitted_at`. Cron runs a quarterly purge. Add to `api/cron/daily-sweep.js`:
  ```js
  await db.query(`DELETE FROM sprint_screenings WHERE submitted_at < NOW() - INTERVAL '18 months'`);
  ```
- **GDPR/CCPA:** any athlete who emails Bek.Zhou@rikathletica.com can request their record be deleted; honored within 30 days.

## 8. Bek's authorization needed to build

Per `CLAUDE.md` "DO NOT modify without explicit founder authorization":
> Any file in /api/ — pre-commit hook at scripts/no-touch-check.sh enforces this.

To build:

```bash
ALLOW_BACKEND_TOUCH=1 git commit -m "feat(screen-capture): persist sprint screening + wire S1/S2 email triggers"
```

When You give the nod, I'll:
1. Create `/api/screen-capture.js` (~80 lines)
2. Update `/api/cron/daily-sweep.js` (~50 lines added — S1 + S2 trigger blocks + retention purge)
3. Update `/api/stripe-webhook.js` (~15 lines — mark `stripe_paid_at`)
4. Add migration to `scripts/migrate.js`
5. Smoke-test with a fake screening payload

Estimated time: 30–45 minutes including tests.
