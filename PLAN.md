# RIK Athletica — Comprehensive Site Revamp Plan
**Generated**: 2026-05-07 by /plan-eng-review
**Founder**: Bek Zhou
**Sprint context**: Day 9 of locked 14-day launch sprint; Day 14 phase-planning gate = May 13
**Staging folder**: `/Users/bekzhou/Documents/Website Revamp-May2025/`
**Cutover target**: replace deployment source of `rikathletica.com` (Vercel project `rikathletica`) with this folder when verified

---

## Locked architectural decisions (from eng review)

| Ref | Decision | Detail |
|---|---|---|
| D1 | Scope | Full comprehensive revamp of all 6 founder asks. No reduction. |
| D2 | Cutover target | New unified staging folder; goes live to `rikathletica.com` when verified |
| D3 | Codebase composition | UNIFIED: live marketing pages + audit backend in one Vercel project. After cutover, audit lives at `rikathletica.com/audit`; `rik-audit.vercel.app` retired. |
| D4 | CSS strategy | Single shared `/assets/rik.css` for design tokens + utilities. Per-page inline for page-specific overrides only. Updates project CLAUDE.md to reflect new rule. |
| D5 | Calculator backend | UNCHANGED. Frontend-only revamp; existing backend (working or not) stays. Confirmed: "if working fine, don't touch it." |
| D6 | Compliance audit (lawvable) | TODO post-launch only. Lawvable repo not vetted; defer until verified resource available. |
| D7 | Visual regression suite | Skipped at this scale. |
| D8 | SEO audit | TODO post-launch. Baseline meta tags applied during revamp; structured audit deferred. |

## CEO review additions (2026-05-08)

| Ref | Decision | Detail |
|---|---|---|
| C-D1 | Implementation approach | Approach B locked: full revamp first, paid traffic after. Founder accepts foregone-peak-window-revenue cost in exchange for shipping the comprehensive revamp before driving traffic. |
| C-D2 | Mode | SELECTIVE EXPANSION |
| C-D3 | Case study section | DEFERRED to TODOS.md — wait for first paid sale's real testimonial |
| C-D4 | /compare page | CUT (founder pivot D10) — comparison tables relocate inline to /bundle (products) and /sprint (services) |
| C-D5 | Embedded CHO micro-tool | SKIPPED — bundle page sells Layer 2 functional, not CHO math |
| C-D6 | /examples audit showcase | CUT (founder pivot D10) — no public showcase; audit confirmation page is enough |
| C-D7 | /about founder narrative | SKIPPED |
| C-D8 | /coaches affiliate landing | DEFERRED to TODOS.md — wait for 3–5 coach acceptances |
| C-D9 | Paid-ad routing | Paid creative ("you're losing 8–15 minutes") routes to /calculator (not /bundle). Bundle page freed up to sell Layer 2 functional benefits without addressing the CHO-math claim. 14-day plan §A18 paid-ad LANDING destination updates. |
| C-D10 | Audit form abandonment recovery | DEFERRED to TODOS.md. Substitute now: intensive GA4/Kit instrumentation on calculator + audit (see Phase 1.6 below). Build recovery later from real abandonment data. |
| C-D10b | Page set lean-cut | /methodology, /compare, /examples all CUT. Final page set: /, /bundle (with comparison component), /sprint (with comparison component), /premium, /calculator, /audit, /thank-you, /404. |
| C-D10c | Calculator → bundle flow | Calc result page does NOT link directly to Stripe. CTA = "Read about the Bundle →" routing to /bundle. For non-purchasers: secondary CTA "Explore the system" routing to /audit or /. Buyer education before checkout. |

## Sitemap-logic principle (locked, see CEO plan)

| Page | Job | Knowledge tool? |
|---|---|---|
| `/` | Brand intro + value ladder + RD credibility + two-layer methodology section | Static research band |
| `/calculator` | "How much are you losing?" (Track B hook, lead capture) — paid-ad destination | YES (Track B) |
| `/audit` | "Tell me what to do for MY race" (high-intent diagnostic) | YES |
| `/bundle` | Sell Layer 2 functional + bundle-vs-products comparison component | NO |
| `/sprint` | Sell 4-week service + sprint-vs-services comparison component | NO |
| `/premium` | Sell 1:1 RDN-overseen service | NO |

Knowledge tools live on home/calculator/audit. Product pages sell products + carry a comparison component for the relevant category. Methodology narrative + RD statement PDF live as a section on `/` and as a link from RDN-cited pages.

## New Phase 1.6 — GA4 + Kit instrumentation

Add to Phase 1 deliverables:

- **Calculator page (`/calculator`)** — fire GA4 events:
  - `page_view` (default)
  - `calc_field_focus` per input (race_distance, body_weight, etc.)
  - `calc_submit` on form submission
  - `calc_result_view` when result renders
  - `calc_cta_bundle_click` on "Read about the Bundle" button
  - `calc_cta_audit_click` on "Explore the system" button
  - `scroll_depth_25/50/75/100`
  - `exit` (timer + beforeunload composite)
  - Kit tag fire: `EVENT_calc_completed` with email if captured

- **Audit page (`/audit`)** — fire GA4 events:
  - `page_view` (default)
  - `audit_step_view` with step number (1–10)
  - `audit_field_focus` per field
  - `audit_step_advance` with step number
  - `audit_step_back` with step number
  - `audit_submit` on final submission
  - `audit_abandon_at_step_N` (fired on beforeunload/visibility-change with current step)
  - `confirmation_view` after submission redirect
  - Kit tag fire: `EVENT_audit_started` (email captured)
  - Kit tag fire: `EVENT_audit_submitted` (full submission)

- **Bundle, Sprint, Premium, Home pages** — basic events:
  - `page_view`, `scroll_depth_25/50/75/100`, `cta_click` per primary CTA, `exit`

