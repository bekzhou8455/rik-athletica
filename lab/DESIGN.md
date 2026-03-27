# Design System — RIK Athletica Protocol Builder (Internal Tool)

> This is the design source of truth for `lab/tool.html` and all files in `lab/`.
> **Read this before making any visual or UI decisions in the lab/ directory.**

## Product Context

- **What this is:** A localhost-only internal tool (port 3457) for building 4-week personalised nutrition protocols for endurance athletes
- **Who it's for:** Bek (solo founder, sole user). Used 1-2× per day. Long sessions: 30+ minutes per protocol build.
- **Space/industry:** Sports nutrition / endurance coaching ops
- **Project type:** Internal productivity tool — multi-step wizard
- **Flow:** Upload → Parse & Gate → Generate → Review → Export

---

## Aesthetic Direction

- **Direction:** Industrial / Utilitarian
- **Decoration level:** Minimal — typography and whitespace do all the work
- **Mood:** Precision instrument. Calm, confident, completely out of the way. The protocol being built is the hero — the UI should feel invisible while in use. Think field-calibration software or a clinical EHR, not a consumer app.
- **Anti-patterns:** No icon-in-colored-circle decorations, no colored left-border cards (except functional red flag block), no centered text (except success state), no generic SaaS card grids, no marketing language.

---

## Typography

### Fonts

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| Headings (h1–h2) | **Plus Jakarta Sans** | 600 | Step titles, section headers |
| Body / description | **Plus Jakarta Sans** | 400 | Descriptions, protocol body text, instructions |
| Labels & technical values | **JetBrains Mono** | 400 | Field names, g/hr values, timing (30min pre), session durations (2hr), status tags, UPPERCASE section headers in protocol |
| Buttons | **Plus Jakarta Sans** | 500 | All button text |

**Loading:**
```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
```

### Type Scale

```css
/* Headings */
--text-2xl: 24px;   /* Step title (h1) */
--text-xl:  20px;   /* Section heading (h2) */
--text-lg:  18px;   /* Protocol h2 inside draft */

/* Body */
--text-base: 15px;  /* Primary body text */
--text-sm:   13px;  /* Secondary descriptions, error messages */

/* Mono labels */
--text-label: 11px; /* JetBrains Mono — field labels, status tags, eyebrows */
--text-mono:  12px; /* JetBrains Mono — technical values, athlete data */
--text-data:  14px; /* JetBrains Mono — protocol numeric values (g/hr, timing) */
```

### Protocol Draft Typography (Step 4 review panel)

The protocol text that Bek reviews before approving is clinical nutrition data. It needs space:

```css
/* Protocol markdown render */
.protocol-body {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 15px;
  line-height: 1.8;        /* generous — Bek reads each line carefully */
  color: var(--off-black);
}
.protocol-body h2 {        /* WEEK 1 — GUT TRAINING PHASE */
  font-size: 18px;
  font-weight: 600;
  margin: 32px 0 8px;
}
.protocol-body h3 {        /* Session type headers */
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--tool-label);
  margin: 24px 0 8px;
}
.protocol-value {          /* e.g. 65g/hr, 30min, Maurten 100 × 2 */
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: var(--off-black);
}
```

---

## Color

### Approach: Restrained — one accent, neutrals only

```css
:root {
  /* ── Inherited from consumer site ── */
  --sand:       #f6f5f4;    /* page background */
  --off-black:  #0a0a0a;    /* primary text, primary buttons */
  --green:      #2D5A3D;    /* accent: active step, approve button, success states */
  --green-light: #4ade80;   /* checkmarks, success icons */
  --border:     rgba(0,0,0,0.08);
  --muted:      #888;       /* secondary text, future steps */
  --r-card:     20px;
  --r-btn:      36px;

  /* ── Internal tool additions ── */
  --tool-card:         #fff;                   /* step content card background */
  --tool-card-border:  rgba(0,0,0,0.08);       /* card borders */
  --tool-label:        #aaa;                   /* JetBrains Mono field labels */
  --tool-input-bg:     #fafafa;                /* input/textarea backgrounds */
  --tool-input-focus:  var(--off-black);       /* focus border color */

  /* ── Status colors ── */
  --audit-pass:        #2D5A3D;               /* PASS badge bg */
  --audit-flag:        #b7791f;               /* FLAG badge bg */
  --audit-fail:        #e53e3e;               /* FAIL badge bg */
  --red-flag-bg:       #fff5f5;               /* red flag block background */
  --red-flag-border:   #e53e3e;               /* red flag block border */

  /* ── Semantic ── */
  --success: #2D5A3D;   /* same as --green */
  --warning: #b7791f;
  --error:   #e53e3e;
  --info:    #3182ce;
}
```

