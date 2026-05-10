# RIK Athletica — Session Handoff
**Cutoff: 2026-05-09 17:30 ICT** · Generated for cross-session content production work.

> **How to use this doc:** open a new Claude Code (or any LLM) session and `@HANDOFF.md` this file. It contains every fact, decision, asset, and constraint a content-producing session needs in order to write emails, deliverables, ad copy, social posts, or new HTML on-brand without breaking the production state.

---

## 0. The 30-second orientation

**RIK Athletica** is an endurance sports nutrition brand for triathletes & ultrarunners. Three SKU tiers:

| Tier | Price | What it is | Audience |
|---|---|---|---|
| **Bundle** | $119 | 30 functional gels (10 Euphoria pre-session activators + 20 Refuel intra/recovery gels). One-off product, ships in 5 days, 30-day money-back. | Self-directed athletes who want the products without the protocol. |
| **4-Week Sprint** | $569 / $659 / $899 | Personalized 4-week fueling protocol calibrated to athlete physiology. **Two shipments included** (Shipment 1 Training Box at Day 5, Shipment 2 Replenish at Week 2 — both training products, no race-day mix). **Race Pack is an optional add-on at checkout** — race-day product mix from finalized protocol, ships 10 days before race day. Weekly revision loop. RD-reviewed methodology. **Race-gated 28–56 days out.** Coach required. | Athletes 4–8 weeks out from a 70.3, Full Ironman, or higher-volume training. |
| **Founding Cohort Premium** | $1,599 | Done-for-you tier. Includes Sprint protocol + race-week WhatsApp concierge + post-race debrief + sourcing of all products. **10 slots per cycle. Founder-delivered (Bek personally).** Last enrollment May 18, 23:59 ET. | Time-constrained executives, parents, pros wanting "off my plate." |

**Founder:** Bek Zhou — `Bek.Zhou@rikathletica.com` · WhatsApp: `+1 (626) 360-9822`
**Reviewer:** Emily Norman, MS, RDN — Commission on Dietetic Registration (USA), reg. #86117608, reviewed May 7, 2026
**Live site target:** `https://www.rikathletica.com` (deploys via `vercel --prod --yes`, NOT GitHub auto-deploy)

---

## 1. Project location & files

### 1.1 Working directory
```
/Users/bekzhou/Documents/Claude Code - Gstack/.claude/worktrees/confident-jones-80753d
```

This is the Claude Code session worktree, also the **canonical deploy source**. GitHub remote: `https://github.com/bekzhou8455/rik-athletica.git`

