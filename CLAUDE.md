# RIK Athletica — Project Instructions for Claude (Revamp May 2026)

## What this project is

**Unified static marketing + audit-backend site** for RIK Athletica, an endurance sports nutrition brand.
Marketing pages: plain HTML/CSS/JS served by Bun locally / Vercel in prod.
Audit backend: Vercel serverless functions in `api/`, shared modules in `lib/`.
No framework, no build step, no bundler.

This codebase is the **Website Revamp May 2026** — a unified replacement for two prior codebases:
- The previous live `rikathletica.com` codebase (marketing-only)
- The `rik-audit.vercel.app` codebase (audit backend MVP)

When verified, this codebase becomes the source of truth for `www.rikathletica.com`.

## Three reviews completed (read PLAN.md for full context)

- ✅ Eng review (architecture + tests) — CLEAR
- ✅ CEO review (scope + strategy) — CLEAR
- ✅ Design review (UI/UX) — CLEAR (9/10)

The locked plan is at `PLAN.md` in repo root. Read it before any non-trivial change.

## Project structure

```
.
├── PLAN.md                    # The locked execution plan (read this first)
├── DESIGN.md                  # Design system tokens + rules
├── CLAUDE.md                  # This file
├── README.md                  # Setup + route map
├── TODOS.md                   # Roadmap + deferred items
├── CHANGELOG.md               # Version history
├── DEPLOY.md                  # Deploy runbook
├── VERSION                    # 2.0.0
│
├── index.html                 # Homepage
├── bundle.html                # Bundle product page (paid-ad NOT destination per CEO C-D9)
├── sprint.html                # Sprint 4-week service page
├── premium.html               # Premium 1:1 service page
├── calculator.html            # Calculator (PAID-AD DESTINATION per C-D9)
├── audit.html                 # Free Audit Level 0 entry form
├── checkin.html               # Sprint customer check-in (existing)
├── thank-you.html             # Post-purchase confirmation
├── 404.html                   # Branded 404
├── terms.html / privacy.html  # Legal
├── ref-redirect.html          # Rewardful affiliate redirect
│
├── assets/                    # Static assets (rik.css, RDN headshot/signature, RD statement PDF)
│   ├── rik.css                # Shared design system stylesheet (locked tokens)
│   ├── emily-norman-rdn.jpg   # Emily RDN headshot (≤320px wide per §1.6c)
│   ├── emily-signature.png    # Emily signature image
│   ├── rd-review-statement.pdf  # Full RD review statement (linkable adjacent per §1.6f)
│   ├── rik-analytics.js       # Phase 1.6 GA4 + Kit instrumentation helpers
│   ├── media/                 # Existing image assets
│   ├── signature/             # Bek's signature (used in audit deliverable email)
│   └── ...
│
├── api/                       # Vercel serverless functions
│   ├── audit/                 # Audit backend (DO NOT TOUCH per Eng D5)
│   │   ├── submit.js          # Public form endpoint
│   │   ├── approve.js         # Admin approve & send
│   │   └── render.js          # /a/[slug] page renderer
│   ├── admin/                 # Admin queue (DO NOT TOUCH)
│   │   ├── queue.js
│   │   └── draft.js
│   ├── cron/
│   │   └── daily-sweep.js     # 09:00 UTC daily
│   ├── stripe-webhook.js      # Conversion auto-tagger
│   ├── calc.js                # Server-side calculator (live's commit ccd25ac)
│   ├── leads.js               # Email capture (live)
│   ├── checkin.js             # Sprint check-in webhook
│   ├── intake.js              # Typeform intake webhook
│   ├── screen.js              # Typeform screening webhook
│   ├── create-sign-request.js # Dropbox Sign for Sprint contracts
│   ├── mailer.js              # Shared SMTP transport
│   ├── email-templates.js     # Email body templates
│   └── onboarding-templates.js
│
├── lib/                       # Backend modules (DO NOT TOUCH per Eng D5 + §6.1)
│   ├── methodology.js         # v3.1 LOCKED constants (mods → §6.1 re-review)
│   ├── routing.js             # Deterministic tier engine
│   ├── ai-drafter.js          # Claude Haiku prompt (audit drafts)
│   ├── db.js                  # Postgres queries
│   ├── kit.js                 # Kit API client
│   ├── email-alerts.js        # Gmail SMTP audit-delivery + admin alerts
│   ├── pdf.js                 # Unused (PDF disabled), kept for future revival
│   └── render.js              # Shared HTML renderer for /a/[slug]
│
├── admin/
│   └── audit-queue.html       # Admin SPA (DO NOT TOUCH)
│
├── middleware.js              # AI-bot blocking + IP protection (live commit ccd25ac)
│
├── scripts/                   # Utility scripts
│   ├── compress-images.py     # Existing (asset compression)
│   ├── migrate.js             # Postgres schema runner
│   ├── compliance-grep.sh     # Phase 1: prohibited-word scanner (Eng deliverable)
│   ├── form-action-baseline.sh  # Phase 1: form-action diff guard
│   ├── stripe-link-hot-test.sh  # Phase 1: Stripe URL HEAD test
│   ├── no-touch-check.sh      # Phase 1: pre-commit guard for lib/ + api/
│   └── rik-analytics-events.md  # Phase 1.6 GA4 event taxonomy
│
├── tests/
│   └── routing.test.js        # 10 passing tests
│
├── serve.ts                   # Bun static file server (port 3456)
├── calculator.test.ts         # Calculator unit tests
├── vercel.json                # Routes + headers + functions + cron
├── package.json               # Dependencies (audit + marketing)
├── .env.example               # All required env vars (commented)
├── .vercelignore              # Exclude lab/, design system/, etc. from deploy
├── robots.txt
├── sitemap.xml
└── .well-known/
    └── ai.txt                 # AI/bot policy
```