### Color Usage Rules

- `--green` is used for: active wizard step, Approve button, quality PASS badge, success states
- `--off-black` is used for: all headings, primary buttons, active step number
- `--muted` is used for: future steps, secondary labels, helper text
- `--tool-label` (JetBrains Mono, `#aaa`) is used only with monospace labels — never with Plus Jakarta Sans body
- Red flag border (`--red-flag-border`) is functional, not decorative — only on the red flag block, never as a visual style choice elsewhere
- No purple, no gradients, no blue accents — single accent color system

---

## Spacing

- **Base unit:** 8px
- **Density:** Comfortable (internal tool — not compact, not spacious)

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

**Card padding:** `24px` (interior), `32px` (protocol review panel)
**Step content area:** `max-width: 960px`, `padding: 40px`, centered
**Between section rows:** `24px`
**Between label and field:** `8px`

---

## Layout

- **Approach:** Grid-disciplined — strict alignment, predictable
- **Content width:** max-width: 960px, centered
- **Page structure:**
  ```
  ┌─ Header bar (48px, --sand bg) ──────────────────────────────┐
  │  RIK ATHLETICA  ▸  Protocol Builder            [session ID] │
  ├─ Step bar (56px, white bg, border-bottom) ──────────────────┤
  │  [1] ── [2] ── [3 ●] ── [4] ── [5]                         │
  ├─ Step content area (max-width: 960px, centered, scrollable) ─┤
  │                                                              │
  │  [step card(s)]                                              │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘
  ```
- **Border radius:** all cards use `--r-card` (20px); buttons use `--r-btn` (36px); badges/tags use `999px` (fully rounded); inputs use `12px`
- **Cards:** white bg (`--tool-card`), `1px solid --tool-card-border`, `--r-card`, `box-shadow: 0 1px 3px rgba(0,0,0,0.04)`

---

## Motion

- **Approach:** Minimal-functional — only transitions that aid comprehension

```css
/* Global transitions */
--transition-fast:   150ms ease;     /* button hover, badge state changes */
--transition-base:   250ms ease;     /* card entrance, focus rings */

/* SSE step card entrance (each card animates as SSE event fires) */
@keyframes step-enter {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.step-card-enter { animation: step-enter 250ms ease forwards; }

/* Active step pulse (during AI generation) */
@keyframes step-pulse {
  0%, 100% { opacity: 0.7; }
  50%       { opacity: 1.0; }
}
.step-active-dot { animation: step-pulse 1.2s ease infinite; }
```

**Motion rules:**
- Button hover: `opacity: 0.82` transition only (no transform)
- Upload zone hover: `border-color` transition to `--green`, `background` transition to `rgba(45,90,61,0.04)`
- SSE cards animate in one at a time as each step completes
- No bounce, no spring physics — calm and predictable
- No scroll-driven animations

---

## Component Specs

### Upload Zone

```css
.upload-zone {
  border: 1.5px dashed rgba(0,0,0,0.15);
  border-radius: var(--r-card);
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}
.upload-zone:hover,
.upload-zone.drag-over {
  border-color: var(--green);
  border-style: solid;
  background: rgba(45, 90, 61, 0.04);
}
.upload-zone.filled {
  border-style: solid;
  border-color: var(--border);
  background: var(--tool-card);
}
.upload-zone.error {
  border-color: var(--error);
  background: #fff5f5;
}
```

Upload zone text (unfilled):
- Primary label: Plus Jakarta Sans 400 14px `--muted`
- Accepted formats: JetBrains Mono 11px `--tool-label`

Upload zone text (filled):
- Filename: Plus Jakarta Sans 500 14px `--off-black`
- File size: JetBrains Mono 11px `--tool-label`
- Green checkmark (✓) at left

### SSE Step Cards

```css
.step-list {
  background: var(--tool-card);
  border: 1px solid var(--tool-card-border);
  border-radius: var(--r-card);
  padding: 8px 0;
}
.step-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 24px;
  min-height: 40px;
}
.step-icon { width: 16px; text-align: center; flex-shrink: 0; }
.step-label {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 15px;
  font-weight: 400;
}
.step-row.completed .step-icon { color: var(--green); }
.step-row.completed .step-label { color: var(--off-black); }
.step-row.active .step-label { color: var(--off-black); }
.step-row.pending .step-label { color: var(--muted); }
```

