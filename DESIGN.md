# RIK Athletica — Design System (iter-5, LOCKED)

**Locked:** 2026-05-08 by founder approval after 3 design-direction iterations.
**Source of truth:** This document. All page builds (`/home`, `/bundle`, `/sprint`, `/premium`, `/audit`, `/calculator`) compile against the tokens, patterns, and rules below.
**Reference inspiration:** MyHealthPrac.com (period-stacked editorial-medical), Sana Labs (whitespace-driven), Pas Normal Studios + Rapha (premium endurance type).
**Iter-4 archive:** `DESIGN.iter-4.archive.md` (overlay-dominant — superseded).

> Read this file before making any visual or UI decision. Deviations require explicit founder approval.

---

## 1. Aesthetic Direction

> **"Editorial endurance. Period-stacked confidence on warm-gray surfaces, anchored by lifestyle photography with natural dark zones for typography."**

- **Aesthetic register**: Editorial-magazine + premium endurance kit (Rapha / Pas Normal Studios). Not SaaS, not medical-tech, not e-commerce template.
- **Voice constants** (per MyHealthPrac DS): Period-stacked headlines (X. Y. Z.), em-dash + spaces, capital "You" as a brand affectation, numeric proof over adjectives.
- **Subtraction default**: every section must earn its pixels. No section delivers two jobs.
- **Photography first**: Real athletes, golden-hour, motion-blurred. The photo's natural dark zones carry text — synthetic scrim only as a whisper, never to flatten the image.

---

## 2. Type System

| Role | Family | Weight | Scale |
|---|---|---|---|
| Display (h1, hero, closing) | **Outfit** | 700 | `clamp(48px, 8vw, 112px)` hero · `clamp(48px, 7.5vw, 120px)` closing |
| Section headline (h2) | **Outfit** | 700 | `clamp(36px, 5.5vw, 72px)` |
| Subhead (h3) | **Outfit** | 600–700 | `clamp(28px, 3.8vw, 50px)` icon-list / split |
| Body | **Outfit** | 400–500 | 15–17px, line-height 1.55–1.65 |
| Eyebrow / mono caption | **Outfit** | 500–600 | 11–13px, letter-spacing `0.16em–0.20em`, UPPERCASE |
| Numerical / tabular | **Outfit** w/ `font-variant-numeric: tabular-nums` | 400–700 | inline |

- **Single family** — Outfit (Google Fonts, OFL, free for commercial use).
- **Letter-spacing rule**: Display `-0.02em` (heavier weights need looser tracking); body neutral; eyebrows `0.16–0.20em`.
- **Headline rule**: Every display headline ends with a period — even single-word ones. Stack 2–3 short clauses as separate sentences, not commas.
- **Italic emphasis**: Use real italics (`<em>`) rendered in `--ink-soft` for the second clause of period-stacked headlines (e.g., *"Recover the Minutes. **Lost to Fueling.**"*).
- **NEVER**: Inter, Roboto, Helvetica, Arial, Plus Jakarta Sans, JetBrains Mono, Cabinet Grotesk, Switzer, General Sans (all tested and rejected during iter-5).

---

## 3. Color Tokens

```css
--bg:        #EEEDEA;   /* default canvas — warm gray */
--bg-2:      #D5D2CC;   /* alt panels, voices section, FAQ surfaces */
--bg-sand:   #C4B59E;   /* highlighted CTA cards (premium tier) */
--ink:       #0E0E0E;   /* primary text + CTA fill */
--ink-soft:  #5A5853;   /* helper copy, em-emphasis on display */
--ink-dim:   #8A8780;   /* captions, separators */
--rule:      rgba(14,14,14,.18);  /* dashed dividers */
--rule-soft: rgba(14,14,14,.10);  /* card borders */
--warm-img:  linear-gradient(135deg, #7a4a2a, #c98b5a 50%, #3a2418);  /* atmospheric break */
```

- **No marketing accent color**. RIK's previous green (#2D5A3D) is **retired** from `/home` and the iter-5 system. All warmth comes from photography + the `--warm-img` atmospheric gradient.
- **Surfaces alternate**: sand → warm-amber atmospheric → sand → ink (closing). Variety in surface treatment carries rhythm.
- **Logo on dark**: `filter: brightness(0) invert(1)` to invert the dark-on-light source asset for footer / nav-on-photo contexts.

---

## 4. Layout & Spacing

