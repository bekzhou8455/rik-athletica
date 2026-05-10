# RIK Athletica — Design System

Locked iter-4 by `/plan-design-review` on 2026-05-08 (3rd run, founder-direction reset).
Sources: https://www.myhealthprac.com/ + https://sanalabs.com/products/sana-learn/

For full per-page IA and interaction state matrix, see `PLAN.md` "Design specification" section.

---

## Aesthetic foundation (iter-4 reset)

> **"Editorial endurance. Dark photo overlays alternating with sand interludes."**

- **Reference brands**: MyHealthPrac (overlay-dominant) + Sana Learn (whitespace-driven editorial)
- **Reference brands NOT to look like**: stock SaaS templates with 3-col icon-in-circle grids, pastel gradients, centered everything
- **Primary visual mechanic (iter-4 D1)**: full-bleed dark photo + semi-transparent overlay + small Lucide icon + 5-7 word headline + 2-3 line body. Repeats 3-5 times per page. Sand/white sections become the INTERLUDE between overlays, not the dominant surface.
- **Visual rhythm**: dark → light → dark → light. Each page reads as alternating chapters.
- **One job per section**: if a section has more than one job, split it in two or kill it.
- **Subtraction default**: every section must earn its pixels. /home should be 5–7 sections, not 10+.
- **Section count limits**: home 5–7, bundle 7–8, sprint 7–8, premium 7–8, audit/calc as-is, utility pages 3–5.

## Locked iter-4 decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Overlay dominance | DOMINANT (3-5 per page) — sand/white is the interlude |
| D2 | Icon system | Lucide line icons, single-weight 1.5px, 24px default, inline SVG |
| D3 | Hero photography | Ariana Luterman shoot dominant + ingredient/product accents |
| D4 | RDN trust banner | Light editorial card on sand interlude (visual contrast as design) |
| D5 | Stats row | Folds into ONE dark overlay "numbers" section (not 4-card grid) |

## What retires from prior aesthetic (iter 1-3)

| Retiring | Why |
|---|---|
| Router widget on `/home` | Reads SaaS-template per founder |
| `.photo-block` asymmetric two-column | Too text-heavy; replaced by overlays |
| `.quote-callout` (gradient bottom + quote) | WRONG version of MyHealthPrac pattern; replaced |
| `.ing-scroller` glass-morphism cards | Borderline SaaS; reconsider treatment in iter-4 build |
| 4-card stats row (template) | Folded into single dark overlay |
| `.fallback-cta` text-heavy strip | Rebuilt as overlay or dropped |
| Multiple photo-blocks per page | One hero photo, then overlays carry the visual weight |

## What survives the redirect

| Surviving | Reason |
|---|---|
| Color tokens (sand, off-black, RIK green, JetBrains Mono numerics) | Match references |
| Plus Jakarta Sans + JetBrains Mono | Editorial-friendly |
| WCAG 2.1 AA target | Don't regress |
| Bundle vs other gels + Sprint vs services comparison tables | Sanalabs-aligned, lean |
| Stats CONTENT (data is solid) | Same numbers, new visual treatment |
| RDN trust banner CONTENT (locked §1.1, §4.3, §2 FTC) | Compliance-locked |
| Ingredient photography (10 compressed JPGs) | Same images, may use differently |
| Compliance grep + form-action + stripe regression scripts | Functional |

---

## Voice

**"Hormozi mechanics, RIK surface."**

- Use Hormozi structural pattern: dream outcome × likelihood × time × effort × risk reversal
- Write in RIK voice: direct, prescriptive, warm. No hype, no exclamation points, no marketing gloss
- Factual specificity — research-cited numbers in JetBrains Mono
- "Supports / may help / tends to" — never "guarantees / proven / cures"

ICP voice calibration: business-owner triathletes 35–50 (engineers, doctors, lawyers). Process-thinkers. They respect specificity over enthusiasm.

---

