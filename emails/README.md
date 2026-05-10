# RIK Athletica — Email Sequences

**Total: 12 templates across Premium / Sprint / Bundle.** Each template is iter-5 voice, brand-aligned HTML + plain-text fallback. Sender: `Bek.Zhou@rikathletica.com`.

Files in this directory map 1:1 to triggers in the customer lifecycle. Each `.html` template uses `{{token}}` placeholders for variable substitution at send time. Plain-text variant lives alongside as `.txt`.

---

## Email inventory

### Premium (5 emails)

| # | File | Subject | Trigger | Bek input required? |
|---|---|---|---|---|
| P1 | `premium/01-confirmation.html` | "You're in. The Founding Cohort closes in {{days_until_close}} days." | Stripe webhook `checkout.session.completed` with line-item match for Premium | ❌ Auto-fires |
| P2 | `premium/02-intake-prompt.html` | "12 minutes — let's build Your protocol." | Day +1 if no Typeform intake submission yet (`/api/cron/daily-sweep.js`) | ❌ Auto-fires |
| P3 | `premium/03-weekly-checkin.html` | "How did the {{session_label}} land?" | **On the day of each key session** — identified at protocol generation from athlete's training plan; cron checks daily | ❌ Auto-fires |
| P4 | `premium/04-rik-direct-go-live.html` | "RIK Direct goes live for You today." | Day −7 from athlete's race date | ❌ Auto-fires (the **WhatsApp number reveal** email — note: number embedded as CTA button, NOT plain text) |
| P5 | `premium/05-post-race-debrief.html` | "Tell us how race day went — 5 minutes." | **Day +2** from athlete's race date (decompression buffer) — Typeform-embedded debrief, async only, no call. | ❌ Auto-fires |

### Sprint (5 emails)

| # | File | Subject | Trigger | Bek input required? |
|---|---|---|---|---|
| S1 | `sprint/01-screening-pass.html` | "You're In. One Step From Start." | **1 hour after** screening pass via `/api/screen-capture`, if no Stripe payment yet (cart-abandonment recovery with WELCOME15) | ❌ Auto-fires |
| S2 | `sprint/02-screening-fail.html` | "Your race date is outside our 28–56 day window." | **Immediately** after `/api/screen-capture` records `result: 'fail'` — email captured at screening form | ❌ Auto-fires |
| S3 | `sprint/03-intake-prompt.html` | "10 minutes — let's build Your protocol." | Stripe payment confirms + Day +1 if no intake | ❌ Auto-fires |
| S4 | `sprint/04-weekly-checkin.html` | "How did the {{session_label}} land?" | **On the day of each key session** — same per-key-session model as P3 | ❌ Auto-fires |
| S5 | `sprint/05-shipment-notification.html` | "{{shipment_label}} is on its way — tracking inside." | When Bek prints carrier label & uploads tracking number to internal dashboard | ✅ **Bek triggers manually** (see §3 below) |

### Bundle (2 emails)

| # | File | Subject | Trigger | Bek input required? |
|---|---|---|---|---|
| B1 | `bundle/01-confirmation.html` | "Your RIK Bundle is on its way." | Stripe webhook `checkout.session.completed` with Bundle line-item | ❌ Auto-fires |
| B2 | `bundle/02-shipment-notification.html` | "Your Bundle shipped — tracking inside." | When Bek prints carrier label | ✅ **Bek triggers manually** |

---

## Triggers — the three categories

### 1. Pure auto-fire (8 of 12 emails)

Fire from `api/stripe-webhook.js` (P1, B1) or `api/cron/daily-sweep.js` (everything else timed). Templates render server-side via Resend with token substitution. **No Bek action required.**

### 2. Manual-trigger (2 emails — S5, B2 — "shipping confirmation")

These can't auto-fire because the **tracking number doesn't exist** at the moment of payment — it only exists after Bek (or the 3PL ShipWizard) prints a carrier label. Three options for sending these:

#### Option A — Resend dashboard manual send (simplest, recommended for first 30 days)

1. Bek's fulfillment workflow: prints label → ShipWizard exports tracking number → Bek copies the customer's email + tracking number from a Google Sheet
2. Bek opens Resend dashboard → "Templates" → picks `S5-shipment-notification` or `B2-shipment-notification`
3. Pastes recipient email + tracking number into the variable substitution panel
4. Clicks **Send**