### Audit Verdict Badges

```css
.audit-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.5px;
  color: #fff;
}
.audit-badge.pass { background: var(--audit-pass); }
.audit-badge.flag { background: var(--audit-flag); }
.audit-badge.fail { background: var(--audit-fail); }
```

Dimension score labels: JetBrains Mono 11px `--tool-label` UPPERCASE, followed by ✓ PASS / ⚠ FLAG / ✗ FAIL

### Red Flag Block

```css
.red-flag-block {
  background: var(--red-flag-bg);
  border: 1.5px solid var(--red-flag-border);
  border-radius: var(--r-card);
  padding: 32px;
  role="alert";
}
.red-flag-block h2 {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 20px;
  font-weight: 600;
  color: var(--error);
  margin-bottom: 8px;
}
.red-flag-block .ref {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--muted);
  margin-top: 4px;
}
```

### Wizard Step Bar

Step circle sizes: 28px diameter
- Completed: `background: var(--green)`, white ✓ (14px)
- Active: `background: var(--off-black)`, white number (Plus Jakarta Sans 500 12px), subtle pulse
- Future: `background: transparent`, `border: 1.5px solid var(--border)`, muted number

Connector: `1px solid var(--border)`, `flex: 1`
Step labels: Plus Jakarta Sans 400 12px, positioned below circle, `--muted` (future), `--off-black` (active/done)

### Quality Score Badges (Parse step)

- HIGH: `--green` text, `rgba(45,90,61,0.08)` bg, no border
- MEDIUM: `--warning` text, `rgba(183,121,31,0.08)` bg
- LOW: `--error` text, `rgba(229,62,62,0.08)` bg
- Font: JetBrains Mono 11px, uppercase, letter-spacing 0.5px

---

## Buttons

```css
/* Primary — used for "Continue →", "Generate Protocol →" */
.btn-primary {
  background: var(--off-black);
  color: #fff;
  padding: 12px 24px;
  border-radius: var(--r-btn);
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 14px;
  font-weight: 500;
  min-height: 44px;
}

/* Green — used for "✓ Approve" (only once per flow) */
.btn-approve {
  background: var(--green);
  color: #fff;
  width: 100%;
  /* same shape as btn-primary */
}

/* Secondary — used for "↺ Return to AI" */
.btn-secondary {
  background: transparent;
  color: var(--off-black);
  border: 1px solid var(--border);
  /* same shape as btn-primary */
}

/* Ghost/link — used for "⚠ Escalate", "← Start new protocol" */
.btn-ghost {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* Disabled state — all button types */
.btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  pointer-events: none;
}
```

---

### Iteration Context Strip

Shown below the step bar on iterations 1-3. Hidden on iteration 0.

```css
.iteration-strip {
  background: var(--tool-card);
  border-bottom: 1px solid var(--tool-card-border);
  padding: 12px 40px;
  display: flex;
  align-items: center;
  gap: 24px;
}
.iteration-strip-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--tool-label);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.iteration-strip-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--off-black);
}
.iteration-strip-blacklist {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--audit-fail);
}
```

Content: `ITERATION 2 OF 3 · Adjusting for Week 3` | `Target entering: 65g/hr` | `Blacklisted: [product names]`

---

### Athlete Session Home Screen

Shown when Bek opens an in-progress athlete session (after iteration 0 is exported and `step === 'awaiting_feedback'`).

```css
.session-home {
  max-width: 640px;
  margin: 40px auto;
}
.session-header {
  margin-bottom: 24px;
}
.iteration-progress {
  background: var(--tool-card);
  border: 1px solid var(--tool-card-border);
  border-radius: var(--r-card);
  padding: 0;
  overflow: hidden;
}
.iteration-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--tool-card-border);
  min-height: 48px;
}
.iteration-row:last-child { border-bottom: none; }
.iteration-row.completed .iter-icon { color: var(--green); }
.iteration-row.active .iter-icon { color: var(--off-black); }
.iteration-row.pending .iter-label,
.iteration-row.pending .iter-meta { color: var(--muted); }
.iter-label {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 14px;
  font-weight: 500;
  flex: 1;
}
.iter-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--tool-label);
}
.iter-delta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--audit-flag);  /* amber — adjustment delta */
}
```