## Design tokens (canonical, in `/assets/rik.css`)

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
  --t-display: 64px;  --lh-display: 1.05;
  --t-h1: 48px;        --lh-h1: 1.1;
  --t-h2: 32px;        --lh-h2: 1.2;
  --t-h3: 22px;        --lh-h3: 1.3;
  --t-body: 16px;      --lh-body: 1.6;
  --t-small: 14px;     --lh-small: 1.5;
  --t-caption: 12px;   --lh-caption: 1.4;

  /* Spacing (8px scale) */
  --s-1: 8px;  --s-2: 16px; --s-3: 24px; --s-4: 32px;
  --s-5: 48px; --s-6: 64px; --s-7: 96px; --s-8: 144px;

  /* Radius */
  --r-card: 20px;
  --r-btn: 36px;       /* pill */
  --r-img: 8px;        /* product photo */
  --r-img-hero: 0;     /* hero is full-bleed */

  /* Motion */
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --motion-fast: 150ms;
  --motion-base: 300ms;
  --motion-slow: 600ms;
}

@media (max-width: 640px) {
  :root {
    --t-display: 40px;
    --t-h1: 32px;
    --t-h2: 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }
}
```

---

## Typography rule

- One `<h1>` per page (matches the visual hero headline)
- `<h2>` for section titles, `<h3>` for sub-sections
- Body text 16px minimum (WCAG AA)
- Numbers and technical values (g/hr, minutes, mg sodium) → `var(--font-mono)`, weight 400, full-stops not commas
- Captions 12px allowed only for legal/disclaimer copy
- Strict heading hierarchy — never skip levels

---

## Button hierarchy

| Tier | Visual | Use |
|---|---|---|
| **Primary** (`.btn-primary`) | Sand text on RIK green pill (radius 36px), 12/24 padding, hover lift -2px + shadow | One per section max. Money-action CTAs ("Get the Bundle", "Submit Audit") |
| **Secondary** (`.btn-secondary`) | RIK green text on sand, 1.5px green border, pill | Alternative actions ("Free Audit", "Read about the Bundle") |
| **Tertiary** (`.btn-tertiary`) | RIK green underlined text, no background | Inline CTAs ("see methodology", "compare", read-mores) |

Every button: `font-family: var(--font-sans); font-weight: 600; letter-spacing: 0.01em;`. Touch target 44×44px minimum.

---

## Cards vs flat sections

- **Default = flat sections.** Cards are decorative debt unless the card IS the interaction.
- **Use cards** for: clickable product gallery items, comparison rows on mobile, FAQ items (collapsible), interactive trust-badge clusters
- **Don't use cards** for: trust-row badges (1px border + small text suffices), section dividers, hero composition, methodology blocks, footer
- Card spec: `background: white; border: 1px solid var(--border); border-radius: var(--r-card); padding: var(--s-3);` — no shadow by default; hover allowed

---

## Motion philosophy (rich interactive per D4)

- **Entrance**: section fade-in + 12px translate-up on scroll-into-view, 600ms `var(--ease)`. One-time per session.
- **Hover (interactive)**: 200ms transform. Buttons lift -2px; cards lift -4px + shadow appears; links underline-grow.
- **Scroll-linked**: hero parallax (background image 0.3× scroll) on `/` and `/bundle` only. None elsewhere.
- **Micro-interactions**: input focus ring fade-in, form-step transitions, success-state expand.
- Respect `prefers-reduced-motion: reduce` — disable everything.

---

## Navigation

- Sticky header, 56px tall, sand background, 1px bottom border
- Logo left, nav links center-or-right, primary CTA right (pill button)
- Mobile (`< 640px`): logo left, hamburger top-right → full-screen menu with backdrop blur
- Active page link: RIK green color + 2px bottom underline
- Hover: muted underline-grow effect
- Nav link padding: `19px 0` (locked from prior rule for full 56px touch target)

---

## Photography ratio

- **2–3 lifestyle shots per page** (hero + 1-2 contextual)
- Source: Ariana Luterman athlete shoot at `/Documents/RIK_Visual_Assets/Ariana Luterman/web-optimized/`
- Product photography: PACKSHOT subset on `/bundle`, `/sprint`, `/premium` gallery sections
- Ingredient photography: 9 ingredients × 1 close-up shot, used on home methodology + bundle Layer 2 sections
- Image treatment: hero = full-bleed (radius 0); mid-page contextual = rounded 8px; product gallery = soft-shadow + radius 8px
- Aspect ratios: hero 16:9 desktop / 4:5 mobile; mid-page 3:2; product 1:1
- Pre-conversion: WebP @ q80, ≤200KB each, hero ≤400KB
- Push curated set to `bekzhou8455/rik-athletica@main/assets/web/` jsdelivr

---

## Image alt text policy

- Lifestyle: `[athlete name] [activity description]` (e.g., "Ariana Luterman running on coastal trail")
- Product: `[product name] [view]` (e.g., "Refuel gel front")
- Ingredient: `[ingredient] in [form]` (e.g., "matcha green tea powder")
- Decorative: empty `alt=""` (per WCAG)

---

## Responsive breakpoints (mobile-first)

| Breakpoint | Width | Use |
|---|---|---|
| Default | `< 640px` | Mobile |
| `sm` | `640px` | Large phones |
| `md` | `768px` | Tablet portrait |
| `lg` | `1024px` | Small laptop |
| `xl` | `1280px` | Laptop |
| `2xl` | `1440px` | Desktop |

---

## Accessibility (WCAG 2.1 AA target)

- Body text ≥ 16px; muted gray only on non-essential text
- Color contrast: body 4.5:1 minimum, large text 3:1 minimum
- Focus ring: 2px solid `var(--green)`, 2px offset, never removed
- Skip-to-main-content link visually hidden until focused
- Semantic HTML: `<nav>`, `<main>`, `<article>`, `<section>` required
- Heading hierarchy strict, no level skipping
- All interactive elements keyboard-operable (Tab, Enter, Space)
- Touch target minimum 44×44px (Apple HIG / WCAG 2.5.5)
- Form labels visible (no placeholder-as-label)
- Alt text on every `<img>` per policy above
- `prefers-reduced-motion: reduce` disables all motion

---

## Iter-4 pattern library (the new dominant mechanics)

### `.overlay-section` — the primary mechanic (MyHealthPrac-style)

The "epic" pattern Bek named. Every marketing page uses this 3–5 times.

```html
<section class="overlay-section">
  <img class="overlay-bg" src="/assets/web/AL-DSC00802.webp" alt="Athlete in golden light">
  <div class="overlay-scrim"></div>
  <div class="overlay-content">
    <svg class="overlay-icon" width="32" height="32"><!-- Lucide icon, white stroke --></svg>
    <h2 class="overlay-headline">No more guessing.</h2>
    <p class="overlay-body">Personalized fueling protocols for your race date,
       your physiology, your training load. Adjusted weekly until your gut adapts.</p>
  </div>