## Running

```bash
bun serve.ts                # Start dev server on http://localhost:3456 (static only; api/ routes need vercel dev)
bun test tests/             # Run audit routing tests (10 passing)
bun test calculator.test.ts # Run calculator tests (4 passing)
vercel dev                  # Full local dev with serverless routes
```

## Canonical source + deployment — READ BEFORE TOUCHING /sprint, /, /audit

### Canonical source path (the ONLY folder to deploy from)

```
/Users/bekzhou/Documents/Claude Code - Gstack/.claude/worktrees/confident-jones-80753d/
```

**Other folders on this machine are stale and MUST NOT be used:**
- `~/Downloads/RIK_Site_Revamp/site/` — outdated by months (May 2026 snapshot). Deploying from this folder will overwrite the design system. Confirmed broken on 2026-05-26 when a session built screening-form features against it and shipped a legacy-design site to production. **Do not use this folder.**
- Other sibling worktrees under `.claude/worktrees/` — feature branches, not production source.

Before editing any HTML, confirm you are in the canonical worktree by checking the path matches above.

### Live site = Vercel project `rik-athletica-v2`

- **Vercel project name:** `rik-athletica-v2`
- **Vercel team scope:** `rik-athletica` (use `--scope rik-athletica` on every CLI call)
- **Production domain:** `www.rikathletica.com`
- **Project ID:** `prj_ytGbmxLdnHeBiBF3N2UhLyRd7Dku`
- **Org ID:** `team_Jx9cKDWDIaUvE59BeofkHBb6`
- `.vercel/project.json` in this worktree is correctly linked. Do not edit it.

There is also a separate Vercel project called `rik-audit` — that is NOT the production site. Never deploy this site to `rik-audit`. If `vercel link` runs and asks which project, always pick `rik-athletica-v2`.

### Deployment method (the path that actually works)

Direct `vercel --prod` from a sandboxed Bash hangs mid-upload at ~20 MB into a ~40 MB upload (Vercel API socket disconnects). Confirmed 3+ failures on 2026-05-24 and 2026-05-26. Don't use that path. Use the branch-Preview → promote → alias pattern instead:

