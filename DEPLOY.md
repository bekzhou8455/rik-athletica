# RIK Audit — Deploy Runbook

First-time deploy checklist for the Audit backend. Follow top-to-bottom.

---

## Prereqs

- Vercel project already deployed (`rik-athletica-v2` or current site)
- Domain configured (`rikathletica.com`)
- A Gmail account you own (e.g. `bek.zhou@rikathletica.com`)
- A Stripe account in live mode (already in use)
- A Kit (ConvertKit) account with your existing E0 / A16 sequences

---

## Step 1 — Vercel Postgres + Blob (5 min)

Both are 1-click on Vercel.

1. Vercel dashboard → your project → **Storage** tab
2. **Create Database** → Postgres → name it `rik-audits` → region nearest you (e.g. `iad1`)
   - This auto-injects `POSTGRES_URL` + `POSTGRES_URL_NON_POOLING` into all environments.
3. Storage tab → **Create Store** → Blob → name it `rik-pdfs`
   - Auto-injects `BLOB_READ_WRITE_TOKEN`.

Then run the migration once:

```bash
cd /Users/bekzhou/Downloads/RIK_Site_Revamp/site
npm install
vercel env pull .env.local      # pulls POSTGRES_URL etc into .env.local
npm run migrate                  # creates the audits table + indexes
```

Verify: `psql $POSTGRES_URL -c "\dt audits"` should show the table.

---

## Step 2 — Anthropic API key (3 min)

1. https://console.anthropic.com → Settings → API Keys → **Create Key**
2. Copy the `sk-ant-...` value
3. Vercel → Project Settings → Environment Variables → add:
   - `ANTHROPIC_API_KEY` = `sk-ant-...` (Production + Preview)

Cost: budget $5/month cap on the key just to be safe — your actual usage is ~$0.005 per audit (~$0.75/mo at 5/day).

---

## Step 3 — Gmail SMTP for transactional + alerts (5 min)

You need a Google App Password (not your real password).

1. Google Account → Security → 2-Step Verification (must be on)
2. Same page → App passwords → Mail → Generate
3. Copy the 16-char password
4. Vercel env vars:
   - `GMAIL_USER` = `bek.zhou@rikathletica.com`
   - `GMAIL_APP_PASSWORD` = the 16-char value
   - `BEK_NOTIFY_EMAIL` = where to send alerts (your phone-pushed inbox)

---

## Step 4 — Kit tags (10 min)

In Kit dashboard, create these tags (each is one tag, blank is fine):

- `audit-submitted` — fires E0 confirmation in Kit (you can also rely on our own E0 from Gmail)
- `audit-delivered` — triggers your A16 nurture
- `audit-tier-bundle`, `audit-tier-bundle-pdf`, `audit-tier-sprint`, `audit-tier-premium` — routes A16 branch
- `audit-no-convert` — tags 14-day non-converters
- `audit-converted` — tags any conversion
- `audit-converted-bundle`, `audit-converted-sprint`, `audit-converted-premium` — tier-specific conversion

For each tag: click into it → the URL has `/tags/<NUMERIC_ID>/edit`. Copy that ID.

Vercel env vars:
- `KIT_API_KEY`, `KIT_API_SECRET` — Kit dashboard → Settings → Advanced → API
- `KIT_TAG_AUDIT_SUBMITTED`, `KIT_TAG_AUDIT_DELIVERED`, `KIT_TAG_AUDIT_NO_CONVERT`, `KIT_TAG_AUDIT_CONVERTED`
- `KIT_TAG_TIER_BUNDLE`, `KIT_TAG_TIER_BUNDLE_PDF`, `KIT_TAG_TIER_SPRINT`, `KIT_TAG_TIER_PREMIUM`
- `KIT_TAG_CONVERTED_BUNDLE`, `KIT_TAG_CONVERTED_SPRINT`, `KIT_TAG_CONVERTED_PREMIUM`

Wire automation in Kit:
- `audit-submitted` tag → start E0 sequence (if Kit-side; otherwise our Gmail E0 fires automatically)
- `audit-delivered` tag → start A16 nurture
- `audit-converted` tag → end A16, start onboarding sequence

---

## Step 5 — Stripe webhook (5 min)

1. Stripe dashboard → Developers → Webhooks → **Add endpoint**
2. URL: `https://rikathletica.com/api/stripe-webhook`
3. Events: `checkout.session.completed` (only this one is needed)
4. Copy the **Signing secret** (`whsec_...`)
5. Vercel env vars:
   - `STRIPE_SECRET_KEY` = your live secret key (`sk_live_...` — use a Restricted Key for safety)
   - `STRIPE_WEBHOOK_SECRET` = `whsec_...`

Test from Stripe dashboard → "Send test event" → `checkout.session.completed`. You should see a `🟢` in your alerts inbox within seconds.

---

## Step 6 — Admin token + cron secret (1 min)

```bash
openssl rand -hex 24    # generate ADMIN_TOKEN
openssl rand -hex 24    # generate CRON_SECRET
```