</section>
```

```css
.overlay-section {
  position: relative;
  min-height: 88vh;            /* near-full-viewport on desktop */
  display: flex;
  align-items: flex-end;       /* content sits at bottom by default */
  padding: var(--s-7) var(--s-4) var(--s-6);
  isolation: isolate;
  overflow: hidden;
}
.overlay-section.center { align-items: center; }      /* alt: content centered */
.overlay-section.compact { min-height: 56vh; }        /* alt: smaller surface */

.overlay-bg {
  position: absolute; inset: 0; z-index: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  object-position: center 30%;  /* per-section override */
}
.overlay-scrim {
  position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(180deg,
    rgba(10,10,10,0.0) 0%,
    rgba(10,10,10,0.25) 40%,
    rgba(10,10,10,0.78) 100%);
}
/* Variants: top-down scrim for top-aligned content, full scrim for centered */
.overlay-scrim.top { background: linear-gradient(180deg, rgba(10,10,10,0.78) 0%, rgba(10,10,10,0.25) 60%, rgba(10,10,10,0.0) 100%); }
.overlay-scrim.full { background: linear-gradient(180deg, rgba(10,10,10,0.6) 0%, rgba(10,10,10,0.6) 100%); }

.overlay-content {
  position: relative; z-index: 2;
  max-width: 720px;
  color: var(--white);
}
.overlay-icon {
  display: block;
  margin-bottom: var(--s-3);
  color: var(--white);
  stroke: currentColor;
  stroke-width: 1.5;
  fill: none;
}
.overlay-headline {
  font-family: var(--font-sans);
  font-size: clamp(36px, 5vw, 72px);
  font-weight: 300;          /* light weight for editorial confidence */
  letter-spacing: -0.03em;
  line-height: 1.05;
  color: var(--white);
  margin: 0 0 var(--s-2);
  max-width: 14ch;            /* forces 5-7 word break */
}
.overlay-body {
  font-size: 17px;
  line-height: 1.55;
  letter-spacing: -0.005em;
  color: rgba(255,255,255,0.85);
  margin: 0;
  max-width: 56ch;
}