- **Section padding**: 96px desktop, 64px tablet, 56px mobile (vertical).
- **Section ↔ section**: 1px dashed `--rule` divider — never solid.
- **Container max-width**: 1320px (`--maxw`).
- **Section head scaffold (asymmetric)**: 240px label-column + 1fr content. NEVER centered. Label = `01 — Section name`.
- **Card radius**: 18–22px. Pills/buttons: 999 (capsule).
- **Dashed dividers everywhere**: between sections, between feature-quad cells, between split-list rows, between bento cells. Never solid.
- **Grid asymmetry**: When a two-column layout exists, ratios are `1fr / 1.4fr` or similar — never 50/50 unless content demands it.

---

## 5. Signature Components

### CTA — Pill + Circle (mandatory for primary actions)

```html
<a class="cta" href="..."><span class="pill">Label</span><span class="arrow">↗</span></a>
```

- Rectangular pill (1px hairline border, 14×22 padding, 999 radius) flush to a separate circular arrow button (42px, 1px border).
- Variants: `cta` (ink-fill pill, white circle) · `cta invert` (white pill, ink circle for use on photos) · `cta ghost` (transparent pill, translucent border for use on photos) · `cta sm` (10×16 / 34px) · `cta lg` (18×28 / 50px).
- One sticky floating CTA in viewport bottom-right on every page — `position: fixed`, never disappears. Homepage: "Find Your Fit ↓" scrolls to #ladder. Inner pages: "Get My Protocol" links to /sprint.

### Stats Row (`.stats-row`)

3-column inline grid with dashed vertical dividers. Each stat: big tabular number (`clamp(32px, 4vw, 52px)` weight 700) with `<sup>` unit/dagger, one-line label in `--ink-soft`, italic citation below. Stacks to single column on mobile with dashed horizontal dividers. Used on homepage for the 3 key data points (GI distress, performance loss, recoverable minutes).

### Ladder — Tier Comparison (`.ladder`)

4-column grid on white card (`border-radius: 18px`, `1px solid --rule-soft`). Each column (`.ladder-col`): price (`clamp(28px, 3.2vw, 40px)` weight 700), tagline (16px weight 600), persona quote (14px italic `--ink-soft`), description (14px `--ink-soft`), CTA at bottom (auto-pushed via `margin-top: auto`). Columns separated by dashed vertical borders. Responsive: 4-col → 2-col (tablet) → 1-col (mobile). Used on homepage as the primary routing mechanism.

### Why Cards (`.why-rik-grid`)

3-column grid of white cards (`border-radius: 18px`). Each card: outlined circle icon (52px, 1.5px stroke), h3 title (20px weight 600), body paragraph (14px `--ink-soft`). Icons are inline SVG Lucide icons inside the circle. Stacks to single column on tablet/mobile.

### Pattern B — Title-left, icon-list-right (`.icon-list`)

Asymmetric `1fr / 1.4fr`. Display headline + lead + CTA on left. 4–6 outlined-circle icon rows on right (48px circles, 1.5px stroke). Icons live inside a circle — single weight throughout the system. Used on inner pages (bundle, sprint, premium).

### Asymmetric photo-text split (`.split-2`)

`1.1fr / 1fr` photo + text columns. Photo at 4:5 aspect with `border-radius: 22px`. **Variant `.split-photo.product`** for non-lifestyle assets (no sepia filter, sand background, `background-size: contain`). **Variant `.split-photo.video`** for short campaign clips (autoplay+muted+loop+playsinline, `preload="metadata"`). Used on inner pages.

### Hero composition

Full-bleed photo with **portrait crop pushed via `background-size: 180% auto` + `background-position: 0% 30%`** so the subject lands at ~76% horizontal and the natural dark zone holds text on the left. Text strictly capped at `min(580px, 48%)` of viewport width. Multi-layer text-shadow stack on h1: `1px tight + 6px medium + 24px wide + 48px ambient`. Soft edgeless radial halo behind text — no card chrome, no boxed isolation. Dual CTAs: primary `cta invert lg` + secondary `cta ghost lg`.

### Founder Note (`.founder-note`)

Centered section. Eyebrow label ("— From the founder"), blockquote (`clamp(18px, 2.2vw, 22px)` weight 400, line-height 1.55), signature line (14px `--ink-soft` weight 500). Used as the penultimate section before footer on homepage.

### RD review card (`section.rd-review-section`) — Emily Norman, MS, RDN