---

### Prior Iterations Panel (Step 4 — Review)

Collapsible panel below the side-by-side review layout.

```css
.prior-iterations {
  margin-top: 16px;
  border: 1px solid var(--tool-card-border);
  border-radius: var(--r-card);
  overflow: hidden;
}
.prior-iterations-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: var(--tool-card);
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--tool-label);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.prior-iterations-body {
  padding: 0;
  display: none;  /* toggle via JS */
}
.prior-iterations-body.open { display: block; }
.prior-iter-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  border-top: 1px solid var(--tool-card-border);
  background: var(--tool-card);
}
.prior-iter-date {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--tool-label);
  width: 80px;
}
.prior-iter-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--off-black);
  flex: 1;
}
.prior-iter-view {
  font-size: 13px;
  color: var(--green);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
```

Hidden on iteration 0 (no prior iterations exist).

---

### Adjustment Summary (Step 4 — Review, right panel addition)

Shown below the dimension score rows on iterations 1-3.

```css
.adjustment-summary {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--tool-card-border);
}
.adjustment-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--tool-label);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}
.adjustment-row {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--off-black);
  padding: 4px 0;
}
.adjustment-delta-pos { color: var(--audit-pass); }   /* +5g/hr — green */
.adjustment-delta-neg { color: var(--audit-flag); }   /* −10g/hr — amber */
.adjustment-blacklist { color: var(--audit-fail); }   /* blacklisted — red */
```

Content example:
```
ADJUSTMENTS APPLIED
−10g/hr  GI distress (Week 1, rating 4/5)
BLACKLISTED  Maurten Gel 100 CAF
```

---

## Accessibility (Desktop — minimal but correct)

- All interactive elements: `min-height: 44px`
- Upload zones: keyboard-accessible (Tab + Enter to trigger file picker)
- SSE progress container: `aria-live="polite"` — screen reader announces each step
- Red flag block: `role="alert"` — screen reader announces immediately
- Error messages: `aria-live="polite"` on error containers
- Focus rings: `outline: 2px solid var(--off-black)`, `outline-offset: 2px`, on all interactive elements
- Color contrast: all text on --sand or #fff backgrounds meets WCAG AA (verified: --off-black on --sand = 16.7:1)

---

## NOT in scope for this design system

- Mobile/tablet responsiveness (localhost desktop tool — single user on one machine)
- Dark mode (user chose light surface)
- Consumer-facing marketing patterns
- Animated illustrations or brand mascots
- Complex data visualisations (not in v1 scope)

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-26 | Light surface — `--sand #f6f5f4` | Consistent with consumer site; calm for long sessions |
| 2026-03-26 | Plus Jakarta Sans (headings/body) | Already loaded site-wide; familiar, legible |
| 2026-03-26 | JetBrains Mono for labels & technical values | Precision-instrument feel for numeric data; not just for code |
| 2026-03-26 | `--green #2D5A3D` as single accent | Approve = green is semantically obvious; single accent avoids complexity |
| 2026-03-26 | `--r-card 20px`, `--r-btn 36px` | Consistent with consumer site |
| 2026-03-26 | Industrial/Utilitarian aesthetic | Internal productivity tool; UI should be invisible; work is the hero |
| 2026-03-26 | Generous line-height (1.8) in protocol draft | Bek reads clinical nutrition data; needs space to process before approving |
| 2026-03-26 | Top step bar (not sidebar) | Always visible; current step obvious; calmer during 25s AI wait |
| 2026-03-26 | Side-by-side review layout (70/30) | Audit verdict stays in view while reading protocol |
| 2026-03-26 | Full-step block for red flags (no override) | All 3 ToS §3 conditions are hard stops; no ambiguity |
| 2026-03-26 | Design system created | `/design-consultation` — sole user (Bek), internal tool |
| 2026-03-26 | Iteration context strip (below step bar) | Always-visible reminder of which iteration Bek is on; shows carb target + blacklist |
| 2026-03-26 | Athlete session home screen | Landing point when returning to in-progress athlete; shows iteration progress at a glance |
| 2026-03-26 | Prior iterations panel in Review step | Collapsible; Bek can reference earlier protocols without leaving the review step |
| 2026-03-26 | Adjustment delta colours (amber/green/red) | Amber = carb reduction (caution); green = carb increase (progress); red = blacklist — semantically obvious |