/* Mobile: shorter min-height, tighter type */
@media (max-width: 640px) {
  .overlay-section { min-height: 68vh; padding: var(--s-5) var(--s-3) var(--s-4); }
  .overlay-section.compact { min-height: 48vh; }
  .overlay-headline { font-size: clamp(28px, 8vw, 40px); }
  .overlay-body { font-size: 15px; }
}
```

**Use rules**:
- Headline ALWAYS 5–7 words. If you can't say it in 7, the section doesn't have one job.
- Body 2–3 lines max. If you need 4, you have two ideas — split into two overlays.
- One Lucide icon, 32px, white stroke.
- Photo aspect-ratio: 16:9 desktop, 4:5 mobile. Photos must have darker bottom-half so the scrim works.
- WCAG AA contrast: white text on the scrim must measure ≥ 4.5:1 (verify per photo).

### `.overlay-stats` — the "numbers" overlay (replaces old stats row, iter-4 D5)

ONE overlay section that holds the 4 research-backed stats.

```html
<section class="overlay-section overlay-stats">
  <img class="overlay-bg" src="/assets/web/AL-DSC01041.webp" alt="Athlete mid-effort">
  <div class="overlay-scrim full"></div>
  <div class="overlay-content overlay-stats-content">
    <div class="overlay-eyebrow">The numbers behind your race</div>
    <div class="overlay-stats-grid">
      <div class="stat">
        <svg class="stat-icon">…</svg>
        <div class="stat-num">30–50<span class="stat-unit">%</span></div>
        <div class="stat-cap">Ironman athletes report GI issues on race day†</div>
      </div>
      <!-- 3 more stats -->
    </div>
    <p class="overlay-stats-cite">Pfeiffer 2012 · Cermak & van Loon 2013</p>
  </div>
</section>
```

Stats laid out asymmetrically (NOT 4-equal columns). Numbers in JetBrains Mono white at 56px+. Captions in muted off-white. Citations at the bottom in mono caption size.

### Section rhythm rules (iter-4)

```
HOMEPAGE (5–7 sections, was 8+):
  [DARK]  hero overlay — brand mission as 5-7 word statement + 1-line body
  [LIGHT] sand interlude — value-ladder router (kept but redesigned, simpler)
  [DARK]  3 sequential overlays — "Three things RIK does"
  [LIGHT] sand interlude — RDN trust banner (editorial card)
  [DARK]  stats overlay — research credibility
  [LIGHT] sand interlude — calculator teaser + audit CTA (combined)
  [DARK]  closing overlay — final CTA

BUNDLE (6–7 sections):
  [DARK]  hero overlay — Layer 2 functional positioning
  [LIGHT] sand interlude — comparison table (vs other gels)
  [DARK]  "Three moments" — 3 sequential overlays (pre-session / mid / post)
  [LIGHT] sand interlude — ingredient scroller (or grid, see iter-4 build)
  [LIGHT] sand interlude — RDN trust banner (editorial card)
  [DARK]  closing overlay — "Reserve the Bundle" + WhatsApp + audit fallback

SPRINT (7 sections):
  [DARK]  hero overlay — service positioning
  [LIGHT] sand — what's included (Training Box + Race Pack)
  [DARK]  process overlay — revision loop
  [LIGHT] sand — comparison (vs coaching)
  [LIGHT] sand — RDN trust banner
  [DARK]  pricing overlay — tier selector
  [DARK]  closing overlay — start

PREMIUM (7 sections):
  [DARK]  hero overlay — Founding Cohort positioning
  [LIGHT] sand — what's included (6 cards)
  [DARK]  bonus stack overlay — $1,246 stacked, 8 bonuses
  [LIGHT] sand — concierge band + guarantee
  [LIGHT] sand — RDN trust banner
  [DARK]  scarcity overlay — countdown to May 18
  [DARK]  closing overlay — reserve + WhatsApp