**Strict compliance with Citation Rights & Endorsement Agreement** (signed 2026-05-07, 6-month term):

- **§1.1**: Citation form *"Methodology reviewed by Emily Norman, MS, RDN — Commission on Dietetic Registration (USA), reg. #86117608, May 7, 2026."*
- **§1.6(a)**: Professional review banner layout — headshot adjacent to written statement + signature image + credentials.
- **§1.6(c)**: Headshot ≤320px wide. Currently displayed at 200×200 circular (well within limit).
- **§1.6(b)**: Standard sizing/optimization only. **No creative crop, no filter, no color correction beyond standard sizing, no compositing with other graphics.**
- **§1.6(f)**: If displaying excerpt, full statement must be linked adjacent (currently `/assets/docs/rd-review-statement.pdf`).
- **§3.2/§3.3**: All quoted text verbatim. Never edit, paraphrase, abridge, quote out of context, or pair name with claims not in the statement.
- **§2**: FTC disclosure adjacent to citation, NOT in footer: *"Paid independent methodology review. RIK Athletica paid Reviewer a one-time fee for this review. The opinions expressed are Reviewer's own."*
- **§4.3**: Scope clarification verbatim from Reviewer's statement, displayed wherever Citation appears.
- **§1.5 EXCLUDED**: paid advertising, performance-marketing, testimonial framing, founder-authored social posts naming Reviewer, cold outbound, individualized Sprint deliverables.
- **§5.3**: Reviewer may revoke at any time; remove from all live materials within 7 days.
- **§6.1**: Material protocol changes trigger 14-day notice; may require paid re-review.
- **§1.2(a)**: Named citation with photo is permitted on most website pages (homepage, bundle, calculator, Sprint, Premium, Audit, Free Race Fuel Audit PDF). Restriction is specifically about placement directly adjacent to sales offerings (buy buttons/checkout) or on individualized customer protocol deliverables — not about specific pages.

---

## 6. Photography Rules

- **Source**: `~/Documents/RIK_VIsual_Assets/Ariana Luterman/` 4K source PNGs. Re-render to `/assets/web/al-DSC*.jpg` at 2400–3000px wide via `sips -Z N -s format jpeg -s formatOptions 86–90`.
- **Register**: Warm sepia / golden-hour / motion-blurred. Never bright stock-photo lighting.
- **Hero crops**: Always position photos so a natural dark zone falls under text. Use `background-size: 180% auto` + `background-position` to crop portrait sources into wide hero containers without scrim-darkening.
- **Filter rule**: Minimal — `saturate(.92) brightness(.86) contrast(1.04)` for biomarker tiles, `saturate(.78) brightness(.92) sepia(.10)` for split-photo lifestyle. Hero gets NO filter. Product packshots (`.split-photo.product`) get NO filter.
- **Locked photo-to-section assignments** (iter-5):
  - Hero: `al-DSC00489.jpg` (cyclist on Trek, golden-hour panning, dark forest left)
  - Delivery split-photo (or video): `bundle-box-open.jpg` static OR `delivery-loop.mp4` 7-second campaign clip
  - Biomarker tile 01 (30–50%): `al-DSC00366.jpg` (helmeted sun-blasted portrait)
  - Biomarker tile 02 (3–5%): `al-DSC00802.jpg` (helmet + shades golden-hour)
  - Biomarker tile 03 (20–40 min): `al-DSC00428.jpg` (rider checking watch, red-car blur)
  - Closing hero: `al-DSC00863.jpg` (warm-hour contemplative)

---

## 7. Iconography

- **Library**: Lucide (lucide.dev), MIT license, downloaded as inline SVG.
- **Stroke**: 1.5px single weight throughout the system. Never mix weights.
- **Sizes**: 24px default, 28–36px feature, 14–22px embedded inside a circle.
- **Treatment**: Always inline SVG `currentColor` so they pick up the surrounding text color. Never bitmap or filled icons.
- **Hero feature icons**: Inside a 36px circle with 1px white-translucent border + 6px backdrop-blur (frosted-glass treatment).

---

## 8. Motion

- **Duration**: micro 50–100ms · short 150–250ms · medium 250–400ms · long 600–800ms.
- **Easing**: enter `ease-out`, exit `ease-in`, move `cubic-bezier(.4, 0, .2, 1)`.
- **Voices fade**: 700ms cubic-bezier opacity + translateY(8px → 0).
- **CTA hover lift**: `translateY(-1px)` + drop-shadow strengthen. Always `prefers-reduced-motion` aware.
- **Hero asterisk / hint pill**: Subtle infinite loops (1.4–2.4s); ALL respect `prefers-reduced-motion`.
- **Nav fade**: Opacity ramp from 1 → 0 across 50vh → 85vh of scroll, requestAnimationFrame-throttled.