Vercel env vars:
- `ADMIN_TOKEN` = first generated value
- `CRON_SECRET` = second generated value
- `SITE_ORIGIN` = `https://rikathletica.com`

Bookmark on your phone + laptop:
```
https://rikathletica.com/admin/audit-queue.html?t=YOUR_ADMIN_TOKEN
```

The token is also stored in sessionStorage after first load, so you can rotate it later.

---

## Step 7 — Deploy

```bash
cd /Users/bekzhou/Downloads/RIK_Site_Revamp/site
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
vercel --prod --yes
```

Wait for `readyState: READY`. Then:

```bash
# Sanity check the public form
curl -s https://rikathletica.com/audit | grep -c "2 business days"   # should be ≥ 5

# Sanity check the API
curl -s -X POST https://rikathletica.com/api/audit/submit \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"Test","email":"test@example.com","consent":true}'
# Expect: 400 invalid payload (zod will catch missing fields)
```

---

## Step 8 — End-to-end smoke test (10 min)

1. Open `https://rikathletica.com/audit` in incognito
2. Fill it out with a test address (use a `+test` alias on your real Gmail)
3. Submit → you should:
   - See the success screen (`Step 10`)
   - Get an E0 confirmation in your test inbox within 30 sec
   - Get a 🟢 admin alert in `BEK_NOTIFY_EMAIL` within 30 sec
4. Open the admin queue → click into the row → verify AI drafts populated
5. Click **Approve & Send** → confirm
6. Verify:
   - Test inbox gets the delivery email with `/a/[slug]` link + PDF link
   - The page renders at `https://rikathletica.com/a/[slug]`
   - The PDF downloads from the Vercel Blob URL
   - You get a ✉️ "Sent" alert

7. (Optional) Buy something on Stripe with the same test email → verify 💰 conversion alert + Kit `audit-converted` tag.

---

## Daily ops (post-launch)

**Morning routine:**

1. Check phone for 🟢 new-audit alerts overnight
2. Open admin queue bookmark
3. For each pending row:
   - Read athlete inputs (left column)
   - Edit AI drafts inline if needed
   - Click **Approve & Send**
4. Done. Slack-style alerts continue throughout the day for ✉️ deliveries and 💰 conversions.

**Weekly maintenance:**

- Friday: review the Conversions tab, note any pattern (which tier converts, days-to-convert avg)
- If queue ever exceeds 7 pending: triage the oldest 5, reply manually to the rest with "give me 24h"

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Submit returns 500 | Missing env var | Check Vercel logs; usually `KIT_API_SECRET` or `ANTHROPIC_API_KEY` |
| AI drafts empty | Anthropic API down or rate-limited | Fallback drafts kick in; you write blocks manually for that one |
| 🔴 error alerts repeating | Persistent failure (DB, Kit, etc.) | Check Vercel function logs; the `where` field tells you which lib |
| PDF generation timeout | Cold start + Chromium load | First request after deploy can take ~10s; subsequent are fast |
| Page returns 404 | Slug typo, expired (>90d), or status not 'delivered' | Look up by email in admin |
| Stripe webhook 400 | Wrong webhook secret | Re-copy from Stripe dashboard, redeploy |

---

## Files map

```
site/
  audit.html                       — public form (existing, copy + endpoint updated)
  admin/audit-queue.html           — admin queue UI (rewritten)
  api/
    audit/
      submit.js                    — public submit endpoint
      approve.js                   — admin approve & send
      render.js                    — public /a/[slug] renderer
    admin/
      queue.js                     — list audits for queue UI
      draft.js                     — get/save draft edits
    stripe-webhook.js              — conversion auto-tagger
    cron/daily-sweep.js            — 14d sweep + queue reminder + daily summary
  lib/
    methodology.js                 — v3.1 constants (locked, RD-reviewed)
    routing.js                     — deterministic engine
    ai-drafter.js                  — Claude Haiku for personalization blocks
    db.js                          — Postgres queries
    kit.js                         — Kit API client
    email-alerts.js                — Gmail SMTP transport + alert templates
    pdf.js                         — puppeteer-core + Blob upload
    render.js                      — shared HTML renderer (page + PDF source)
  scripts/migrate.js               — Postgres schema migration
  tests/routing.test.js            — engine + routing unit tests
  vercel.json                      — cron + function timeouts + /a/[slug] rewrite
  .env.example                     — env var documentation
```

---

## Cost summary

| Service | Plan | New monthly cost |
|---|---|---|
| Vercel | Hobby (existing) | $0 |
| Vercel Postgres | Free tier (256MB) | $0 |
| Vercel Blob | Free tier (1GB) | $0 |
| Anthropic API | Pay-per-use | ~$0.75 |
| Kit | Existing plan | $0 |
| Stripe | Existing | $0 (just webhook) |
| Gmail SMTP | Free | $0 |
| **Total new** | | **~$0.75/mo** |

Free tier headroom:
- Postgres: ~50,000 audit rows fit in 256MB
- Blob: ~5,000 PDFs at ~200KB each
- Vercel functions: 100GB-hours/mo — way more than needed