- **Tagging implementation** — add a single `/assets/rik-analytics.js` shared file with helper functions; load on every page; called from inline event handlers. No third-party tag manager (avoids GTM complexity).

- **Verification** — open GA4 DebugView, walk every page, confirm every event fires with correct payload. Document in `/docs/analytics-event-spec.md`.

## Architecture defaults applied (without explicit fork)

| Ref | Default | Rationale |
|---|---|---|
| #4 | Asset CDN: jsdelivr (`bekzhou8455/rik-athletica@main`) for product/lifestyle/ingredient (curated subset of ~30 from 389-file bank). `/assets/` for site-internal: `rik.css`, `emily-norman-rdn.jpg`, `emily-signature.png`, `rd-review-statement.pdf` | §5.3: Citation must be removable within 7 days of revocation — easier from `/assets/` than from public CDN git history |
| #5 | Voice synthesis: "Hormozi mechanics, RIK surface" — Hormozi structural pattern (dream outcome × likelihood × time × effort × risk reversal), RIK voice (no exclamation points, no hype, factual specificity, "supports / may help" never "guarantees") | Hormozi loud-numerical style and brand "direct, prescriptive, warm" voice conflict on emphasis |
| #6 | Methodology page: new at `/methodology`, in main nav | Required by §1.2(a) "dedicated methodology page" + §1.6(f) full statement linkable adjacent to citation excerpts |
| #8 | Email surface discovery: pre-Phase 5 inventory pass across `/lib/email-alerts.js` + Kit dashboard | Discovery, not a fork |
| #9 | §1.6(b) approval: single batch email to Emily with all 5 banner placement screenshots in one PDF | Serial round-trips would take a week; batch = one round-trip |
| #10 | §1.6(e) swap-out procedure documented in `rik.css` header comment | Required: implementation within 7 days of receiving new file |

---

## Compliance constraints (read every time you edit a permitted page)

**Permitted Citation locations (§1.2)**: methodology page, bundle, calculator + calculator results, Sprint, Premium, Audit PDF deliverable, business decks, investor materials, opt-in email. **NOT homepage** (homepage gets generic "RD-reviewed methodology" — no name).

**Locked §1.1 wording (signed PDF, exact)**:
> Methodology reviewed by Emily Haydon Norman, RDN — Commission on Dietetic Registration (USA), reg. #86117608, May 2026.

**§2 FTC adjacent (must appear adjacent + visible without user action — not in footer, not hover-only, not pop-up)**:
> Paid independent methodology review. Opinions are Reviewer's own.

**§4.3 Scope clarification (must appear adjacent to citation on every page where Citation appears)**:
> This review reflects a methodology-level assessment. It does not constitute medical advice, individualized nutrition counseling, or endorsement of any specific health, performance, or race outcome. RIK is not a healthcare provider. Reviewer does not provide continuing supervision of RIK's protocol updates.

**§1.6 image rules**:
- Headshot ≤320px wide. No creative crop. No filter. No color-correct beyond standard sizing/optimization. No compositing.
- Layout: "professional review banner" only — headshot adjacent to written statement (or approved excerpt) with signature image and credentials. Anything else needs separate approval.
- §1.6(b): **Reviewer must approve placement, dimensions, and crop in writing BEFORE going live.** Workflow: build → screenshot → email Emily a single batch PDF → wait for written reply → deploy.
- §1.6(f): If excerpt-only, full statement must be linkable adjacent (verbatim, attributed).