---

## 9. Compliance Hooks (FDA / FTC / RDN)

Every page that ships under iter-5 must satisfy:

1. **FDA dietary supplement disclaimer** verbatim in footer with `&dagger;` reference markers wherever specific claims appear.
2. **FTC §255.5 endorsement disclosure** clear & conspicuous adjacent to any RD citation — never hidden in footer.
3. **No medical-claim language** — `compliance-grep.sh` blocks: *cure, treat, prevent disease, guarantee, ensure performance, doctor-approved, medically proven*.
4. **§4.3 scope clarification** displayed wherever Emily's name appears.
5. **§1.6(b) approval** — any change to placement/dimensions/crop of headshot or signature image requires written Reviewer approval before going live (batch in Phase 4 PDF).

---

## 10. Section Inventory — `/home` (v6 router — updated 2026-05-13)

Homepage is a **router page**: visitors self-route to the right product tier within 20 seconds. 6 content sections + nav + footer. Primary CTA scrolls to #ladder, secondary routes to /calculator.

| # | Section | Pattern | Background | Photo? |
|---|---|---|---|---|
| Nav | Fixed transparent nav, fade-on-scroll | — | Transparent over hero | — |
| Hero | Full-bleed photo + dual CTAs | Hero composition | Photo (`al-DSC00489`) | Yes |
| 01 | Stats Row | Stats Row (3 cited data points) | `--bg` | — |
| 02 | The Ladder | Ladder 4-col comparison ($0→$1,599) | `--bg-2` (sand) | — |
| 03 | Why RIK | Why Cards ×3 (differentiators) | `--bg` | — |
| 04 | Independent RD Review | Full RD card (Emily, headshot+sig+quote+FTC+scope) | `#fff` (white, contrast) | Headshot + signature |
| 05 | Founder Note | Centered blockquote + signature | `--bg` | — |
| Footer | Legal + FDA disclaimer | Solid `--ink` | — | — |

**Removed from prior version** (iter-5 v5): How It Works, Delivery split-photo, Warm-amber atmospheric break, Biomarker tiles ×3, Voices rotator (25 quotes), Feature quad (router), CTA wall, Closing hero. These patterns still exist in the design system for use on inner pages.

---

## 11. Voice & Copy Patterns

The visual system stops working without the copy system. Every headline, body paragraph, microcopy moment on every surface (web, email, PDF, packaging insert) compiles against these rules.

### Headline structure

- **Period-stacked.** Every display headline ends in a period. Even single-word ones. The full stop is the brand mark.
  - ✓ *"Recover the Minutes. Lost to Fueling."*
  - ✓ *"Two Boxes. Built Around Your Race Date."*
  - ✓ *"Done-for-You. Race Fueling. Plate Clear."*
  - ❌ *"Recover the minutes you're losing to fueling errors"* (no period, no stack)
- **Two-or-three clause stack.** Display headlines are 2–3 short sentences, each ending in a period. Pattern: `X. Y.` or `X. Y. Z.`
  - ✓ *"Lost. To Fueling. Recovered."*
  - ✓ *"Bundle Works on Its Own. Inside Sprint, It Works Precisely."*
- **Em-dash bridge** ( ` — ` with spaces) when a clause needs a qualifier without breaking the period rhythm.
  - ✓ *"The system You can taste before race day"*
  - ✓ *"Calibrated to Your physiology — delivered, revised."*
- **No comma splices in display.** Use periods to break the rhythm.
  - ❌ *"Built on Your physiology, delivered, revised, until it works"*
  - ✓ *"Built on Your physiology. Delivered. Revised. Until it works."*

### Voice constants

- **Capital "You" as a brand affectation.** The reader is named, not a generic visitor. Used in headlines, body, microcopy. Not in legal disclaimers (lower-case "you" there).
- **Numeric proof over adjectives.** Quantify with `+` signs and tabular numerals.
  - ✓ *"30 gels. One system."* / *"500+ markers."* / *"28–56 days out."*
  - ❌ *"Many gels. A complete system."*