```bash
# Step 1 — push branch to origin
git push origin HEAD                                                # Vercel auto-builds Preview from the push

# Step 2 — wait ~30–60s, then find the new Preview
bunx --bun vercel list --scope rik-athletica                        # latest row should be Preview · Ready · <branch-slug>

# Step 3 — promote the Preview to Production target
bunx --bun vercel promote <preview-url> --scope rik-athletica --yes # creates a new Production-target deployment

# Step 4 — CRITICAL: update the www.rikathletica.com alias to point at the new deployment
bunx --bun vercel alias set <preview-or-deployment-url> www.rikathletica.com --scope rik-athletica
# Without this, www.rikathletica.com keeps serving the OLD content even though vercel list shows new Production-target deployments.

# Step 5 — verify with cache-bust
curl -sL "https://www.rikathletica.com/?cb=$(date +%s)" | grep '<title>'
```

To audit what the domain currently points to:

```bash
bunx --bun vercel alias ls --scope rik-athletica | grep rikathletica
# The deployment URL on the left of the row is what's actually live, regardless of the alias age column.
```

### Sandbox node note

`~/.local/bin/node` is a broken symlink to a deleted `/tmp/node-v22.15.0-darwin-arm64/`. `node` will not run directly from the Bash tool. `bunx --bun vercel` works because bun's runtime polyfills enough of node to host the Vercel CLI. Don't waste time trying to invoke `vercel` without the `bunx --bun` prefix.

### Pre-flight before any deploy

```bash
# 1. Confirm you're in the canonical worktree
pwd  # must show /Users/bekzhou/Documents/Claude Code - Gstack/.claude/worktrees/confident-jones-80753d

# 2. Confirm the local sprint.html matches expected size for our latest design
wc -c sprint.html  # ≥140 KB indicates the latest design + screening form is present

# 3. Confirm .vercel/project.json points at rik-athletica-v2
cat .vercel/project.json | grep projectName  # must show "rik-athletica-v2"
```

If any pre-flight fails, STOP and investigate. Do not deploy from a stale folder. Do not deploy to `rik-audit`.

### GitHub auto-deploy

CLAUDE.md previously said "Vercel webhook auto-deploy is unreliable on this project." That's only partially true — branch pushes DO trigger auto-Preview builds reliably, which is what the deploy pattern above depends on. What is unreliable is `main`-push → auto-Production-deploy; sometimes the alias doesn't update. Always run the manual `vercel alias set` step.

## Key conventions (UPDATED for revamp)

### Shared CSS (NEW — supersedes old "no external CSS" rule)

The Eng review locked this: **`/assets/rik.css` is the single source of truth for design tokens + reusable component classes.** Every HTML page links it: `<link rel="stylesheet" href="/assets/rik.css">`. Per-page inline `<style>` allowed only for page-specific overrides — NEVER for design tokens.

This breaks the old CLAUDE.md "no external CSS" rule. Intentional. The 7-page revamp + design system makes inline-only token duplication unmanageable.

See `DESIGN.md` for the full token list + component vocabulary.

### Frontend-only revamp boundary (NEW per Eng D5)

The revamp is **frontend-only**: HTML structure, copy, visual layout, CSS, asset references. Backend behavior is UNCHANGED.

**DO NOT modify** without explicit founder authorization (set `ALLOW_BACKEND_TOUCH=1` env to bypass the no-touch hook):
- `lib/methodology.js` (mods → §6.1 14-day re-review obligation with Emily)
- `lib/routing.js` (deterministic tier engine)
- `lib/render.js` (audit deliverable HTML at /a/[slug])
- `lib/ai-drafter.js` (Claude Haiku prompt)
- `lib/db.js` (Postgres queries)
- Any file in `/api/`

Pre-commit hook at `scripts/no-touch-check.sh` enforces this.

### RDN compliance (read PLAN.md compliance section before any RDN-related change)