Works for 1-50 shipments/week. No code changes. Bek personally touches every shipping email — good for early customer relationships, allows last-second personalization.

#### Option B — Internal admin panel "Send shipment email" button (for 50-200 shipments/week)

Add `/admin/shipping.html` page (already have `admin/audit-queue.html` pattern):
- Lists Stripe customers awaiting tracking numbers
- Bek pastes tracking → clicks "Send notification"
- Backend calls Resend API with template + variables

Phase 5+. Defer.

#### Option C — ShipWizard webhook → auto-send (for 200+ shipments/week)

ShipWizard fires a webhook when a label is printed. New `/api/shipping-webhook.js` endpoint receives it, looks up the customer's email by order ID, fires the Resend email automatically.

Phase 6+. Defer.

**Decision: ship Option A for launch.** Bek manually sends until volume justifies Option B.

### 3. Conditional auto-fire — race-date-driven AND key-session-driven (4 emails)

| Email | Trigger logic | Data source |
|---|---|---|
| P4 RIK Direct go-live | Day −7 from athlete's race date | `intake.race_date` |
| P5 Post-race debrief | **Day +2** from athlete's race date (was +14 — moved forward to capture decompression-window signal while details are still sharp) | `intake.race_date` |
| **P3 Premium key-session check-in** | **On the day of each key session** identified in the athlete's training plan | `protocol.key_sessions[]` array — set at protocol generation time, see "Per-key-session check-in trigger" below |
| **S4 Sprint key-session check-in** | Same as P3 | Same |

**Per-key-session check-in trigger (replaces weekly Monday model):**