- **Builder voice, not consultant voice.** Direct. Specific. No filler, no hedging, no founder cosplay. Lead with the point.
  - ✓ *"5-min audit. No needles. No labs."*
  - ❌ *"We've designed a comprehensive multifaceted assessment that may help you delve into your fueling..."*
- **Tied to user outcomes.** What the user sees, loses, waits for, gains.
  - ✓ *"20–40 minutes recoverable from correctable fueling errors."*
  - ❌ *"Optimize your race-day fueling experience."*

### Banned vocabulary (AI-slop list)

These words signal generic LLM output and never appear on customer-facing surfaces:

`delve · crucial · robust · comprehensive · nuanced · multifaceted · furthermore · moreover · additionally · pivotal · landscape · tapestry · underscore · foster · showcase · intricate · vibrant · fundamental · significant · seamless · cutting-edge · holistic · synergy · leverage · unlock · empower · elevate · revolutionize · disrupt · best-in-class · world-class`

### Punctuation rules

- **Curly quotes.** `"` not `"`. `'` not `'`.
- **En-dash for ranges.** `20–40 minutes`, `28–56 days`. Not `20-40` or `20—40`.
- **Em-dash for clause bridges.** ` — ` with surrounding spaces. Not `--` or `—` (no spaces).
- **Ellipsis character.** `…` for loading states. Not `...`.
- **No Oxford comma in display headlines.** Body copy keeps it.
- **Tabular numerals** on stat displays: `font-variant-numeric: tabular-nums` so columns align.

### Capitalization

- **Title Case on display headlines.** "Recover the Minutes. Lost to Fueling."
- **Sentence case on body and lead paragraphs.** Body reads conversational.
- **UPPERCASE on eyebrows** — 11–12px with `letter-spacing: .18em`. Reserved for section labels and meta callouts.

### Microcopy rules

- **Buttons name the outcome.** *"See the 4-Week Sprint"*, not *"Click here"*. *"Calculate Your lost minutes"*, not *"Submit"*.
- **Loading states end with `…`.** *"Setting up Your contract…"*. The character, not three dots.
- **Form labels are imperative.** *"Race date"*, not *"What is your race date?"*.
- **Error messages: what + why + what next.** *"Race must be at least 4 weeks out."* Not *"Invalid date"*.
- **Confirmation messages have warmth.** *"Got it. Audit's in motion."* Not *"Form submitted successfully."*

---

## 12. Editorial Layout Logic

Tokens + components don't produce a coherent page on their own. These are the rules for how the components compose.

### Section count limits

- **Marketing pages** (home, bundle, sprint, premium): **8–10 content sections** + nav + footer. Not 15. Each section earns its pixels.
- **Function pages** (audit, calculator): React/form is the page. Trust band + footer surround it. No additional marketing sections.
- **Subtraction default.** When in doubt, cut. Half the sections is usually the right call.

### Section rhythm — surface alternation

The page breathes on alternation, not repetition. Surface order should rotate:

`white → sand → warm-amber → white → ink (closing)`

- **White (`var(--bg)` / `#fff`)** — calm pages, baseline, where reading happens
- **Sand (`var(--bg-2)` / `#D5D2CC`)** — alt panels, voices, comparison tables, atmospheric "pause" without the warm gradient
- **Warm-amber (`var(--warm-img)`)** — typography-only break, used **once per page** as the rhythm reset
- **Ink (`var(--ink)`)** — closing hero (full-bleed photo with ink fallback), footer

Two consecutive identical surfaces = a missed beat. Always alternate.

### Pattern selection by section purpose

| Section purpose | Pattern | Background |
|---|---|---|
| Open the page (claim) | Hero composition | Full-bleed photo |
| Explain how it works | Pattern B (icon-list-right) | White card on `--bg` |
| Show product/delivery | Asymmetric photo-text split | `--bg-2` |
| Reset rhythm with poster moment | Warm-amber atmospheric (typography only) | `--warm-img` |
| Show numbers/proof | Biomarker tiles ×3 | `--bg` |
| Show pain (social proof) | Voices rotator | `--bg-2` |
| Show authority | RD review banner | White |
| Show options (router/decision) | Feature quad (3–4 cells) | `--bg-2` |
| Show comparison (us vs them) | Comparison table | `--bg-2` |
| Multiple-choice CTA | CTA wall (2 cards) | `--bg` |
| Single-action CTA | Reserve card (sand) | Embedded in section |
| Close the page | Closing hero | Full-bleed photo |

### Hero composition rules