**Locked §1.1 citation form (signed agreement, exact wording):**
> Methodology reviewed by Emily Haydon Norman, RDN — Commission on Dietetic Registration (USA), reg. #86117608, May 2026.

**§1.2 permitted locations**: methodology section/sections, bundle, calculator, Sprint, Premium, Audit deliverable, opt-in email, business decks, investor materials. **Homepage is NOT permitted by name** — homepage gets generic "RD-reviewed methodology" trust line only.

**§1.6(b) deploy gate**: Reviewer must approve placement, dimensions, and crop in writing BEFORE going live. Workflow: build → screenshot → email Emily ONE batch PDF with all banner placements → wait for written reply → deploy. Approval lives at `docs/emily-1-6b-approval-YYYY-MM-DD.eml` (gitignored).

**§4.3 scope clarification block**: must appear adjacent to Citation on every page that names her.
**§2 FTC adjacent**: "Paid independent methodology review. Opinions are Reviewer's own." — visible without user action (not footer-only).

**§6.1 re-review obligation**: any change to CHO/sodium/hydration/caffeine targets, gut-adaptation progression, recovery placement, pre-session meal protocol, or race-week tapering rules → notify Reviewer in writing within 14 days.

### FDA structural-functional claim language

- USE: supports, designed to, may help, tends to
- AVOID: guarantees, proven to, ensures, cures, treats, diagnoses, prevents disease
- Every nutrition claim with † on first use, single FDA disclaimer block per page
- `scripts/compliance-grep.sh` exits non-zero on any prohibited word

### Nav (preserved from prior CLAUDE.md)

Sticky header, 56px tall. Nav links MUST have `padding: 19px 0; display: flex; align-items: center;` to fill the full touch target. Mobile = hamburger top-right → full-screen menu.

### No `<a><button>` nesting (preserved)

Use `<a class="btn btn-primary">` directly. Interactive nesting is invalid HTML.

### Stripe Payment Links (live as of 2026-05-09 — all hardcoded; env-var indirection deprecated)

| Tier | Price | URL |
|---|---|---|
| Bundle | $119 | `https://buy.stripe.com/4gM7sN6Wq3cc7T0fZ67Re00` |
| Sprint 70.3 (`hours=low`) | $569 | `https://buy.stripe.com/7sY9AVdkOdQQ3CKbIQ7Re02` |
| Sprint Full Ironman (`hours=mid`) | $659 | `https://buy.stripe.com/7sY28tfsW2887T07sA7Re03` |
| Sprint Pro (`hours=high`) | $899 | `https://buy.stripe.com/3cI4gB1C65kk1uCdQY7Re04` |
| Founding Cohort Premium | $1,599 | `https://buy.stripe.com/00waEZ1C68ww2yG0087Re06` |

Sprint links live in `sprint.html` `STRIPE_LINKS` table (hours-low/mid/high → 703/full/pro). Bundle/Premium are hardcoded directly into `<a>` tags.

Each Stripe link must have its **after-payment redirect** configured in the Stripe dashboard:

```
Bundle:        https://www.rikathletica.com/thank-you?tier=bundle&session_id={CHECKOUT_SESSION_ID}
Sprint 70.3:   https://www.rikathletica.com/thank-you?tier=sprint&plan=703&session_id={CHECKOUT_SESSION_ID}
Sprint Full:   https://www.rikathletica.com/thank-you?tier=sprint&plan=full&session_id={CHECKOUT_SESSION_ID}
Sprint Pro:    https://www.rikathletica.com/thank-you?tier=sprint&plan=pro&session_id={CHECKOUT_SESSION_ID}
Premium:       https://www.rikathletica.com/thank-you?tier=premium&session_id={CHECKOUT_SESSION_ID}
```

Do not change without confirming with operator.

### WhatsApp Business (iter-2.5 — tier-based access)

Currently `WHATSAPP_BUSINESS_PLACEHOLDER` in HTML. Swap when number is ready:

```bash
sed -i '' "s|WHATSAPP_BUSINESS_PLACEHOLDER|YOUR_E164_NUMBER|g" \
  premium.html sprint.html
```

Number format: E.164 without `+` (e.g., `66812345678` for Thailand). The
`https://wa.me/` URL pattern requires this format.

Tier-based framing (locked):
- **Premium** ($1,599): pre-purchase ask near reserve CTA + post-purchase concierge line during protocol weeks. 24h async, batched once daily.
- **Sprint** ($569–$899): WhatsApp during the 4 protocol weeks for protocol-specific questions. Same async framing.
- **Bundle** ($119): email only (Bek.Zhou@rikathletica.com), 1–2 business days.
- **Warm leads** (pre-purchase, non-Premium): email only.

Voice: always "us" / "message us" — never "Bek" / "me" / "the founder" by name on customer-facing surfaces.

### Typeform URLs (preserved)

- Full intake: `https://form.typeform.com/to/XT5Qo0HD`
- Screening: `https://form.typeform.com/to/XdU5A5FQ`

## Sprint v2 architecture (Race Pack model — preserved from live)

Flow: Typeform screening → Dropbox Sign contract → Stripe payment → Typeform full intake → **two training shipments** (Shipment 1 Training Box at Day 5, Shipment 2 Replenish at Week 2). **Race Pack is an optional add-on at Stripe checkout** (not included in base Sprint price); ships 10 days before race day if purchased.

Race gate: 28–56 days from sign-up. Server-side validation in `/api/create-sign-request.js`.

API routes:
- `POST /api/create-sign-request`
- `POST /api/screen` (Typeform screening webhook)
- `POST /api/intake` (Typeform full intake webhook)
- `POST /api/audit/submit` (Audit form)
- `POST /api/audit/approve` (admin approve & email)
- `GET  /a/:slug` → `/api/audit/render?slug=:slug` (audit deliverable page)
- `POST /api/admin/queue` + `POST /api/admin/draft` (admin SPA)
- `POST /api/stripe-webhook` (Stripe → Kit conversion auto-tag)
- `POST /api/calc` (server-side calculator from live commit ccd25ac)
- `POST /api/leads` (email capture from live)
- `POST /api/checkin` (Sprint check-in webhook)
- `GET /api/cron/daily-sweep` (09:00 UTC daily)

## Phase 1.6 instrumentation

Heavy GA4 + Kit tagging on `/calculator` + `/audit`. Full event taxonomy in PLAN.md.
Implementation: single `/assets/rik-analytics.js` shared file with helper functions.
Verify with GA4 DebugView before each Phase 2 lane is approved.

## Testing

- `bun test tests/` — audit routing tests (10 passing)
- `bun test calculator.test.ts` — calculator tests (4 passing)
- Compliance grep: `./scripts/compliance-grep.sh` exits 0 if no prohibited words
- Form-action regression: `./scripts/form-action-baseline.sh diff` exits 0 if no diff
- Stripe hot-test: `./scripts/stripe-link-hot-test.sh` exits 0 if all links resolve
- Visual: `mcp__Claude_Preview__*` per page during build

## What NOT to do

- Do not modify `lib/*` or `api/*` without `ALLOW_BACKEND_TOUCH=1` and a documented reason
- Do not add a bundler or framework — keep it static HTML + serverless
- Do not commit `.gstack/`, `.env.local`, `leads.csv`, or backup files (gitignored)
- Do not change Stripe payment links without operator confirmation
- Do not add Emily citation by name on `/index.html` (§1.2 violation)
- Do not deploy any banner that names Emily without her §1.6(b) written approval on file
- Do not use prohibited FDA/FTC words (run compliance-grep.sh before commit)

## See also

- `PLAN.md` — locked execution plan (read this first)
- `DESIGN.md` — design system tokens + rules
- `DEPLOY.md` — deploy runbook
- `TODOS.md` — roadmap + deferred items
- `CHANGELOG.md` — version history