AUDIT (3 sections, mostly form):
  [DARK]  intro overlay — "Find the minutes you're losing" + 5-min framing
  [LIGHT] form (10 steps, intact)
  [LIGHT] confirmation + RDN trust banner

CALCULATOR (preserved):
  [LIGHT] React app (intact, fast)
  [DARK]  closing overlay — "Read about the bundle" + audit CTA
  [LIGHT] RDN trust banner (compact treatment, since calc is dense)
```

## Lucide icon vocabulary (iter-4 D2)

Locked subset for this site. 24px default, white on overlay sections, --green on light surfaces.

| Icon | Use |
|---|---|
| `target` | Race-day goal, hero overlays |
| `flask-conical` | Methodology, science, lab |
| `activity` | Performance, output, monitoring |
| `compass` | Find your fit, routing |
| `clipboard-check` | Audit, protocol, plan |
| `sparkles` | Layer 2 functional differentiator |
| `shield-check` | RDN-reviewed, trust |
| `calendar-clock` | Race date, race window, scarcity |
| `gauge` | Pace, speed, output |
| `droplet` | Hydration, electrolytes |
| `leaf` | Plant caffeine, natural ingredients |
| `heart-pulse` | Recovery, gut health |
| `users` | Founding cohort, community |
| `messages-square` | WhatsApp, async support |
| `book-open` | Methodology, research |
| `arrow-right` | CTA arrows, navigation |

Implementation: download SVG from lucide.dev, save to `/assets/icons/`, inline as `<svg>` (no font-load). Keep stroke-width 1.5.

## Photography curation (iter-4 D3)

```
HERO PHOTOS PER PAGE (one canonical per page, pre-selected):
  /home    AL-DSC00295.webp  Ariana sunset/golden hour, contemplative
  /bundle  AL-DSC00866.webp  Athlete fueling outdoor, warm tones
  /sprint  AL-DSC00580.webp  Athlete running w/ gel, mid-effort
  /premium AL-DSC00428.webp  Athlete portrait, premium feel
  /audit   AL-DSC00945.webp  Athlete reviewing/contemplating
  /calc    AL-DSC00141.jpg   (existing, gel on bike)

SECONDARY OVERLAYS (different shot per overlay so site doesn't repeat):
  Pool of 50+ Ariana shots in /Documents/RIK_Visual_Assets/Ariana Luterman/web-optimized/
  Each page selects 2-4 unique shots — no shot appears twice across the site.

INGREDIENT/PRODUCT (light-section accents):
  Existing /assets/ingredients/*.jpg — 10 ingredient shots
  /assets/media/refuel-studio.jpg + euphoria-studio.jpg + bundle composite

PHOTO TREATMENT FOR OVERLAYS:
  - Pre-darken bottom half of every hero photo via image processing (sips or
    macOS Preview gradient overlay) BEFORE compression. Don't rely solely on
    CSS scrim — bake some darkening into the JPG so even if scrim CSS fails,
    text remains readable.
  - WebP @ q80, target ≤300KB per overlay photo. Hero ≤500KB.
  - object-position tuned per photo to keep faces / focal points in upper 60%.
```

## Anti-AI-slop blacklist (must avoid)

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

---

## §1.6(e) RDN asset swap-out procedure

If Emily requests a new headshot or signature:
1. Save new file at the same path: `/assets/emily-norman-rdn.jpg` (≤320px wide, JPG q85) or `/assets/emily-signature.png` (transparent PNG, ~280px wide)
2. Commit + push to git
3. Run `vercel --prod --yes --scope rik-athletica` to deploy
4. Verify with `curl -I https://www.rikathletica.com/assets/emily-norman-rdn.jpg`
5. Per §1.6(e), this must complete within 7 days of receiving the new file

---

## See also

- `PLAN.md` — full execution plan with per-page IA, interaction states, anti-slop blacklist
- `CLAUDE.md` — project conventions and constraints
- `/Users/bekzhou/Downloads/Design system file-RIK ATHLETICA.html` — original design system file (external reference)
- `/Users/bekzhou/Documents/RIK_Visual_Assets/` — visual asset bank (389 files curated to ~30 for use)