### 1.2 Folder split history
A previous parallel folder existed at `/Users/bekzhou/Documents/Website Revamp-May2025/` containing the Iter-5 visual revamp work. **This session converged that folder into the worktree via rsync** (preserving B's `.git/`, `.claude/`, and `lab/` directories). The Website Revamp folder is now deprecated/archive; do not edit it. All work happens in the worktree.

### 1.3 Top-level customer files
```
index.html         — Homepage (iter-5)
bundle.html        — Bundle product page (iter-5) ($119)
sprint.html        — 4-Week Sprint service page (iter-5) ($569/$659/$899)
premium.html       — Founding Cohort Premium (iter-5) ($1,599) — has gated screening form
calculator.html    — Slim host wrapper for React calc (iter-5 token-swapped)
audit.html         — Free Audit Level 0 entry form (iter-5)
checkin.html       — Athlete-only Typeform check-in (iter-5)
thank-you.html     — Post-purchase confirmation (iter-5, GA4 purchase event firing)
404.html           — Branded 404
privacy.html       — Privacy policy
terms.html         — Terms of service
ref-redirect.html  — Rewardful affiliate redirect handler
robots.txt
sitemap.xml
.well-known/ai.txt — AI/bot policy
wireframe.html     — Pre-revamp prototype (NOT in nav, NOT customer-facing — kept as historical reference)
```

### 1.4 Backend (DO NOT TOUCH without `ALLOW_BACKEND_TOUCH=1` env)

```
api/
  audit/{submit,approve,render}.js   — Audit Level 0 backend
  admin/{queue,draft}.js              — Admin queue SPA
  calc.js                             — Server-side calculator (IP protection from commit ccd25ac)
  checkin.js                          — Sprint check-in webhook
  create-sign-request.js              — Dropbox Sign Sprint contracts
  cron/daily-sweep.js                 — 09:00 UTC cron
  email-templates.js
  intake.js                           — Typeform full intake webhook
  leads.js                            — Email capture
  mailer.js                           — Shared SMTP (Gmail)
  onboarding-templates.js
  screen.js                           — Typeform screening webhook
  stripe-webhook.js                   — Conversion auto-tagger to Kit

lib/                                  — Backend modules (DO NOT TOUCH)
  methodology.js                      — v3.1 LOCKED constants
  routing.js                          — Deterministic tier engine
  ai-drafter.js                       — Claude Haiku audit prompt
  db.js                               — Postgres queries
  kit.js                              — Kit (ConvertKit) API client
  email-alerts.js                     — Gmail SMTP audit-delivery + admin alerts
  pdf.js                              — Unused (PDF disabled), kept for revival
  render.js                           — Shared HTML renderer for /a/[slug]

middleware.js                         — AI-bot blocking + IP protection
admin/audit-queue.html                — Admin SPA
```

**Pre-commit hook at `scripts/no-touch-check.sh` enforces backend untouchability.** Bypass requires explicit `ALLOW_BACKEND_TOUCH=1` env on the commit command.

### 1.5 Documentation files
```
CLAUDE.md                      — Project instructions (read first by Claude Code)
DESIGN.md                      — Locked iter-5 design system tokens + voice + IA + cross-medium
DEPLOY.md                      — Vercel deploy runbook
PLAN.md                        — Original locked execution plan (3 reviews CLEAR)
TODOS.md                       — Roadmap + deferred items
CHANGELOG.md                   — Version history
README.md                      — Setup + route map (Stripe URL table)
STRIPE_PREMIUM_SETUP.md        — Stripe payment-link config (production state)
WHATSAPP_DEPLOYMENT.md         — Operating manual for WhatsApp Business + 5-tier use-case plan
LAUNCH_PHASES.md               — Phase 1-6 launch sequence
DESIGN.iter-4.archive.md       — Pre-iter-5 archived design history
HANDOFF.md                     — This file
VERSION                        — Currently 2.0.0
```

### 1.6 Asset directories
```
assets/
  web/                  — Hero JPGs, packshots, headshot, Emily signature, RD statement PDF
  ingredients/          — 10 functional ingredients (yerba, l-carnitine, taurine, beta-alanine, electrolytes, glutamine, cherry, bcaa, curcumin, citrulline)
  video/
    sprint-hero.mp4     — Hero video on /sprint (12s loop, 1280×720, 9.1 MB)
    sprint-hero-poster.jpg — First-frame poster (210 KB)
    delivery-loop.mp4   — Existing
  signature/            — Bek's signature (audit deliverable email)
  media/                — Logo files (rik-logo.png, rik-logo-cropped.png, etc.)
  whatsapp/             — WhatsApp Business assets (this session)
    avatar-WHITE-bg.png       (1080×1080 — flat RGB)
    avatar-AMBER-bg.png       (1080×1080 — flat RGB)
    avatar-INK-bg.png         (1080×1080 — flat RGB) ← used in production
    status-9x16-premium.jpg   (1080×1920 — Status update template)
    status-9x16-bundle.jpg    (1080×1920)
    catalog-{bundle,sprint,premium,audit}-1080.jpg (1080×1080 each)
    og-link-preview-1200x630.jpg (for website OG meta tags — not yet wired into pages)
  rik-analytics.js      — Phase 1.6 GA4 + Kit instrumentation helpers
  calculator-app.js     — Compiled React calculator (iter-5 token-swapped to ink, no green)
```

---

## 2. Visual design system (iter-5 — LOCKED)

Read `DESIGN.md` for the full source of truth. This is the abridged version.

### 2.1 Tokens

```css
:root {
  --bg:        #EEEDEA;     /* sand — page background */
  --bg-2:      #D5D2CC;     /* warm gray — alt sections */
  --bg-sand:   #C4B59E;     /* deeper sand — cards */
  --ink:       #0E0E0E;     /* primary text + accent */
  --ink-soft:  #5A5853;     /* secondary text */
  --ink-dim:   #8A8780;     /* tertiary text */
  --rule:      rgba(14,14,14,.18);   /* dashed dividers */
  --rule-soft: rgba(14,14,14,.10);   /* subtle borders */
  --warm-img:  linear-gradient(135deg,#7a4a2a,#c98b5a 50%,#3a2418);  /* atmospheric warm break */
  --sans:      "Outfit", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  --display:   "Outfit", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  --maxw:      1320px;
}
```

**Single typeface:** Outfit (300/400/500/600/700/800). Loaded from Google Fonts. NO Inter, NO Plus Jakarta Sans, NO Playfair Display. The calculator React app was token-swapped this session to drop its Playfair+Inter and use Outfit-only.

**No green accent.** The previous design had `#2D5A3D` forest green. **Iter-5 dropped it entirely.** Search and reject any `#2D5A3D`, `#3D7A52`, `#4ade80`, `#86efac` if they appear.

**Period-stacked headlines.** Headlines like "Stop Leaving Minutes. *On the Course.*" — period mid-sentence + em (italic-styled, but Outfit em uses non-italic `color: var(--ink-soft); font-weight: 700` per iter-5).

**Em-dash voice.** Use `—` (em dash) for asides, not parentheticals or commas. Encoded as `&mdash;` in HTML. The footer wa.me link uses encoded em-dash: `?text=Hi%20RIK%20%E2%80%94%20`

### 2.2 Layout patterns (DESIGN.md §12)

- **Section scaffold:** `section.s` with `.s-head` (240px num column + 1fr h2/p column), `.s-num` eyebrow, period-stacked h2, supporting p. `section.s.alt` flips to `var(--bg-2)`.
- **Pattern B — title-left, icon-list-right card:** `.icon-list-card` with `.icon-list` 1:1.4 grid. Used heavily on Bundle ("What's inside"), Sprint ("How it works"), Premium ("Six things end-to-end").
- **Pattern C — feature quad/triad:** `.quad` 3-cell grid (used on Bundle's Three Moments).
- **Atmospheric warm break:** `section.warm-atmos` — full-bleed `var(--warm-img)` linear-gradient with white text. Used as a visual reset between cool sand sections.
- **Voices rotator:** `.voices-stage` with auto-rotating Reddit excerpts (25 quotes, 4500ms interval, opacity-only cross-fade with translateY 8→0).
- **CTA pill+arrow:** `.cta` with `.pill` (capsule, ink bg) + `.arrow` (circular, white bg). On hover: arrow translates `+2,-2`.
- **Hero:** full-viewport image bg + dark left scrim + headline at min(620px, 50%) max-width.
- **Closing:** dark photo-bg section, dramatic h2, eyebrow + p + CTA stack on the right (with strengthened right-side scrim for legibility — fix #6/#10 in this session).
- **Footer (`footer.legal`):** ink bg, dashed rules, FDA disclaimer block, Privacy/Terms links, **WhatsApp link added this session.**

### 2.3 Voice & copy rules (DESIGN.md §11)

- **Capital "You"** when addressing the athlete (`You`, `Your`, `Yourself`). Always.
- **Period-stacked headlines.** "Three Moments. *One Simple Rhythm.*"
- **Em-dash voice.** "We don't write training; we calibrate fueling. Coaching + fueling are different jobs — and we want to do ours well."
- **Banned AI-vocabulary list (DESIGN.md §11.4):** delve, leverage, harness, unleash, robust, comprehensive, seamless, holistic, paradigm, synergy, navigate the landscape, in today's fast-paced world, journey (as metaphor), streamline. If a content session uses any of these, flag and rewrite.
- **FDA structural-functional language (REQUIRED):** USE `supports`, `designed to`, `may help`, `tends to`. AVOID `guarantees`, `proven to`, `ensures`, `cures`, `treats`, `diagnoses`, `prevents disease`. Every nutrition claim with `&dagger;` on first use; single FDA disclaimer block per page in the footer.
- `scripts/compliance-grep.sh` scans for prohibited words and exits non-zero on any hit. Run before every commit.

### 2.4 Image treatment

- **Photo style:** desaturated, warm-tinted, low-saturation. Filter signature: `filter: saturate(.78) brightness(.92) sepia(.10)` on bordered photo cards.
- **Hero photo positions:** different per page (e.g., `bundle-hero.jpg` at `center 40%`, `premium-hero.jpg` at `68% 32%` to focus on face/gel not headphone).
- **Packshots:** `mix-blend-mode: multiply` so white-bg packshot composites cleanly into sand-bg sections without manual cutout.
- **Three Moments illustration:** dotted SVG curve connectors between packshots, IntersectionObserver staggered reveal (100/200/400ms), mobile drops connectors and stacks vertically.

---

## 3. Customer page state (each iter-5)

### 3.1 `/` (index.html, 87 KB)

Homepage. Hero photo, atmospheric warm break, voices rotator, RD review, three-tier CTA wall (Bundle / Sprint / Premium). Closing photo with right-scrim. Existing — minimally touched in this session aside from the WhatsApp footer link.

### 3.2 `/bundle` (bundle.html, 83 KB)

**Touched extensively this session.**
- **Hero:** `bundle-hero.jpg` + headline "More than just carbs."
- **§01 What's Inside:** Pattern B icon-list with 4 row items (10 Euphoria, 20 Refuel, free shipping, 30-day money-back).
- **§02 Two Layers warm-amber atmos break:** stat triplet (0g sugar, 100mg plant caffeine, 1g L-Glutamine).
- **§03 The Products (NEW MERGED — fix #3):** tabbed product display (Bundle / Euphoria / Refuel — 4/2/2 photo angles each, with specs + bullets + price), embedded matte-glass auto-scroll **ingredient carousel** (10 chips × 2 for seamless loop, hover-to-pause, 60s linear infinite, edge gradient masks).
- **§04 Three Moments (REVAMPED):** dynamic illustration with 3 packshots + dotted SVG connector arcs, IntersectionObserver staggered reveal.
- **§05 Voices:** 25-quote Reddit rotator.
- **§06 Add to Cart:** dual CTA wall (Bundle direct + Sprint upsell).
- **§07 Refund Policy Banner (NEW — fix #5):** dedicated dark section with redesigned "30 / Days Money-back" stamp + verbatim sprint-memo policy ("If You train with these gels for 30 days...").
- **Closing:** strengthened right-column scrim for legibility.
- **Stripe link:** `https://buy.stripe.com/4gM7sN6Wq3cc7T0fZ67Re00` (8 instances + tracking handler).
- **NO RD-review section** (removed in this session; product page kept clean of the methodology citation).

### 3.3 `/sprint` (sprint.html, 79 KB)

**Touched extensively this session.**
- **Hero:** video bg `sprint-hero.mp4` (autoplay/muted/loop/playsinline, `preload="auto"`) with poster `sprint-hero-poster.jpg` (matches video first frame — no flash on load). No eyebrow. Headline "Claim Back. *The Minutes.*"
- **Marginal-gains copy throughout** ("The pros pay six figures. You pay $569.", "Feels Like a Steal. *It's Just Legal.*", "Four Weeks. *Iterate Until It Works.*", "Marginal gains compound — but only if You start.")
- **§01 Marginal gains:** Pattern B 4-step icon-list.
- **§02 Two Boxes warm-atmos:** delivery timeline (5 days / 4 weeks / 10 days out).
- **§03 Pricing:** 3-tier cards (70.3 / Ironman / Pro at $569/$659/$899), all CTAs route to `#start` form.
- **§04 Comparison:** Sprint vs Generic Coaching table.
- **§05 Voices.**
- **§06 RD Review:** Emily Norman MS RDN block (per §1.2 — Sprint IS a permitted location).
- **§07 Screening + Checkout (the gate):**
  - Race distance (70.3 / Full)
  - Race date (28–56d window enforced client + server-side via `/api/create-sign-request`)
  - Weekly hours (low/mid/high → 70.3/Ironman/Pro tier auto-route)
  - Active coach (gate)
  - Medical exclusion checklist (heart condition, diabetes, eating disorders, pregnant, thyroid med, IBS, anti-arrhythmics, caffeine restriction)
  - Refund consent + ToS checkbox
  - Tier display + Stripe button (3 URLs dispatched by `STRIPE_LINKS.{low,mid,high}`)
- **Sprint shipment model (matches `terms.html` legal):**
  - Shipment 1 (Training Box) — RIK Bundles + Layer 1 products for Weeks 1–2. Ships within 5 days of intake.
  - Shipment 2 (Replenish) — Layer 1 products for Weeks 3–4. Ships at Week 2 (after first revision cycle).
  - **Race Pack is OPTIONAL — added at Stripe checkout.** Race-day product mix calibrated to finalized protocol. Ships 10 days before race day if purchased.
- **Closing:** strengthened right-scrim, marginal-gains CTA framing.
- **Stripe links:**
  - low: `7sY9AVdkOdQQ3CKbIQ7Re02` ($569)
  - mid: `7sY28tfsW2887T07sA7Re03` ($659)
  - high: `3cI4gB1C65kk1uCdQY7Re04` ($899)
- **Coached-athletes banner** above screening form (this session): "We Calibrate Fueling. Your Coach Calibrates Training."

### 3.4 `/premium` (premium.html, 86 KB)

**Built fresh this session — Premium previously didn't exist.**
- **Hero:** `premium-hero.jpg` at `background-position: 68% 32%` (face-focused, NOT headphone). Two scrim layers (left for headline, bottom-center to de-emphasize headphones). Headline: "Off Your Plate. *Off Your Mind.*" + 6-item icon-list (RD-reviewed protocol / every product sourced / race-week concierge / post-race debrief / founder-delivered / full refund).
- **§01 What's Included:** Pattern B icon-list, 6 numbered rows with à-la-carte values ($659 + $397 + $599 + $400 + $390 + $400 = $2,845 advertised total).
- **§02 Value Stack (replaces warm-atmos — fix #12):** rich multi-stop posh gradient (cognac → amber → gold) with dotted screen overlay. Headline "$2,845. *For $1,599.*" with strikethrough on $2,845. 3-cell stat row.
- **§02 Race Week (new — fix #13):** "The Week Before Your Race, *You're on RIK Direct.*" — full-width split card explaining RIK Direct = WhatsApp for Business, async-first, 2hr SLA during race week. **Explicit "not on call" disclaimer.** Replaces all prior phone-line/on-call framing.
- **§03 RD Review:** Emily Norman block.
- **§04 Voices.**
- **§05 Reserve:** screening form (gates the Stripe button) — race distance + race date (28–56d) + experience confirmation + cohort consent + refund consent + ToS. 6 gates total. Stripe button is `aria-disabled="true"` until all pass.
- **Refund-near-CTA banner (NEW — fix #15):** matte-glass card with "Full refund / $1,599 / Refund honored" stamp + verbatim premium-refund policy ("Complete the 4-week protocol... 14 days... full $1,599... We carry the risk").
- **Slot ticker** (top of page): "10 Founding Cohort slots open · Last enrollment May 18, 23:59 ET · {countdown}".
- **Closing.**
- **Stripe link:** `00waEZ1C68ww2yG0087Re06` ($1,599).
- **NO Founder Note section** (deleted this session — fix #14).

### 3.5 `/calculator` (calculator.html, 13 KB host wrapper)

React app at `assets/calculator-app.js` (165 KB compiled, esbuild output).
- Iter-5 host wrapper: Outfit-only typography, sand+ink palette, RD review section in iter-5 style, footer.legal.
- React app token-swapped this session: `T = { bg:#EEEDEA, ink:#0E0E0E, ... }` — green accent `#2D5A3D` REPLACED with `#0E0E0E` everywhere. All Playfair Display + Inter font-family swapped to Outfit. Italic ems → non-italic ink-soft + weight 700.
- Server-side calc endpoint at `/api/calc.js` (B's IP-protection commit — methodology runs server-side).
- All 12 calc unit tests pass.

### 3.6 `/audit` (audit.html, 53 KB)

Free Level-0 methodology audit form. Submits to `/api/audit/submit` → stored in Postgres → admin queue (`/admin/audit-queue.html`) → admin approve via `/api/audit/approve` → emails athlete a link to `/a/[slug]` (rendered by `/api/audit/render`).
- Iter-5 visual treatment.
- Form preserves all backend fields.
- WhatsApp footer link added this session.

### 3.7 `/checkin` (checkin.html, 13 KB)

Athlete-only utility page. Restyled this session to iter-5 (was Plus Jakarta + green). Embeds Typeform live form `xhtuSNpJ`. Self-contained CSS, noindex/nofollow. **Typeform embed uses Typeform's canonical pattern** — bare `<div data-tf-live="ID">` + `<script src="//embed.typeform.com/next/embed.js">` immediately after, no extra `data-tf-*` attributes. Wrapper bg is transparent (not white) to avoid the chunky-white-edge problem when iframe is shorter than wrapper.

### 3.8 `/thank-you` (thank-you.html, 14 KB)

**Restyled this session to iter-5 + GA4 enhanced-ecommerce purchase tracking.** Reads `?tier=premium|sprint|bundle&plan=703|full|pro&session_id=cs_live_xxx` from URL, shows the right tier card, fires `purchase` GA4 event with proper `transaction_id` (Stripe session ID), `value`, `currency:'USD'`, `items` array, and `coupon: 'founding-cohort'` (Premium only). Plus tier-specific named events (`{tier}_purchase_complete`). Falls back to a default card when no tier param.

---

## 4. Tracking infrastructure

### 4.1 GA4

Property: `G-X7LJHZLR4K`. Loaded on every page (eagerly on `/thank-you` so the purchase event fires before any rage-back).

**Funnel events (in order):**

| Stage | Event | Where it fires | Payload |
|---|---|---|---|
| Page view | `{tier}_page_view` | every customer page load | `{page:'<page>'}` |
| Item view | `view_item` | `/premium`, `/bundle`, `/sprint` page loads | items array |
| CTA click | `{tier}_reserve_click` / `{tier}_add_to_cart` / `{tier}_cta_click` | every Reserve / Add to Cart click via `data-track` | `{page, value, currency}` |
| Checkout begin | `begin_checkout` | Stripe link click (after gates unlock) | items array, currency, value |
| Stripe open | `stripe_checkout_open` | same Stripe link click | `{tier, value}` |
| Purchase | `purchase` | `/thank-you` page load with `session_id` | `{transaction_id, currency, value, items, coupon?}` |
| Purchase named | `{tier}_purchase_complete` | same — funnel readability | `{tier, plan?, value, transaction_id}` |
| Eligibility | `{tier}_eligibility_passed` | screening form clears all gates | (existing) |
| WhatsApp | `whatsapp_open` | footer wa.me link click | `{page}` |

**Item IDs used in items[]:**
- Bundle: `bundle-30-gels`
- Sprint 70.3: `sprint-703`
- Sprint Full: `sprint-full`
- Sprint Pro: `sprint-pro`
- Premium: `premium-founding-cohort`

### 4.2 Rewardful

Account key: `73b07c`. Script: `https://r.wdfl.co/rw.js?data-rewardful=73b07c`. Loaded on every customer page + thank-you. Affiliate referral cookie set via `/ref/[slug]` redirect (handled by `ref-redirect.html`). Conversion auto-fires server-side via `api/stripe-webhook.js` when Stripe checkout.session.completed fires — Rewardful matches affiliate cookie to email. **No client-side `rewardful('convert')` call needed.**

### 4.3 Phase 1.6 RIK helper

`assets/rik-analytics.js` exposes `window.RIK.cta(eventName)` — fires to internal Kit conversion pipeline + scroll-depth + page-exit telemetry. Called alongside GA4 events on every Stripe click.

### 4.4 Stripe webhooks

`api/stripe-webhook.js` (B's commit ccd25ac):
- Listens for `checkout.session.completed`
- Tags Kit subscriber based on tier (`bundle_paid`, `sprint_703_paid`, `sprint_full_paid`, `sprint_pro_paid`, `premium_paid`)
- Fires Rewardful server-side conversion
- Logs to internal pipeline

### 4.5 Other tracking

- `secureprivacy.ai` consent management — script on every page (CMP for GDPR/CCPA)
- AI-bot blocking + IP protection at `middleware.js` (per commit ccd25ac)

---

## 5. Stripe payment infrastructure

### 5.1 Live URLs (verified HEAD 200 in production)

| Tier | Price | URL | Where wired |
|---|---|---|---|
| Bundle | $119 | `https://buy.stripe.com/4gM7sN6Wq3cc7T0fZ67Re00` | bundle.html (8 CTAs), sprint.html (1 upsell) |
| Sprint 70.3 | $569 | `https://buy.stripe.com/7sY9AVdkOdQQ3CKbIQ7Re02` | sprint.html `STRIPE_LINKS.low` |
| Sprint Full | $659 | `https://buy.stripe.com/7sY28tfsW2887T07sA7Re03` | sprint.html `STRIPE_LINKS.mid` |
| Sprint Pro | $899 | `https://buy.stripe.com/3cI4gB1C65kk1uCdQY7Re04` | sprint.html `STRIPE_LINKS.high` |
| Premium | $1,599 | `https://buy.stripe.com/00waEZ1C68ww2yG0087Re06` | premium.html `#premium-reserve-btn` |

### 5.2 Per-link "Business details" (configured by Bek 2026-05-09)

For all 5 links:
- Customer support email: `Bek.Zhou@rikathletica.com`
- Business website: `https://www.rikathletica.com`
- Privacy policy URL: `https://www.rikathletica.com/privacy`
- ToS URL: `https://www.rikathletica.com/terms`
- Require ToS acceptance: **ON**

### 5.3 Per-link "After payment" redirect URLs (configured by Bek)

```
Bundle:        https://www.rikathletica.com/thank-you?tier=bundle&session_id={CHECKOUT_SESSION_ID}
Sprint 70.3:   https://www.rikathletica.com/thank-you?tier=sprint&plan=703&session_id={CHECKOUT_SESSION_ID}
Sprint Full:   https://www.rikathletica.com/thank-you?tier=sprint&plan=full&session_id={CHECKOUT_SESSION_ID}
Sprint Pro:    https://www.rikathletica.com/thank-you?tier=sprint&plan=pro&session_id={CHECKOUT_SESSION_ID}
Premium:       https://www.rikathletica.com/thank-you?tier=premium&session_id={CHECKOUT_SESSION_ID}
```

Stripe substitutes `{CHECKOUT_SESSION_ID}` automatically. Thank-you page reads tier+plan+session_id from URL.

### 5.4 Stripe product breakdown (Premium only, internal)

Premium $1,599 is line-itemized in Stripe as 4 internal-cost components (NOT shown on website):
- Sprint Protocol Service — Premium: $350
- RIK Direct — Race-Week Founder Access: $552
- RIK ATHLETICA™ Bundle — Pro Pack (3× @ $99): $297
- Layer 1 Fueling Box — Pro: $400

**Total: $1,599.** This breakdown is for transparency at checkout. The website's $2,845 "à-la-carte" anchor is a separate marketing framing — don't show the Stripe breakdown anywhere on premium.html.

### 5.5 Slot limits

- Premium: max 10 payments (Founding Cohort hard cap, set via "Limit number of payments" in Stripe)
- Sprint, Bundle: no cap

---

## 6. WhatsApp Business deployment

### 6.1 Account

- Phone: **`+1 (626) 360-9822`**
- wa.me link: `https://wa.me/16263609822`
- Pre-filled support entry: `https://wa.me/16263609822?text=Hi%20RIK%20%E2%80%94%20`
- Verified business badge: **NOT available currently.** Re-apply at 6-month mark.

### 6.2 Profile fields (configured 2026-05-09)

- Avatar: `assets/whatsapp/avatar-INK-bg.png` (white wordmark on ink-black bg, 1080×1080, RGB-flattened — alpha=0 transparent PNGs caused WhatsApp to render the avatar as pure black; flattening to RGB fixed it)
- Name: RIK Athletica
- Category: Sports (alternative: Health & wellness if Meta lets you switch)
- Hours: Mon–Fri 09:00–18:00 ICT (UTC+7), Sat–Sun closed
- Description (256 char): `Endurance sports nutrition for triathletes & ultrarunners. Layer 2 functional gels + 4-week personalized fueling protocols. RD-reviewed methodology. Race-day fueling, calibrated.`
- Status line: `Race-day fueling, calibrated. Async-first. Reply window M–F.`
- Website: `https://www.rikathletica.com`
- Business email: `Bek.Zhou@rikathletica.com`

### 6.3 Greeting message (auto-sent on first contact)

```
Hi! You've reached RIK Athletica.

I'm Bek (founder). We're endurance sports nutrition — Layer 2 functional gels + RD-reviewed 4-week protocols.

Quick orientation:
• Just have a question? Type it.
• Premium customer? Reply PREMIUM to route Yourself.
• Sprint customer? Reply SPRINT.
• Race-day issue? Reply RACE.

Async-first, M–F 09:00–18:00 ICT. For medical emergencies, dial Your local emergency number — we're not on call.

Talk soon.
```

### 6.4 Away message (outside business hours)

```
We're outside reply hours right now (M–F 09:00–18:00 ICT). I'll see Your message first thing tomorrow morning.

If You're a Premium customer in race week, message back with PREMIUM RACE — that pings me through.

— Bek
```

### 6.5 Quick Replies (9 templates)

Live in WhatsApp Business. Full text in `WHATSAPP_DEPLOYMENT.md`. Shortcuts:
- `/sprintvspremium`
- `/racedate`
- `/coach`
- `/refundbundle`
- `/refundpremium`
- `/starthere`
- `/medical`
- `/intl`
- `/founder`

### 6.6 Labels (6, for routing)

- `PREMIUM` (red — answered first, especially race week)
- `SPRINT` (orange — same-day during 4-week protocol)
- `BUNDLE` (yellow — 1 business day)
- `WARM-LEAD` (blue — pre-purchase)
- `WARM-COLD` (gray — non-converted after 7 days)
- `FEEDBACK-DUE` (green — Day +14 post-race or Day +30 post-bundle)

### 6.7 Catalog (6 items)

- The RIK Bundle — $119
- 4-Week Sprint — 70.3 — $569
- 4-Week Sprint — Full Ironman — $659
- 4-Week Sprint — Pro — $899
- Founding Cohort Premium — $1,599
- Free Methodology Audit — $0

### 6.8 5 use cases (operating model)

| Tier | Who | SLA | Tone |
|---|---|---|---|
| **A — Race-week Premium concierge** | Premium customers in 7 days before race | 2 hours, 06:00–23:00 ET, 7 days | Calm, decisive, founder voice |
| **B — Sprint customer support** | Sprint customers in 4-week window | Same business day | Coaching-adjacent |
| **C — Bundle customer support** | Bundle buyers | 1 business day | Friendly, upsell-aware |
| **D — Warm-lead conversion** | Anyone clicking wa.me link from website | 1 business day | Consultative, qualifies in 2-3 messages |
| **E — Outbound feedback collection** | Recent customers, batched | Manual founder voice | Honest, no pitch |

### 6.9 Footer link rolled out (this session)

`<a href="https://wa.me/16263609822?text=Hi%20RIK%20%E2%80%94%20" target="_blank" rel="noopener" data-track="whatsapp_open">` with WhatsApp SVG icon + "WhatsApp" text — placed in `footer.legal .legal-top` BEFORE `Privacy · Terms` on all 6 customer pages (`/`, `/bundle`, `/sprint`, `/premium`, `/calculator`, `/audit`). NOT on `/checkin` or `/thank-you` (utility pages).

### 6.10 Verified-badge alternative trust strategy

Without the green checkmark:
1. Profile completeness (all fields filled — done)
2. Brand consistency (avatar matches website wordmark + iter-5 voice — done)
3. Pinned welcome message with verifiable details (done)
4. Web → WhatsApp consistency (wa.me link only on rikathletica.com — done)
5. Business email matches website domain (`Bek.Zhou@rikathletica.com` — done)
6. Privacy + Terms linked from same domain (done)
7. Re-apply at 6-month mark when ≥500 conversations + clean ToS-compliant history

---

## 7. Compliance constraints (ALWAYS APPLY)

### 7.1 RDN citation (LOCKED — signed agreement, exact wording)

> Methodology reviewed by Emily Haydon Norman, RDN — Commission on Dietetic Registration (USA), reg. #86117608, May 2026.

(Some pages use "Emily Norman, MS, RDN" form which is also acceptable and live.)

**§1.2 Permitted locations:** methodology section/sections, Bundle, Calculator, Sprint, Premium, Audit deliverable, opt-in email, business decks, investor materials. **Homepage gets only the generic "RD-reviewed methodology" trust line — NOT Emily's name.**

**§1.6(b) deploy gate:** Reviewer must approve placement, dimensions, crop in writing BEFORE going live for ANY Emily-by-name banner. Workflow: build → screenshot → email Emily ONE batch PDF with all banner placements → wait for written reply → deploy. Approval lives at `docs/emily-1-6b-approval-YYYY-MM-DD.eml` (gitignored). **NOT YET DONE.** Phase 4 deliverable.

**§4.3 Scope clarification block:** must appear adjacent to citation on every page that names her. Already on bundle/sprint/premium/audit/calculator.

**§2 FTC adjacent disclosure:** "Paid independent methodology review. Opinions are Reviewer's own." — must be visible without user action (NOT footer-only). Already adjacent to citation on all pages.

**§6.1 re-review obligation:** any change to CHO/sodium/hydration/caffeine targets, gut-adaptation progression, recovery placement, pre-session meal protocol, or race-week tapering rules → notify Emily in writing within 14 days. `lib/methodology.js` modification triggers this.

**§1.6(c) headshot dimension cap:** ≤320px wide. Already enforced.

**§1.6(f) full statement linked adjacent to excerpt:** `assets/docs/rd-review-statement.pdf` — already in place.

### 7.2 FDA structural-functional language (REQUIRED)

- ✅ USE: `supports`, `designed to`, `may help`, `tends to`
- ❌ AVOID: `guarantees`, `proven to`, `ensures`, `cures`, `treats`, `diagnoses`, `prevents disease`
- Every nutrition claim with `&dagger;` (†) on first use
- Single FDA disclaimer block per page in footer
- `scripts/compliance-grep.sh` exits non-zero on any prohibited word — RUN BEFORE COMMIT

### 7.3 Other constraints

- No `<a><button>` nesting (invalid HTML)
- Sticky header 56px tall, padding `19px 0` on nav links for full touch target
- No bundler / framework — keep static HTML + serverless
- Don't commit `.gstack/`, `.env.local`, `leads.csv`, backup files (gitignored)
- Don't change Stripe payment links without Bek's confirmation

---

## 8. What's left (Phase 3-6 from LAUNCH_PHASES.md)

### Phase 3 — Email sequences (NEXT — being tackled this session)

Resend or Kit-templated emails for:
- **Bundle:** order confirmation, shipping notification
- **Sprint:** screening fail (immediate), screening pass cart-abandonment recovery (1hr after pass, no payment, with WELCOME15 promo), intake form prompt, **per-key-session check-ins** (fires on day of each key session — replaces weekly Monday cadence), shipment notification (Bek-triggered)
- **Premium:** enrollment confirmation, intake form prompt, **per-key-session check-ins** (same model as Sprint), **RIK Direct go-live email (Day −7)** with WhatsApp CTA button (number embedded in link, not as plain text — per scope confirmation 2026-05-10), **Day +2 post-race Typeform-embedded debrief** + analysis email back within 7 days
- **Scope confirmation 2026-05-10 — async-only:** No phone calls. No 30-min debrief calls. No 90-min pre-race sanity checks. No weather-adjusted intake plans or sodium tier shifts. Race-week dashboard holds finalized protocol only — no race-morning timeline, no on-bike pacing, no weather-adjustment table. RIK Direct on WhatsApp = async, message-first, 2hr SLA during race week.
- **Three-pillar adherence design** for both Sprint + Premium: (1) follow protocol as closely as possible, (2) submit feedback after each key session, (3) submit next week's training plan once coach delivers it. Single Typeform handles all three (file-upload field for plan PDF). WhatsApp fallback: `WEEK [N] CHECKIN` + voice note, or `WEEK [N] PLAN` + photo/PDF.
- **Sprint email capture at screening form:** name + email fields added to `/sprint` screening form (2026-05-10). Frontend POSTs to `/api/screen-capture` (SPEC at `SPEC_screen_capture_endpoint.md`, backend pending Bek's `ALLOW_BACKEND_TOUCH=1` authorization). Stripe checkout receives prefilled email.
- **All transactional:** sender `Bek.Zhou@rikathletica.com`, brand-aligned templates matching iter-5

### Phase 4 — Deliverable + asset design (NEXT — being tackled this session)

- Race Pack two-box packaging (Training Box + Race Pack labels)
- Athlete-facing PDF protocol guide (template per tier)
- Premium dashboard URL design (race-week view)
- Emily Norman §1.6(b) live-placement approval batch PDF
- Founding Cohort welcome PDF (Premium tier — physical card or printable)
- Audit Level 0 deliverable HTML template (already exists in `lib/render.js` — review for iter-5 voice/style alignment)

### Phase 5 — Legal & compliance check (DEFERRED)

- Privacy policy review for WhatsApp data flow + Stripe + Typeform + Dropbox Sign
- Terms of service: explicit Premium scope (fueling protocol service, NOT medical care)
- FDA disclaimer audit (every claim has `&dagger;` on first use)
- FTC disclosure: Emily citation has paid-review disclosure adjacent everywhere
- GDPR/CCPA: data retention on intake, WhatsApp threads (18 months per WhatsApp), payment records
- WhatsApp Business Terms compliance

### Phase 6 — Push and deploy (DEFERRED)

```bash
git add <files>
git commit -m "<message>"
git push origin main
vercel --prod --yes --scope rik-athletica
# wait for readyState: READY
curl -I https://www.rikathletica.com/  # verify HTTP 200 + key markers per page
```

---

## 9. Active conventions & guardrails

### 9.1 Page-level conventions

- All customer HTML pages are SELF-CONTAINED (CSS + JS inline). No `assets/rik.css` dependency. Iter-5 design tokens duplicated across each page (intentionally — single-typeface + small token set keeps duplication manageable).
- Every page has the iter-5 `:root` block at the top of `<style>`.
- Every page has `footer.legal` matching the iter-5 dark-bg pattern with FDA disclaimer + WhatsApp + Privacy + Terms.
- Every page has GA4 base + page-specific tracking + Rewardful loader + Phase 1.6 RIK analytics.
- Every page has `<meta name="rikathletica:ip" content="Proprietary methodology — all rights reserved...">` for IP enforcement.
- Every page has `noai, noimageai` in robots (where applicable).

### 9.2 Asset conventions

- New images go to `assets/web/` (production-routed) or `assets/whatsapp/` (WhatsApp-specific)
- All hero JPGs are 1920×2400 portrait (or 1280×720 horizontal for the Sprint video case)
- Heroes are heavy (~1.5–2 MB each); ingredient chips are 200–400 KB
- WhatsApp avatar requires RGB (NO alpha channel) — flatten via Pillow `Image.new("RGB", size, bg).paste(rgba_src, mask=alpha)` before saving
- Video: `avconvert -p Preset1280x720` for web compression on macOS (no ffmpeg)

### 9.3 Backend conventions

- `lib/methodology.js` is LOCKED v3.1 — modifications trigger Emily §6.1 re-review obligation (14-day window)
- `api/*` and `lib/*` not modified without `ALLOW_BACKEND_TOUCH=1` on the commit
- `scripts/no-touch-check.sh` is a pre-commit hook that fails commits violating the no-touch rule

### 9.4 Voice conventions in copy generation

- ✅ Capital "You" / "Your" / "Yourself" when addressing the athlete
- ✅ Period-stacked headlines with em (`Three Words. *Like This.*`)
- ✅ Em-dash for asides (`—` not `--` or commas)
- ✅ FDA structural-functional verbs (`supports`, `designed to`, `may help`)
- ❌ Banned AI vocab (`leverage`, `delve`, `holistic`, `synergy`, `journey`, `landscape`, `seamless`, `robust`, `comprehensive`, `paradigm`, `streamline`, `harness`, `unleash`, `in today's fast-paced world`)
- ❌ Words requiring FDA approval (`cures`, `treats`, `diagnoses`, `prevents disease`, `proven to`, `guarantees`)
- ❌ Don't promise specific time savings without cumulative qualifier
- ✅ Use `&dagger;` on first nutrition claim per page

### 9.5 What NOT to ever do

- Modify `lib/*` or `api/*` without explicit founder authorization (`ALLOW_BACKEND_TOUCH=1`)
- Add a bundler or framework
- Commit `.gstack/`, `.env.local`, `leads.csv`
- Change Stripe payment links without operator confirmation
- Add Emily citation by name on `/index.html` (§1.2 violation)
- Deploy any banner naming Emily without her §1.6(b) written approval on file
- Use prohibited FDA/FTC words (run `scripts/compliance-grep.sh` before commit)

---

## 10. Working with this codebase in a new session

### 10.1 Before any change, run

```bash
cd "/Users/bekzhou/Documents/Claude Code - Gstack/.claude/worktrees/confident-jones-80753d"
git status -s
bun test calculator.test.ts            # 12 tests — must pass
bun test tests/                         # audit routing — 10 tests
./scripts/compliance-grep.sh            # FDA/FTC word scan
```

### 10.2 Local dev server

`.claude/launch.json` has 2 working configs:
- `rik-site` on port 3456 — main customer site (`bun serve.ts`)
- `lab` on port 3457 — internal protocol-building tool

Start via Claude Code's `mcp__Claude_Preview__preview_start` with name `rik-site`. Or `bun serve.ts` from the worktree root.

### 10.3 Smoke test pattern (use this in new sessions)

```typescript
// /tmp/smoke.ts
const PATHS = ['/', '/bundle', '/sprint', '/premium', '/calculator', '/audit', '/checkin', '/thank-you'];
for (const p of PATHS) {
  const r = await fetch('http://localhost:3456' + p);
  const html = await r.text();
  console.log(`${p.padEnd(15)} HTTP ${r.status}  ${html.length}b`);
}
```

```bash
bun /tmp/smoke.ts
```

### 10.4 For content production (emails, copy, marketing assets)

A new session producing CONTENT (not code) only needs to:

1. Read this `HANDOFF.md` for full context
2. Read `DESIGN.md` §11 (voice) and §12 (copy patterns) for tone/structure
3. Reference `WHATSAPP_DEPLOYMENT.md` for the 9 quick-reply template patterns (good copy reference)
4. Reference live page copy for tier-specific tone (premium.html for white-glove, sprint.html for marginal-gains, bundle.html for product-direct)
5. Apply §7 compliance constraints to every nutrition or methodology claim
6. NEVER assert anything beyond FDA structural-functional language

### 10.5 For code changes

Read in order:
1. `CLAUDE.md` (project instructions)
2. `DESIGN.md` (visual system)
3. The file you're about to change
4. `LAUNCH_PHASES.md` (current phase + remaining work)

Then verify with `compliance-grep.sh`, calculator tests, smoke test, and visual smoke (open `/preview` in Claude Code).

---

## 11. Key contacts + URLs

| Resource | URL / Value |
|---|---|
| Live site | https://www.rikathletica.com |
| GitHub | https://github.com/bekzhou8455/rik-athletica.git |
| Founder email | Bek.Zhou@rikathletica.com |
| Founder WhatsApp | +1 (626) 360-9822 / wa.me/16263609822 |
| RDN reviewer | Emily Norman, MS, RDN — CDR reg. #86117608, reviewed May 7, 2026 |
| Stripe Bundle | https://buy.stripe.com/4gM7sN6Wq3cc7T0fZ67Re00 |
| Stripe Sprint 70.3 | https://buy.stripe.com/7sY9AVdkOdQQ3CKbIQ7Re02 |
| Stripe Sprint Full | https://buy.stripe.com/7sY28tfsW2887T07sA7Re03 |
| Stripe Sprint Pro | https://buy.stripe.com/3cI4gB1C65kk1uCdQY7Re04 |
| Stripe Premium | https://buy.stripe.com/00waEZ1C68ww2yG0087Re06 |
| Typeform full intake | https://form.typeform.com/to/XT5Qo0HD |
| Typeform Sprint screening | https://form.typeform.com/to/XdU5A5FQ |
| Typeform check-in (live embed) | data-tf-live="xhtuSNpJ" |
| Rewardful account | 73b07c |
| GA4 property | G-X7LJHZLR4K |

---

## 12. Open questions / decisions deferred

These came up during the session but were not resolved. A new session may need to address them:

1. **Sprint catalog photo for WhatsApp Business catalog** — currently uses an athlete photo (`al-DSC00295.jpg`); a Sprint-specific product photo would be better but doesn't exist yet
2. **Open Graph image** — `og-link-preview-1200x630.jpg` is generated but NOT yet wired into HTML head metadata on any page. When wa.me link or rikathletica.com is shared in iMessage/Slack/Discord, the link preview shows a fallback. Wiring needed: `<meta property="og:image" content="https://www.rikathletica.com/assets/og-image.jpg">` + Twitter card variant on every page.
3. **Verified business badge** — re-apply to Meta after 6 months of activity
4. **Email sequence templates** — Phase 3, in progress now
5. **Race Pack physical packaging design** — Phase 4, in progress now
6. **Premium dashboard URL** — referenced in copy but no design yet
7. **Emily §1.6(b) batch PDF** — must compile all current uses of her quote/credit and email her for written approval BEFORE any deploy that includes her by name. Approval doc lives at `docs/emily-1-6b-approval-YYYY-MM-DD.eml` (not in repo, gitignored).
8. **Premium intake Typeform** — does the current `XT5Qo0HD` intake have a Premium-specific path, or do we need a new Typeform? Check before launching Premium.
9. **Slot counter for Premium** — currently hardcoded "10" in `premium.html`. Phase 2 plan: wire to Stripe webhook → KV/Redis decrement → live count. For Phase 1, manually decrement after each sale.
10. **WhatsApp Business catalog photos** — only 4 of 6 catalog items have product photos; Sprint subtiers (3 of them) reuse the Sprint hero photo, which works but isn't ideal.

---

## 13. This session's key files modified (uncommitted)

```
M  CLAUDE.md                           — Stripe URL table updated, env-var indirection removed
M  README.md                           — Stripe URL table refreshed, redirect URL pattern documented
M  WHATSAPP_DEPLOYMENT.md              — Rewritten for 5 use cases + verification alternative
M  STRIPE_PREMIUM_SETUP.md             — Production status header
M  LAUNCH_PHASES.md                    — Updated cross-refs
M  bundle.html                         — All 6 round-1 + 5 round-2 fixes + WhatsApp footer link
M  sprint.html                         — Marginal-gains copy + video hero + WhatsApp footer link
M  premium.html                        — Built fresh + Stripe link wired + tracking + WhatsApp footer
M  calculator.html                     — Iter-5 token swap (host wrapper) + WhatsApp footer
M  audit.html                          — WhatsApp footer link
M  checkin.html                        — Restyled iter-5 + canonical Typeform embed
M  thank-you.html                      — Restyled iter-5 + GA4 enhanced-ecommerce purchase event
M  index.html                          — WhatsApp footer link
M  assets/calculator-app.js            — Token swap (green→ink, Playfair/Inter→Outfit)
M  .claude/launch.json                 — Removed broken absolute-path config
?? assets/whatsapp/avatar-INK-bg.png   — Production WhatsApp avatar
?? assets/whatsapp/avatar-{WHITE,AMBER}-bg.png — Avatar alternates
?? assets/whatsapp/status-9x16-{premium,bundle}.jpg — WhatsApp Status images
?? assets/whatsapp/catalog-{bundle,sprint,premium,audit}-1080.jpg — Catalog photos
?? assets/whatsapp/og-link-preview-1200x630.jpg — OG image (not yet wired)
?? assets/web/bundle-hero.jpg, premium-hero.jpg, sprint-hero-poster.jpg — Hero images
?? assets/web/pack-{bundle-{open,top,front,back},euphoria-{front,back},refuel-{front,back}}.jpg — 8 packshots
?? assets/video/sprint-hero.mp4         — 12s hero video loop
?? HANDOFF.md                           — This file
```

**No commits made this session.** All changes are uncommitted in worktree. Phase 6 (push + deploy) is when the single coherent commit gets created.

---

## 14. End of handoff

A fresh session loaded with this doc + `DESIGN.md` + `WHATSAPP_DEPLOYMENT.md` + `STRIPE_PREMIUM_SETUP.md` should be able to produce on-brand:

- Email sequences (transactional, lifecycle, marketing) in correct voice + with legal compliance
- Marketing assets (social posts, ad copy, landing-page copy)
- New page sections matching iter-5 visual + voice patterns
- Outbound WhatsApp messages using the labeled SLA model
- Print materials (Race Pack labels, business cards, packaging inserts)
- Founding Cohort welcome PDF and athlete-facing protocol PDFs

Without breaking:
- Backend untouchability (lib/, api/)
- RDN compliance (§1.1, §1.2, §1.6, §2, §4.3, §6.1)
- FDA structural-functional language
- Banned AI vocabulary
- Iter-5 visual tokens
- Stripe payment-link URLs
- WhatsApp tier-routing model

Bek runs deployments via `vercel --prod --yes` from local — never via GitHub auto-deploy.