1. **Full-bleed photo** — never inset, never tiled, never windowed
2. **Photo composition first.** Pick photos with a natural dark zone where text will sit. Don't fight the photo with synthetic scrim.
3. **Lifted text** via multi-layer text-shadow (4 layers on h1) + soft edgeless radial halo. **Never** card chrome / glass panel / boxed isolation.
4. **Constrain text width** so it never bleeds into the subject's silhouette.
5. **Period-stack the headline.** 2–3 clauses. The eye finishes on a period.

### Closing rules

- The closing **mirrors the hero** at 1.2× scale. Same full-bleed photo treatment, same period-stack, same ink + soft halo recipe.
- Closing headline is the **biggest type on the page** (`clamp(48px, 7.5vw, 120px)` on the closing h2 vs `clamp(48px, 8vw, 112px)` on hero h1).
- Closing **must lead somewhere** — never just a feeling. Two CTAs: primary ink-pill + secondary outline-pill on photo.

### Atmospheric break placement

- Used **once per page** at the rhythm midpoint
- Right after a product/delivery section, before the next data section
- Pure typography (no photo, no card chrome) on `--warm-img` gradient
- Headline is a thesis, not a feature claim: *"Two layers. Not one."* / *"Two boxes. Ten days apart. One race-day system."*
- Below: 3-stat dashed-top meta row with tabular numerals

### Voices rotator placement

- Between numbers/scope sections and authority/CTA sections
- Acts as the **social proof bridge** — "the problem is real → real athletes feel it → here's how we solve it"
- Same 25 Reddit excerpts site-wide (consistency = trust); 4500ms interval; pause-on-button only (not on hover, too fragile)
- IntersectionObserver pauses when out of view (battery-friendly)

### RD review placement

- On homepage: after Why RIK differentiators, before Founder Note — authority validation after the value proposition
- On inner pages: after product detail, before the final CTA
- Full §1.1 card with all four compliance hooks (citation form, FTC §2 disclosure, §4.3 scope, §1.6(f) PDF link)
- White background mandatory — creates visual contrast against sand/gray surrounding sections

### Ladder placement (homepage only)

- Immediately after Stats Row — the data creates urgency, the Ladder provides the action
- The primary hero CTA scrolls to #ladder — this is the core routing mechanism
- 4 tiers left-to-right in ascending price: $0 Audit → $119 Bundle → $569+ Sprint → $1,599 Premium
- Each column includes a persona quote ("I'm not sure what's wrong...") so visitors self-identify

---

## 13. Cross-Medium Application

The iter-5 system is the source of truth for everything. Web pages, email, PDFs, packaging inserts, deliverables — all compile against the same tokens, voice, and component library.

### Email (lifecycle, transactional, newsletter)

**Type system:**
- Outfit web font (Google Fonts CDN) with system fallback: `'Outfit', -apple-system, 'Helvetica Neue', Arial, sans-serif`
- Email clients without web-font support fall back gracefully — Outfit is geometric enough that Helvetica Neue / Arial substitutes don't break the visual register
- Same weight scale: 400/500 body, 600/700 display

**Color tokens:**
- Body bg: `#EEEDEA` (sand)
- Card surface: `#FFFFFF`
- Text: `#0E0E0E` ink, `#5A5853` ink-soft
- Accent: ink only — no green, no purple, no marketing accent
- Buttons: pill+circle pattern OR plain ink-fill pill (some clients strip flexbox; a single rectangular pill `border-radius: 999px` is the safe fallback)

**Voice:**
- Subject lines: period-stacked OR single short sentence ending in period
  - ✓ *"Your race won't fuel itself. Recover the minutes."*
  - ✓ *"Day 1: the gut-training window opens."*
- Capital "You" throughout body
- Same banned-vocabulary list applies (no *delve*, *crucial*, *robust*, etc.)

**Voice templates** (write all sequences against these):
- **Welcome:** *"Got it. You're in." → "Here's what happens next." → "Three days from now, the gut-training window opens."*
- **Onboarding:** numbered period-stacked subjects: *"Day 1: Your first session."* / *"Day 4: First check-in."* / *"Day 7: First revision."*
- **Race week:** sharper, shorter. *"Race week. Phone line open."*
- **Post-race:** quiet, considered. *"Debrief in 7 days. What worked. What didn't."*