When the protocol is generated for a Sprint or Premium athlete, the system identifies which sessions in their training plan are *key* (long bike, brick, interval run, race-pace tempo, open-water swim) — these are flagged in `protocol.key_sessions` as `[{ date: "2026-05-15", session_type: "long_bike", session_label: "long bike" }, ...]`. The cron runs daily at 18:00 ICT (athlete's local-or-detected time zone) and queries:

```sql
SELECT a.* FROM athletes a
JOIN protocol_key_sessions k ON k.athlete_id = a.id
WHERE k.session_date = CURRENT_DATE AND k.checkin_email_sent IS NULL;
```

For each match, fires P3 (Premium) or S4 (Sprint) with `{{session_label}}` and `{{session_date_short}}` populated.

**Why per-key-session over weekly Monday:**
1. Email lands when the data is freshest (athlete still mentally processing the session)
2. Aligns the prompt with Bek's three-pillar adherence design (follow protocol / submit feedback / submit training plan)
3. Higher response rate — Mondays compete with the work-week tide; key-session-day check-ins land in the athlete's training context

**Race date + key-session dependency:** both trigger types need data from `/api/intake.js` (Typeform full intake webhook) writing to `lib/db.js`. **Premium customers MUST complete intake within 7 days of payment** for the RIK Direct email to fire on time. P2 (intake-prompt) reinforces this.

---

## Token glossary (variables substituted at send time)

| Token | Source | Used in |
|---|---|---|
| `{{first_name}}` | Stripe customer name (split on first space) OR Typeform intake first-name field | All emails |
| `{{full_name}}` | Stripe customer name | Most emails |
| `{{email}}` | Stripe customer email | All emails |
| `{{tier}}` | Stripe line-item match (premium/sprint-703/sprint-full/sprint-pro/bundle) | Routing logic only — never displayed |
| `{{race_date}}` | Typeform intake field | Premium P2/P4/P5, Sprint S3/S4 |
| `{{race_distance}}` | Typeform screening field | Sprint, Premium |
| `{{days_until_race}}` | Computed (race_date − today) | Premium P4, Sprint S4 |
| `{{days_until_close}}` | Computed (`2026-05-18 23:59 ET` − today) | Premium P1 |
| `{{week_n}}` | Computed (1, 2, 3, or 4 based on intake date) | P3, S4 |
| `{{whatsapp_number}}` | Hardcoded `+1 (626) 360-9822` (only revealed in P4) | Premium P4 ONLY |
| `{{wa_link}}` | Hardcoded `https://wa.me/16263609822?text=Hi%20RIK%20%E2%80%94%20` | All emails footer |
| `{{intake_link}}` | Typeform full intake URL with prefilled tier param: `https://form.typeform.com/to/XT5Qo0HD?tier={{tier}}` | P1, P2, S1, S3 |
| `{{checkin_link}}` | `https://www.rikathletica.com/checkin?session={{stripe_session_id}}` | P3, S4 |
| `{{tracking_number}}` | ShipWizard / Bek's manual entry | S5, B2 |
| `{{tracking_url}}` | Carrier-specific URL (UPS/USPS/FedEx) | S5, B2 |
| `{{shipment_label}}` | "Shipment 1 (Training Box)" / "Shipment 2 (Replenish)" / "Race Pack" | S5 |
| `{{stripe_session_id}}` | Stripe checkout session ID | All confirmations (for support reference) |
| `{{order_total}}` | Stripe payment amount | All confirmations |

---

## Sending infrastructure (Resend)

The codebase already has `api/mailer.js` (shared SMTP transport — Gmail) and `api/email-templates.js` (existing template strings). For new sequences, **use Resend instead of Gmail SMTP** because:

- Resend's templating system is variable-aware (no string concatenation in JS)
- Better deliverability for transactional + marketing volumes
- Built-in click + open tracking
- Webhook delivery confirms

**Migration path:** keep `api/mailer.js` for the existing audit-delivery + admin alerts (working in production). New sequences go through Resend via a new `api/resend-mailer.js` helper.

Resend env var: `RESEND_API_KEY` (set in Vercel env). Resend domain: `mail.rikathletica.com` or subdomain TBD — DNS records (DKIM, SPF, MX) need to be added before launch. **Bek action: configure Resend domain in Vercel env + add DNS records before Phase 6 deploy.**

---

## Voice + design conventions for these emails

All emails follow `DESIGN.md` §11 (voice) + match iter-5 visual language:

- **Outfit only** typography (web-safe fallback to system sans)
- **Sand bg** `#EEEDEA` for body, **ink** `#0E0E0E` for text, **ink-soft** `#5A5853` for secondary
- **Capital "You / Your"**
- **Period-stacked headlines** ("You're in. *The Cohort is closing.*")
- **Em-dash voice** (`—` not `--`)
- **No banned AI vocab** (delve, leverage, holistic, journey, seamless, robust, etc.)
- **FDA structural-functional verbs** (`supports`, `designed to`, `may help`)
- **`†` on first nutrition claim**, single FDA disclaimer block in footer
- **Single CTA per email** — never split-attention
- **Mobile-first** — 600px max width, single-column, large tap targets

Plain-text variants strip HTML, retain semantic structure (Markdown-ish), include all links inline.

---

## Compliance gates per email

Every email passes through:
- [ ] `scripts/compliance-grep.sh` (FDA/FTC banned words)
- [ ] No Emily Norman by name UNLESS the email is to a Premium/Sprint/Bundle customer (per §1.2 — these are permitted locations). Generic "RD-reviewed methodology" trust line is allowed everywhere.
- [ ] FTC paid-review disclosure adjacent to any Emily citation
- [ ] FDA `†` disclaimer in footer of any email mentioning supplement claims
- [ ] No race-time guarantees, no medical advice claims, no disease prevention/cure language

---

## File index

```
emails/
├── README.md                              ← this file
├── _shared/
│   └── footer.html                        ← shared FDA disclaimer + signature block
├── premium/
│   ├── 01-confirmation.html
│   ├── 02-intake-prompt.html
│   ├── 03-weekly-checkin.html
│   ├── 04-rik-direct-go-live.html         ← THE WhatsApp number reveal
│   └── 05-post-race-debrief.html
├── sprint/
│   ├── 01-screening-pass.html
│   ├── 02-screening-fail.html
│   ├── 03-intake-prompt.html
│   ├── 04-weekly-checkin.html
│   └── 05-shipment-notification.html      ← Bek-triggered
└── bundle/
    ├── 01-confirmation.html
    └── 02-shipment-notification.html      ← Bek-triggered
```

Each `.html` is a complete email. Plain-text variants (`.txt`) are auto-generated from the HTML at send time via Resend's `text` field substitution.