**§1.5 excluded uses** (don't put RDN banner on these): paid ads creative; performance-marketing campaigns; testimonial-format content; founder-authored social posts naming her in promotional context; cold outbound; individualized Sprint customer protocol deliverables (Week Grid, Session Protocol, Performance Report).

**§6.1**: any change to CHO/sodium/hydration/caffeine targets, gut-adaptation progression, recovery placement, pre-session meal protocol, or race-week tapering rules triggers 14-day re-review obligation. → DON'T edit `lib/methodology.js` without flagging.

**FDA structural-functional claim rules**:
- USE: supports, designed to, may help, tends to
- AVOID: guarantees, proven to, ensures, cures, treats, diagnoses, prevents disease
- Every nutrition claim with † on first use, single FDA disclaimer block per page

---

## Phased execution

### Phase 0 — Bootstrap (Day 9, ~3h)
- [ ] Create `/Users/bekzhou/Documents/Website Revamp-May2025/` (DONE, this file is here)
- [ ] Copy live codebase from `/Users/bekzhou/Documents/Claude Code - Gstack/` → root of staging
- [ ] Pull audit backend from `/Users/bekzhou/Downloads/RIK_Site_Revamp/site/`:
    - [ ] `api/audit/*` (submit, approve, render)
    - [ ] `api/admin/*` (queue, draft)
    - [ ] `api/stripe-webhook.js`
    - [ ] `api/cron/daily-sweep.js`
    - [ ] `lib/methodology.js`, `lib/routing.js`, `lib/render.js`, `lib/ai-drafter.js`, `lib/db.js`, `lib/kit.js`, `lib/email-alerts.js`
    - [ ] `admin/audit-queue.html`
    - [ ] `tests/routing.test.js`
    - [ ] `scripts/migrate.js`
- [ ] Reconcile `vercel.json` (cron + `/a/:slug` rewrite + audit subroute)
- [ ] Reconcile `package.json` (dependencies from both sides)
- [ ] Document required env vars in `.env.example` (combine both)
- [ ] Initialize git repo, first commit
- [ ] Update CLAUDE.md to reflect new rules (shared CSS allowed, frontend-only revamp boundary, etc.)
- [ ] Wire `serve.ts` for local preview
- [ ] Smoke test: `bun serve.ts`, navigate every page, confirm no 500s

### Phase 1 — Shared infrastructure (Day 9–10, ~6h)
- [ ] Curate ~30 images from `/Documents/RIK_Visual_Assets/`. Selection brief:
    - Hero × 7 (one per page, athlete-in-motion preferred from Ariana Luterman/web-optimized/)
    - Lifestyle × 5 (athlete usage scenarios)
    - Ingredient × 9 (one per ingredient: monohydrate, DE6/DE19, electrolytes matrix, cherry, curcumin, glutamine, BCAA, matcha)
    - Product × 5 (PACKSHOT subset: Refuel front/back, Euphoria front/back, bundle composite)
    - Athlete portrait × 3 (Ariana, hero shots)
    - Misc × 1 (open slot)
- [ ] Pre-convert all curated images to WebP @ q80, target ≤200KB each, hero ≤400KB
- [ ] Push WebP set to `bekzhou8455/rik-athletica@main/assets/web/`
- [ ] Build `/assets/rik.css`:
    - [ ] Design tokens from design system file (colors, type scale, spacing, radii, shadows, motion)
    - [ ] Reset / base typography
    - [ ] Reusable component classes: `.btn`, `.btn-primary`, `.btn-secondary`, `.card`, `.cred-badge`, `.trust-row`, `.eyebrow-pill`, `.rdn-banner`, `.rdn-banner-grid`, `.scope-clarification`, `.ftc-disclosure`, `.dagger-disclaimer`, `.cta-bar`, `.section`, `.container`, `.grid-N`, etc.
    - [ ] §1.6(e) swap-out procedure documented as header comment
- [ ] Place site-internal assets in staging `/assets/`:
    - [ ] `emily-norman-rdn.jpg` — single canonical 320px-wide JPG, q85
    - [ ] `emily-signature.png` — transparent PNG, ~280px wide
    - [ ] `rd-review-statement.pdf` — Emily's full signed statement (linked from every page that excerpts it)
- [ ] Write `/scripts/compliance-grep.sh` — scans HTML + email templates for prohibited words; exits non-zero on hit
- [ ] Write `/scripts/form-action-baseline.sh` — captures all `<form action=...>` values to lockfile pre-edit
- [ ] Write `/scripts/stripe-link-hot-test.sh` — curl-HEADs every Stripe Payment Link, asserts 200/302
- [ ] Write `/scripts/no-touch-check.sh` — git pre-commit hook; fails if `lib/methodology.js`, `lib/routing.js`, `lib/render.js`, `lib/ai-drafter.js`, `lib/db.js`, or `/api/*` shows in staged diff (unless `ALLOW_BACKEND_TOUCH=1` env var set)

### Phase 2 — Per-page rebuild (Day 10–13, ~12h spread across pages, sequential by founder approval)
Each lane: copy rewrite + visual rewrap + RDN banner per §1.1/§1.6/§4.3 + §2 FTC adjacent + dagger-footnoted claims + form-action regression check + screenshot-for-Emily-PDF.

Order (priority is paid-ad-destination first). Final page set per CEO C-D10b:

- [ ] **Lane A: bundle.html** — paid-ad destination NO LONGER (paid routes to /calculator per C-D9). Sells **Layer 2 functional** (Euphoria + Refuel: focus, recovery, plant caffeine). Includes embedded **bundle-vs-products comparison component** (Track A safe). RDN banner per §1.2 mandatory.
- [ ] **Lane B: audit.html** — Level 0 entry. RDN banner mandatory. Phase 1.6 instrumentation per CEO C-D10. NO form-recovery work (deferred to TODOS).
- [ ] **Lane C: calculator.html** — NEW PAID-AD DESTINATION (per C-D9). Instrumented per Phase 1.6. CTA flow REPLACED (per C-D10c): result page does NOT link directly to Stripe — primary CTA "Read about the Bundle →" routes to /bundle; secondary CTA "Explore the system" routes to /audit or /. Backend untouched.
- [ ] **~~Lane D: methodology.html~~** ❌ CUT (per C-D10b). RD review statement = PDF link from /assets/rd-review-statement.pdf adjacent to citation excerpts. Two-layer methodology narrative collapses into a section on /home and /bundle.
- [ ] **Lane E: sprint.html** — RDN banner mandatory. Includes embedded **sprint-vs-services comparison component** (Track A safe).
- [ ] **Lane F: premium.html** — RDN banner mandatory.
- [ ] **Lane G: index.html** — NO Emily citation by name (homepage not in §1.2 list); generic "RD-reviewed methodology" trust line. Two-layer methodology narrative section here.
- [ ] **Lane H: 404.html, thank-you.html, checkin.html** — light copy + visual pass; no RDN content.
- [ ] **~~Lane I: case study section~~** ❌ DEFERRED to TODOS (per C-D3). Build after first paid Sprint customer's race result is harvestable.

Cut from earlier eng-review proposals: /methodology, /compare, /examples (founder pivot to lean — comparison content relocates inline as components on /bundle and /sprint per C-D10b).

For each lane:
1. Read current page; identify what stays (Stripe links, form actions, Typeform URLs, anchor IDs).
2. Draft new copy in Hormozi-mechanics-RIK-surface voice.
3. Apply visual rewrap using `rik.css` + curated imagery.
4. Run `/scripts/compliance-grep.sh` on the page. Must pass.
5. Run `/scripts/form-action-baseline.sh diff` on the page. Diff must be empty.
6. Generate desktop + mobile screenshots via preview tool.
7. Show founder; iterate to approval.
8. Capture screenshots for Emily's batch approval PDF.
9. Move to next lane.

### Phase 3 — Email sequences (Day 13–14, ~5h)
- [ ] Inventory all email surfaces:
    - [ ] `/lib/email-alerts.js` (audit delivery, admin alerts, Stripe-conversion notification)
    - [ ] Kit lifecycle templates (E0 calculator nurture, E1–E3, audit sequence, intake confirmations) — these live in Kit dashboard, not in repo
    - [ ] Any Typeform-triggered transactional sends
- [ ] Rewrite each in voice; add visual treatment for HTML versions
- [ ] Run compliance grep on all rewritten copy
- [ ] Send test sends to founder for visual verification
- [ ] Update Kit templates manually (Kit UI, since they live outside repo) — document procedure in `/docs/kit-template-update-procedure.md`

### Phase 4 — Compliance pass + Emily approval (Day 14, ~3h)
- [ ] Final pass: `/scripts/compliance-grep.sh` across full staging codebase
- [ ] Final pass: every Citation page has §1.1 + §2 FTC + §4.3 scope clarification adjacent
- [ ] Final pass: every nutrition claim has †, single disclaimer block per page
- [ ] Generate consolidated Emily-approval PDF: cover sheet + 5 banner screenshots (bundle, sprint, premium, calculator, audit) with dimensions noted per page
- [ ] Founder emails Emily with the PDF; awaits written §1.6(b) approval
- [ ] **GATE: no deploy until Emily writes back**

### Phase 5 — Cutover (Day 14+, after Emily approval, ~2h)
- [ ] Final founder approval per page (review loop)
- [ ] Migrate env vars from `rikathletica` Vercel project to staging-source project (or repoint existing `rikathletica` project at the new staging folder — preferred)
- [ ] Deploy to Vercel preview, full E2E smoke test:
    - [ ] All pages render
    - [ ] All Stripe links resolve
    - [ ] Audit form submits to `/api/audit/submit`, entry appears in admin queue
    - [ ] Calculator submits without error (or with the same silent failure as today — confirmed unchanged)
    - [ ] Cron `/api/cron/daily-sweep` reachable
    - [ ] Stripe webhook fires on test checkout
    - [ ] Existing approved audit at `/a/[slug]` still renders
- [ ] Promote preview to production (`vercel --prod --yes`)
- [ ] Verify `www.rikathletica.com` serves new build
- [ ] Update Kit automations to reference new copy where dynamic content is templated
- [ ] Tear down `rik-audit.vercel.app` once unified site is stable for 48h

### Phase 6 — Post-cutover (Day 15+)
- [ ] Run `/scripts/stripe-link-hot-test.sh` daily for 1 week
- [ ] Monitor GA4 + Stripe for any conversion-rate regression
- [ ] Address any §6.1 re-review trigger if methodology touches were unavoidable
- [ ] Begin TODOS items below

---

## TODOs (post-launch)

1. **Verified third-party FDA/FTC compliance audit** (NOT lawvable until vetted). Engage a verified resource for a structured supplement-marketing legal review.
2. **SEO audit + structured meta tags + JSON-LD (Product, Organization)**. Verify post-cutover that ranking keywords didn't drop. Add Product / Organization JSON-LD where missing.
3. **Ariana Luterman lifestyle photoshoot release-form check**. Confirm written release covers all uses planned in this revamp.
4. **Calculator backend status** — confirm at Phase 0 whether live codebase's "server-side calculator" (commit ccd25ac) covers the form submission contract. If dead spots remain, address as part of Phase 0.
5. **CA Prop 65 disclosure** (only if shipping to California in supplement form factor). Verify state-specific supplement-disclosure requirements.
6. **GDPR + ADA** post-launch review if EU traffic or accessibility complaints emerge.
7. **Case study section (CEO C-D3, D11)** — harvest from first paid Sprint customer post-race. Verifiable race result + photo permission + written quote + FTC "compensated athlete" disclosure if applicable. Placement: `/bundle` + audit confirmation page.
8. **Audit form abandonment recovery (CEO C-D10, D13)** — build after Phase 1.6 instrumentation produces 50–100 audit submissions with measured per-step drop-off. Decide between split-intake (email at step 1, rest at step 2) or sessionStorage-save + recovery email — based on actual drop-off curve.
9. **Programmatic SEO content push (CEO Section 10)** — `/vs-pf-h`, `/vs-maurten`, `/vs-skratch` as Track-A-safe pages. Plus city × distance × season pages. Content-strategy phase post-launch.
10. **Methodology v3.1 PDF lead-magnet** (lower-priority CEO option) — gated PDF download in exchange for email. Authority + nurture entry. Build when content-strategy phase activates.

---

## Critical regression gates (deploy-blocker checklist)

Before any production deploy:
- [ ] `/scripts/compliance-grep.sh` exits 0
- [ ] `/scripts/form-action-baseline.sh diff` shows no diff
- [ ] `/scripts/stripe-link-hot-test.sh` exits 0
- [ ] `/scripts/no-touch-check.sh` exits 0 (or `ALLOW_BACKEND_TOUCH=1` is explicitly set + reasoned in commit message)
- [ ] Emily's §1.6(b) written approval is in `/docs/emily-1-6b-approval-2026-05-XX.eml` (or PDF)
- [ ] Per-page founder review approvals captured in commit history
- [ ] Stripe Payment Link IDs match env var values

---

## Design specification (from /plan-design-review 2026-05-08)

### Tokens (canonical, lock in `/assets/rik.css`)

```css
:root {
  /* Color */
  --sand: #f6f5f4;
  --off-black: #0a0a0a;
  --green: #2D5A3D;
  --green-light: #4ade80;
  --muted: #888;
  --muted-2: #999;
  --border: rgba(10,10,10,0.08);
  --bg: var(--sand);
  --fg: var(--off-black);
  --accent: var(--green);
  --text-muted: var(--muted);

  /* Type */
  --font-sans: 'Plus Jakarta Sans', -apple-system, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Type scale (px / line-height) */
  --t-display: 64px; --lh-display: 1.05;  /* hero */
  --t-h1: 48px;       --lh-h1: 1.1;
  --t-h2: 32px;       --lh-h2: 1.2;
  --t-h3: 22px;       --lh-h3: 1.3;
  --t-body: 16px;     --lh-body: 1.6;
  --t-small: 14px;    --lh-small: 1.5;
  --t-caption: 12px;  --lh-caption: 1.4;

  /* Mobile type adjustments — apply at < 640px */
  /* --t-display becomes 40px; --t-h1 becomes 32px; --t-h2 becomes 24px */

  /* Spacing (8px scale, named tokens) */
  --s-1: 8px; --s-2: 16px; --s-3: 24px; --s-4: 32px;
  --s-5: 48px; --s-6: 64px; --s-7: 96px; --s-8: 144px;

  /* Radius */
  --r-card: 20px;
  --r-btn: 36px;     /* pill button */
  --r-img: 8px;      /* product photo */
  --r-img-hero: 0;   /* hero is full-bleed */

  /* Motion */
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --motion-fast: 150ms;
  --motion-base: 300ms;
  --motion-slow: 600ms;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; }
}
```

### Type scale + headings rule

- One `<h1>` per page (matches the visual <hero headline>).
- `<h2>` for section titles. `<h3>` for sub-sections.
- Body 16px minimum (WCAG AA). Captions 12px allowed for legal/disclaimer copy only.
- Numbers and technical values (g/hr, minutes, mg sodium): `font-family: var(--font-mono)`, weight 400, full-stops not commas.

### Button hierarchy

| Tier | Visual | Use |
|---|---|---|
| Primary | Sand text on RIK green pill (radius 36px), 12/24px padding, hover lift -2px + shadow | One per section max. Money-action CTAs ("Get the Bundle", "Submit Audit") |
| Secondary | RIK green text on sand, 1.5px green border, pill | Alternative actions ("Free Audit", "Read about the Bundle") |
| Tertiary | RIK green underlined text, no background | Inline CTAs ("see methodology", "compare", read-mores) |

Every button: `font-family: var(--font-sans); font-weight: 600; letter-spacing: 0.01em;`. Touch target 44x44px minimum.

### Card-vs-flat default

- **Flat sections by default.** Cards are decorative debt unless the card IS the interaction.
- **Use cards** for: product gallery items (clickable), comparison-table rows on mobile, FAQ items (collapsible), trust-badge clusters where each badge is interactive.
- **Don't use cards** for: trust-row badges (small text + 1px border is enough), section dividers, hero composition, methodology blocks, footer.
- Card spec: `background: white; border: 1px solid var(--border); border-radius: var(--r-card); padding: var(--s-3);`. No shadows by default. Hover: subtle lift + shadow allowed.

### Motion philosophy (per D4 — RICH INTERACTIVE)

- **Entrance**: section fade-in + 12px translate-up on scroll-into-view, 600ms `var(--ease)`. One-time per session.
- **Hover (interactive elements)**: 200ms transform. Buttons lift -2px; cards lift -4px + shadow appears; links underline-grow.
- **Scroll-linked**: hero parallax (background image 0.3x scroll) on /home + /bundle only. None elsewhere.
- **Micro-interactions**: input focus ring fade-in, form-step transitions, success-state expand.
- **Always**: respect `prefers-reduced-motion` — disable all motion when set.

### Navigation (per D5)

- Sticky header, 56px tall, sand background with 1px bottom border.
- Logo left, nav links center-or-right, primary CTA right (pill button).
- Mobile (<640px): logo left, hamburger top-right; tap → full-screen menu with backdrop blur.
- Active page link: RIK green color + bottom 2px underline.
- Hover: muted underline-grow effect.
- Nav link padding: `19px 0` (existing rule from CLAUDE.md preserved).

### Photography ratio (per D6 — between balanced and heavy)

- **2–3 lifestyle shots per page.** Hero shot + 1-2 contextual mid-page shots.
- Source: Ariana Luterman athlete shoot (`/Documents/RIK_Visual_Assets/Ariana Luterman/web-optimized/`).
- **Product photography**: PACKSHOT subset (~5 hero shots) on /bundle, /sprint, /premium gallery sections.
- **Ingredient photography**: 9 ingredients × 1 close-up shot, used on /home methodology section + /bundle Layer 2 section.
- **Image treatment**: hero = full-bleed (radius 0). Mid-page contextual = rounded 8px. Product gallery = soft-shadow + radius 8px.
- **Aspect ratios**: hero 16:9 desktop / 4:5 mobile. Mid-page 3:2 default. Product 1:1.
- **Pre-conversion**: all images WebP @ q80, ≤200KB each, hero ≤400KB. Push curated ~30-40 images to `bekzhou8455/rik-athletica@main/assets/web/` jsdelivr.

### Responsive breakpoints

- Default: `< 640px` (mobile-first)
- `sm: 640px` — large phones
- `md: 768px` — tablet portrait
- `lg: 1024px` — small laptop
- `xl: 1280px` — laptop
- `2xl: 1440px` — desktop
- Mobile type scale reductions: display 40px, h1 32px, h2 24px (others unchanged)

### Touch targets + accessibility (per D3 — WCAG 2.1 AA)

- Minimum touch target: 44x44px (Apple HIG / WCAG 2.5.5)
- Body text ≥ 16px; muted gray only on non-essential text (never on body copy that carries meaning)
- Color contrast: body 4.5:1 minimum; large text 3:1 minimum
- Focus ring: 2px solid `var(--green)`, 2px offset, never removed
- Skip-to-main-content link: visually hidden until focused
- Semantic HTML: `<nav>`, `<main>`, `<article>`, `<section>` — required
- Heading hierarchy: strict, no skipping levels
- All interactive elements keyboard-operable (Tab, Enter, Space)
- All `<img>` with alt text per CLAUDE.md policy
- Form labels visible (no placeholder-as-label)
- `prefers-reduced-motion: reduce` disables all motion

### Per-page information architecture (locked)

```
/home (homepage):
  1. Sticky nav (56px, RD-trust-line micro under nav)
  2. Hero — eyebrow pill + h1 brand statement + 1-line subhead + dual CTA + hero lifestyle photo (Ariana)
  3. Two-layer methodology section — Layer 1 (Carbs+Electrolytes) + Layer 2 (Functional) side-by-side panels with ingredient photos
  4. Trust row — SGS / GMP / FDA-Registered / Made in Malaysia / RD-reviewed methodology (no Emily by name)
  5. Product gallery — Euphoria + Refuel real product shots
  6. Calculator preview ("How many minutes are you leaving on the course?" → /calculator)
  7. Free Audit CTA block — large invitation
  8. FAQ — 5 high-friction questions
  9. Footer — FDA disclaimer

/bundle (Layer 2 sale, paid-ad NOT destination per C-D9):
  1. Sticky nav
  2. Hero (preserved Z.3) — eyebrow + locked headline + 1-line sub + dual CTA + lifestyle hero
  3. Stats row (preserved 4-stat grid)
  4. Product gallery (preserved switcher Refuel/Euphoria)
  5. Bundle-vs-products comparison component (Track A safe, table format)
  6. Layer 2 functional value section — focus / recovery / plant caffeine, with ingredient photography
  7. RDN trust banner (full per §1.6 — name, headshot, statement excerpt, signature, scope clarification, FTC adjacent)
  8. 30-day guarantee + scarcity + first-50 free shipping block
  9. FAQ
  10. Footer

/sprint (4-week service):
  1. Sticky nav
  2. Hero — service offer ("Race your next 70.3 with a fueling protocol designed for your race"), lifestyle hero
  3. What's included — Training Box + Race Pack two-box delivery
  4. Sprint-vs-services comparison component (Track A safe)
  5. RDN trust banner
  6. Stripe checkout block — Full Ironman $649 / 70.3 $549 (env-driven URLs)
  7. FAQ
  8. Footer

/premium (1:1 service):
  1. Sticky nav
  2. Hero — Founding Cohort framing per Z.4, lifestyle hero
  3. What's included
  4. RDN trust banner
  5. Pricing + scarcity (10-slot countdown to May 18 deadline)
  6. FAQ
  7. Footer

/calculator (PAID-AD DESTINATION per C-D9):
  1. Sticky nav
  2. Hero — "How many minutes are you leaving on the race course?" (one sentence, big)
  3. Calculator widget (preserved form, instrumented per Phase 1.6)
  4. Result panel (post-submit) — minutes-lost number in JetBrains Mono + Track B disclaimer
  5. Result CTAs — "Read about the Bundle →" primary; "Explore the system" secondary (per C-D10c)
  6. RDN trust banner
  7. Trust row
  8. Footer

/audit (Level 0 entry, instrumented per Phase 1.6):
  1. Sticky nav
  2. Hero — "Get a personalized 4-page fueling protocol. Free."
  3. Form (10 steps, progress dots top, instrumented)
  4. Confirmation (post-submit) — "Bek reviews within 48h"
  5. RDN trust banner
  6. FAQ — 3 high-friction
  7. Footer

/thank-you:
  1. Confirmation
  2. Timeline of next steps
  3. Optional secondary CTA ("while you wait, take the audit")
  4. Footer

/404:
  1. Branded warm 404 (no exclamation)
  2. Helpful links back to /, /audit, /bundle
  3. Footer
```

### Interaction state matrix (locked)

```
CALCULATOR:
  Loading    → spinner inline next to "Calculate" button
  Empty (init) → "Enter your race + body data to see your fueling target."
  Partial    → "Add race distance to calculate."
  Error      → per-field red border + helper, server error → "Try again" with retry
  Success    → result panel reveal (height-expand 300ms), big number in mono, dual CTAs

AUDIT FORM:
  Loading    → per-step spinner replacing arrow
  Empty (init) → step 1 with progress dots + welcome copy
  Partial    → per-field validation on advance
  Error      → red helper text, retry preserves formState
  Success    → redirect to confirmation page

BUNDLE / SPRINT / PREMIUM CTAs:
  Loading    → "Opening checkout…" + spinner
  Error      → fallback inline message + retry

ASSET LOADING:
  Image      → loading="lazy" below-fold, preload hero in <head>
  Image error → fallback to sand block with alt text rendered
  RDN headshot fail → hide entire RDN banner container (fail closed, never show broken citation)
```

### Anti-AI-slop blacklist (must avoid)

1. ❌ 3-column feature grid as primary section
2. ❌ Icons in colored circles repeating across rows
3. ❌ Purple/violet/indigo gradients
4. ❌ Center-align everything
5. ❌ Uniform large border-radius on every element
6. ❌ Decorative blobs / floating circles / wavy SVG dividers
7. ❌ Emoji as design elements
8. ❌ Colored left-border on cards
9. ❌ Generic hero copy ("Welcome to RIK", "Unlock the power of...")
10. ❌ Cookie-cutter section rhythm (hero → 3-features → testimonial → CTA, every page same)
11. ❌ system-ui or -apple-system as PRIMARY display font
12. ❌ SaaS-rounded-everything aesthetic

Aspirational reference spectrum: more photographic than PF&H, more numerical than Skratch, more prescriptive than Maurten. Closer to The Atlantic feature article + Apple product page than to Linear's marketing site.

### Phase 0 deliverable additions (from design review)

- Extract design tokens from `/Downloads/Design system file-RIK ATHLETICA.html` into in-repo `DESIGN.md` as the canonical source of truth.
- Create `/assets/rik.css` with the token block above + base typography reset + reusable component classes (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-tertiary`, `.card`, `.eyebrow-pill`, `.cred-badge`, `.trust-row`, `.section`, `.container`, `.rdn-banner`, `.scope-clarification`, `.ftc-disclosure`).
- §1.6(e) swap-out procedure as a header comment in `rik.css` (already in eng-review plan).

## Iter-4 design specification (from /plan-design-review iter-4, 2026-05-08, founder-direction reset)

Supersedes the earlier iter-1 through iter-3 design specification above. The previous spec produced a build the founder rejected as "AI-ish and plain." This iter-4 spec is the implementation brief for the next round of code edits.

### What changed from prior iterations

**Reference brand reset**: was "sanalabs editorial polish layer." Is now: MyHealthPrac (overlay-dominant) + Sana Learn (whitespace + comparison). Bek's words: "the icons+text overlay design on top of high-contrast HD picture is epic."

**Visual hierarchy inversion**: was "sand/white dominates, dark used sparingly." Is now: "dark photo overlays dominate, sand/white is the interlude between them." Every page has 3–5 dark overlay sections.

**Section count drop**: home goes from 10+ sections → 5–7. Bundle 8 → 6–7. Sprint, premium similar trim.

### Five locked iter-4 design decisions

| Ref | Decision | Locked choice |
|---|---|---|
| Iter4-D1 | Overlay dominance | DOMINANT (3-5 per page); sand/white = interlude |
| Iter4-D2 | Icon system | Lucide line icons, 1.5px stroke, 24px default, inline SVG, MIT license |
| Iter4-D3 | Hero photography | Ariana Luterman shoot dominant + ingredient/product accents |
| Iter4-D4 | RDN trust banner visual | Editorial card on sand interlude (visual contrast as design) |
| Iter4-D5 | Stats row fate | Folds into ONE dark overlay "numbers" section (was 4-card grid) |

### Per-page section rhythm (locked)

```
HOMEPAGE (5–7 sections, was 10+ pre-iter-4):
  [DARK]  hero overlay — brand mission as 5–7 word statement + 1-line body
  [LIGHT] sand — value-ladder router (KEPT but redesigned simpler, less SaaS)
  [DARK]  3 sequential overlays — "Three things RIK does"
  [LIGHT] sand — RDN trust banner (editorial card, no Emily by name on home per §1.2 — generic 'RD-reviewed methodology' line only)
  [DARK]  stats overlay — research credibility (replaces old stats row)
  [LIGHT] sand — calculator teaser + audit CTA (combined, not two separate sections)
  [DARK]  closing overlay — final CTA

BUNDLE (6–7 sections):
  [DARK]  hero overlay — Layer 2 functional positioning (not CHO math)
  [LIGHT] sand — comparison table (vs other gels) — KEPT
  [DARK]  "Three moments" — 3 sequential overlays (pre-session / mid / post-session)
  [LIGHT] sand — ingredient scroller (KEPT but reconsider treatment)
  [LIGHT] sand — RDN trust banner (editorial card, full §1.6 named citation)
  [DARK]  closing overlay — "Reserve the Bundle" + WhatsApp + audit fallback

SPRINT (7 sections):
  [DARK]  hero overlay — service positioning
  [LIGHT] sand — what's included (Training Box + Race Pack)
  [DARK]  process overlay — revision loop ("we adjust until your gut adapts")
  [LIGHT] sand — comparison (vs coaching) — KEPT
  [LIGHT] sand — RDN trust banner (editorial card)
  [DARK]  pricing overlay — tier selector ($569 / $659 / $899)
  [DARK]  closing overlay — start (Typeform screening) + WhatsApp

PREMIUM (7 sections):
  [DARK]  hero overlay — Founding Cohort positioning
  [LIGHT] sand — what's included (6 cards, the locked Z.4 list)
  [DARK]  bonus stack overlay — $1,246 stacked, 8 bonuses
  [LIGHT] sand — concierge band + guarantee
  [LIGHT] sand — RDN trust banner (editorial card)
  [DARK]  scarcity overlay — countdown to May 18
  [DARK]  closing overlay — reserve + WhatsApp pre-purchase ask

AUDIT (mostly form, light overlay treatment):
  [DARK]  intro overlay — "Find the minutes you're losing" framing (replaces existing intro card)
  [LIGHT] form (10 steps, intact — backend unchanged per scope rule)
  [LIGHT] confirmation + RDN trust banner

CALCULATOR (preserved core, lighter overlay treatment):
  [LIGHT] React app (intact, fast — esbuild precompile preserved)
  [DARK]  result overlay — "What this means" interpretation
  [DARK]  closing overlay — "Read about the bundle" + audit CTA
  [LIGHT] RDN trust banner (compact)
```

### Sections retiring in iter-4

| Retiring | Why | Where it lived |
|---|---|---|
| `.router-option` (4 visual options + photo + arrow + result panel) | Reads SaaS-template; founder critique | /home |
| `.photo-block` (asymmetric two-column photo+text) | Too text-heavy; replaced by overlays | /home methodology section |
| `.quote-callout` (gradient bottom + quote) | Wrong version of MyHealthPrac pattern | /home, /bundle, /sprint, /premium |
| 4-card stats row (template) | Folded into single dark overlay | /home, /bundle, /premium |
| `.fallback-cta` text-heavy strip | Rebuilt as overlay or merged into closing CTA | /bundle, /sprint |
| Three Moments as light cards | Becomes 3 sequential dark overlays | /bundle |

### Sections keeping (with treatment polish)

| Keeping | Polish |
|---|---|
| Comparison tables on /bundle + /sprint | Tighter row count, monochrome icons per row, no green-tint backgrounds |
| RDN trust banner | Stays as editorial card on sand interlude; refine type hierarchy |
| Ingredient scroller | KEPT as light-section element. Re-evaluate during build whether it stays as scroller or becomes a 5-on-5 ingredient grid |
| Bundle hero (Z.3 locked copy) | Copy preserved verbatim. Treatment becomes overlay (full-bleed photo + Z.3 headline as overlay text) |
| Premium hero (Z.4 locked copy) | Same — Z.4 copy preserved, layout becomes overlay |

### New patterns to build in `/assets/rik.css`

| Selector | Purpose |
|---|---|
| `.overlay-section` | Primary mechanic (full-bleed photo + scrim + content) |
| `.overlay-section.center` | Centered content variant |
| `.overlay-section.compact` | Smaller surface variant (56vh) |
| `.overlay-bg`, `.overlay-scrim`, `.overlay-content` | Internal structure |
| `.overlay-icon` | Lucide icon white stroke 1.5px |
| `.overlay-headline` | clamp(36px, 5vw, 72px) weight 300 white, max-width 14ch |
| `.overlay-body` | 17px line-height 1.55 rgba(white, 0.85) max-width 56ch |
| `.overlay-eyebrow` | Mono caption white 60% opacity |
| `.overlay-stats-grid` | Asymmetric (NOT 4-equal-columns) stats layout |
| `.stat-num`, `.stat-cap` | JetBrains Mono number + caption |

### Photography curation rule

- Each page picks ONE canonical hero photo (locked in DESIGN.md table).
- Each overlay section uses a DIFFERENT shot (no photo repeats anywhere across the site — rule enforced).
- Pool: `~/Documents/RIK_Visual_Assets/Ariana Luterman/web-optimized/` (50+ shots).
- Pre-darken the bottom half of every hero photo before compression. Don't rely solely on CSS scrim.

### Implementation order (iter-4 build, after this review locks)

```
Iter-4.1  rik.css — add .overlay-section + variants + icon styling (~30 min)
Iter-4.2  Curate + compress 12-15 fresh Ariana shots for overlays (~30 min)
Iter-4.3  Download Lucide icon SVGs to /assets/icons/ (16 icons) (~15 min)
Iter-4.4  Rebuild /home — 6 sections per new IA (~1 hour)
Iter-4.5  Rebuild /bundle — 7 sections per new IA (~1 hour)
Iter-4.6  Rebuild /sprint — 7 sections per new IA (~1 hour)
Iter-4.7  Rebuild /premium — 7 sections per new IA (~1 hour)
Iter-4.8  /audit + /calculator light treatment (~30 min)
Iter-4.9  Mobile + WCAG AA contrast verification (~30 min)
TOTAL: ~6-7 hours focused implementation
```

### What this iter-4 spec does NOT change (still locked)

- Compliance content: locked §1.1 RDN citation, §4.3 scope clarification, §2 FTC adjacent
- §1.2 boundary: NO Emily Haydon Norman by name on /home
- §1.5(c): NO athlete testimonials (so MyHealthPrac/Sana customer-story cards are NOT copyable; we adapt to research-citation form on overlays)
- Voice principle: Hormozi mechanics, RIK voice
- Frontend-only revamp boundary
- Backend code untouched (lib/, api/)
- 4 regression scripts must keep passing

## Reference docs

- Signed Citation Rights Agreement: `/Users/bekzhou/Downloads/RIK_Citation_Rights_Endorsement_Agreement_Emily (2).pdf`
- RD Review Statement: `/Users/bekzhou/Downloads/RD Review Statement.pdf`
- 14-Day Launch Plan: `/Users/bekzhou/Downloads/RIK_14_Day_Launch_Plan.md`
- Methodology v3.1: `/Users/bekzhou/Downloads/RIK_Protocol_Engine_Methodology_v3.1 (RD Review with Comments).docx`
- Visual asset bank: `/Users/bekzhou/Documents/RIK_Visual_Assets/`
- Design system: `/Users/bekzhou/Downloads/Design system file-RIK ATHLETICA.html`
- Live codebase (source for cutover): `/Users/bekzhou/Documents/Claude Code - Gstack/`
- Audit backend codebase (source for cutover): `/Users/bekzhou/Downloads/RIK_Site_Revamp/site/`

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR (PLAN) | mode: SELECTIVE_EXPANSION; 6 expansions proposed → 2 accepted (later both cut by founder pivot to lean), 3 deferred to TODOS, 1 skipped; 13 substantive directional decisions captured (C-D1 through C-D10c) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 17 issues found, 8 user-decided, 9 defaulted; 5 critical regression gates flagged |
| Design Review | `/plan-design-review` | UI/UX gaps | 3 | CLEAR (PLAN) | iter-4 reset: founder rejected iter-1-3 as "AI-ish + plain"; new aesthetic per MyHealthPrac + Sana Learn; 5 foundational decisions locked (overlay-dominant mechanic, Lucide icons, Ariana shoot dominant, RDN editorial card, stats overlay); per-page section rhythm rewritten; 6 retire patterns + 5 keep patterns identified |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | offered each review, founder declined each time |
| DX Review | `/plan-devex-review` | DX gaps | 0 | — | not applicable (marketing site) |

**UNRESOLVED**: 0 across all 3 reviews.
**CROSS-MODEL**: not run.
**VERDICT**: CEO + ENG + DESIGN ALL CLEARED — ready to bootstrap Phase 0.

The plan now contains: architecture (eng), strategy + scope decisions (CEO), design specification (design). Implementation can begin with full upstream alignment locked.