**Compliance hooks for email** (per §1.2(c)):
- Emily Citation Rights Agreement permits citing her in **opt-in lifecycle email** to newsletter / calculator-result / audit-recipient subscribers
- ❌ Cold outbound prospecting NOT permitted (§1.2(c) excludes this)
- ❌ Paid email placement / third-party email sponsorships NOT permitted
- §2 FTC disclosure adjacent to citation in email body, not in email footer
- §4.3 scope clarification adjacent

### Free Race Fuel Audit PDF (§1.2(a) permitted)

**Type system:**
- Outfit at full weight range (PDF embeds the font for offline reading)
- Same display scale: 56–72px h1 on cover, 32–44px h2 section headers, 14–16px body, 11px eyebrow

**Layout:**
- 4 pages per the existing spec (cover + 2 content + RD citation footer page)
- Cover: full-bleed photo treatment (athlete in motion, warm sepia register) with period-stacked title
- Section headers: same `01 — Section name` asymmetric scaffold
- Dashed dividers between sections
- Number stat callouts use tabular numerals + warm-amber accent block

**RD citation per §1.2(a):**
- Verbatim §1.1 form on title page or final page
- §2 FTC disclosure adjacent
- §4.3 scope clarification verbatim from Reviewer's statement on final page
- Headshot ≤320px wide per §1.6(c)
- Signature image present

**Voice:**
- Findings: period-stacked *"Where the minutes go. Mile 18. Carb deficit."*
- Body: same builder voice, capital "You"
- Numeric proof: tabular nums on every stat callout

### Sprint protocol deliverables (Week Grid, Session Protocol, Performance Report)

**Critical compliance flag** per §1.5(f):
- ❌ Display of Reviewer's name or Citation on individualized Sprint customer protocol deliverables is **excluded** until separately licensed
- RIK MAY reference an *unnamed* RDN review on these deliverables in a manner that does not identify Reviewer
- Acceptable: *"Methodology audited by an independent Registered Dietitian Nutritionist."* (no name)

**Type system:**
- Outfit at deliverable scale: smaller display sizes for printable A4 / Letter (28–40px h1, 18–24px h2)
- Body 11–12pt for printable density
- JetBrains Mono OR Outfit-with-tabular-nums for tabular data (CHO/hr targets, sodium load, week grids)

**Visual register:**
- White / sand surface (no full-bleed photos on deliverables)
- Iter-5 dashed dividers
- Period-stacked section headers
- Numeric data in stat-block format (big number + sup unit + caption)

### Race Pack inserts / packaging

**Visual register:**
- Same warm-sepia photography for any imagery
- Outfit type system on inserts
- Period-stacked section headers
- Capital "You" maintained

**Compliance:**
- ❌ No Emily citation on packaging (not in §1.2 permitted locations)
- FDA dietary supplement disclaimer per §1.2(a) compliance for inserts that reference specific claims
- SGS-tested / GMP-certified language must match site copy verbatim

### Brand decks (investor / partner / accelerator)

Per §1.2(a), Emily citation is permitted on:
- Investor materials, due-diligence packages
- Accelerator / grant applications
- Business decks sent to potential business partners

Same iter-5 type system + visual register applies. Period-stacked slide titles. Capital "You" in customer-facing pitch sections (lower case "you" in operational sections like financials).

### Social media / paid ads (CRITICAL EXCLUSION)

Per §1.5(a)/(b)/(c)/(d) — Emily citation is **excluded** from:
- ❌ Paid advertising creative on any platform (Reddit, Meta, Google, YouTube, podcasts, display, sponsored)
- ❌ Performance-marketing campaigns of any kind
- ❌ Testimonial-format content (before/after framing, customer-style endorsements, framing as user)
- ❌ Founder-authored or third-party social media posts naming Reviewer in promotional context
  - Organic founder posts that link to /methodology page **without naming Reviewer in the post itself** remain permitted

Iter-5 visual system still applies (same Outfit, same warm-amber atmospheric, same period-stacked voice). Just no Emily.

---

## 14. Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-08 | **Iter-5 LOCKED** | Founder approval after 3 design-direction iterations. MyHealthPrac DS adopted, Outfit type system, retired green accent, full RD citation banner per Emily Citation Rights Agreement. |
| 2026-05-08 | Outfit (Google Fonts) chosen as single family | Closest free analog to Aeonik / PP Neue Montreal used by premium endurance brands. Cabinet Grotesk + Switzer + General Sans + Inter all rejected after live tests. |
| 2026-05-08 | Drop Plus Jakarta Sans + JetBrains Mono on `/home` | Single Outfit family per MyHealthPrac DS rule. Other pages migrate during iter-5.5–5.8 rebuilds. |
| 2026-05-08 | Retire `--green: #2D5A3D` from `/home` | MyHealthPrac DS rule: no marketing accent — all warmth from photography. |
| 2026-05-08 | Voices section: 25 Reddit excerpts, 6.5s rotation | Sourced from filtered scrape of r/triathlon, r/IronmanTriathlon, r/AdvancedRunning, r/Velo, r/Ultramarathon (1391 records → 791 filtered → 25 hand-curated). |
| 2026-05-08 | Hero photo: `al-DSC00489.jpg` w/ `background-size: 180% auto` | Portrait source (1600×2000) needs zoom past cover for X-position to work. Pushes rider to 76% of viewport, dark forest left for text. Re-rendered at 3000px from 4K source. |
| 2026-05-08 | RD banner uses Emily Norman, MS, RDN sign-off form | Her own approved form per §1.1's "substantially similar wording" clause. |
| 2026-05-09 | All 6 pages migrated to iter-5: /home, /bundle, /sprint, /premium, /audit, /calculator | Iter-5.5 → 5.8 sequence. Self-contained marketing pages, light treatment on form/calculator pages preserving working flows (Stripe + race-gate + form validation + React app). |
| 2026-05-09 | Voice + IA + cross-medium application locked in DESIGN.md (§11–§13) | Visual tokens alone don't produce coherent output. Period-stacked headlines, capital "You", em-dash voice, banned vocabulary list, section rhythm, pattern selection, and cross-medium application (email, audit PDF, Sprint deliverables, packaging, brand decks) are now part of the locked source of truth. |
| 2026-05-13 | **Homepage restructured to v6 router page** | Reduced from 12 sections to 6. New structure: Hero → Stats Row → Ladder (4-tier comparison) → Why RIK → RD Review → Founder Note. Removed: How It Works, Delivery, Atmospheric break, Biomarker tiles, Voices rotator, Router quad, CTA wall, Closing hero. Goal: visitor self-routes to right tier within 20s. Primary CTA scrolls to #ladder, secondary routes to /calculator. |
| 2026-05-13 | §1.2 citation scope clarified by founder | Emily has granted named citation with photo on most website pages. Restriction is adjacent to sales offerings or on customer protocol deliverables — not page-specific. Homepage naming is explicitly permitted. |

---

## 15. What NOT to Do

- ❌ Inter / Roboto / Helvetica / Plus Jakarta Sans / JetBrains Mono / Cabinet Grotesk / Switzer / General Sans (all tested + rejected for iter-5)
- ❌ Synthetic dark scrim across full hero (kills photo vibrancy — use natural dark zones + whisper radial vignette only)
- ❌ Solid dividers (always dashed)
- ❌ RIK green accent on `/home` (retired in iter-5; may reintroduce on Bundle/Sprint/Premium for product-specific accents pending review)
- ❌ Centered everything (asymmetric layouts only)
- ❌ Comma-spliced headlines (period-stacked or em-dash bridge only)
- ❌ Bright stock photography (warm sepia register only)
- ❌ Glassmorphism cards / rounded glass panels around hero text (creates isolated-island feel — rejected)
- ❌ Symmetric 50/50 grids (always 1.1fr/1fr or 1fr/1.4fr asymmetric)
- ❌ Marketing accent gradients (purple/pink/blue) — only `--warm-img` brown gradient permitted as atmospheric break
- ❌ Naming Emily in any §1.5 excluded context (paid ads, testimonial framing, social posts, cold outbound, individualized deliverables)
- ❌ Editing or paraphrasing Emily's quoted text — verbatim only per §3.2/§3.3
- ❌ Cropping or filtering Emily's headshot beyond standard sizing per §1.6(b)

---

## See Also

- `assets/rik.css` — shared CSS tokens (bundle/sprint/premium/audit pages still load this; `/home` is self-contained)
- `index.html` — `/home` reference implementation of iter-5
- `PLAN.md` — execution plan, page IA, deferred items
- `CLAUDE.md` — project rules + skill routing
- `DESIGN.iter-4.archive.md` — superseded iter-4 (overlay-dominant)
- `RIK_Citation_Rights_Endorsement_Agreement_Emily.pdf` — full Emily agreement
- `assets/docs/rd-review-statement.pdf` — Emily's signed methodology review (May 7, 2026)
