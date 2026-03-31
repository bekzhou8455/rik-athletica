# Changelog — RIK Athletica

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.1.0] — 2026-03-31 — Protocol Engine Prep

### What you can do now

- **Generate protocols with deterministic validation** — a new pre-auditor validator (`lab/lib/validator.ts`) catches hallucinated g/hr numbers and unapproved products before the LLM auditor call. If numbers are physically impossible, the pipeline stops rather than wasting a costly LLM call on broken output.
- **Specify how many weeks to generate** — a 1/2/3/4 week picker in the tool UI lets the operator control protocol length per athlete.
- **Upload race splits CSV** — paste in a Garmin/Strava export and the tool extracts swim/T1/bike/T2/run segment times to inform bracket assignment.
- **Configure bike type and race conditions** — standard cages, aero bars, or integrated reservoir; cool/temperate/hot/extreme temperature. Both affect bottle placement instructions and electrolyte dosing in the generated protocol.
- **Medical screening fields** — Typeform medical columns (conditions, medications, history) flow through the pipeline. Red flag checker now parses prescription medications and flags unknown medication combinations.

### Added

- `lab/lib/validator.ts` — deterministic pre-auditor validator. Checks: g/hr ceiling (120g/hr absolute max), caffeinated gel on bike (never), run/bike ratio anomaly (>90% of bike), competitor brand detection. Also builds supply list with units-to-order and estimated cost.
- `lab/lib/analysis.ts` — race fueling analysis module
- `lab/lib/split-parser.ts` — CSV splits parser for race segment timing
- `lab/PROTOCOL_SCIENCE.md` — science reference document for internal use and architect AI context
- `lab/mockup/` — sample intake.csv and training-plan.csv fixtures for local testing

### Changed

- `lab/lib/types.ts`: `hasGutTrained: boolean` → `gutTrainingStatus: 'none' | 'partial' | 'trained'`. Added race logistics fields (`bikeConfig`, `raceType`, `raceTemperature`, `maxComfortableCarbsPerHour`), medical screening fields (`currentConditions`, `medications`, `medicalHistory`), and `splitsData` on `SessionState`.
- `lab/lib/protocol-formatter.ts`: added `formatCarrySheet()` — one-page race-day pocket guide extracted from rawMarkdown.
- `lab/lib/red-flag-checker.ts`: major expansion — medical condition detection, prescription medication parsing, unknown medication soft-flag.
- `lab/lib/intake-parser.ts`: parses new race logistics and medical columns from Typeform intake.
- `lab/prompts/architect-system.md`: full science foundation rewrite — bracket targets, gut training modifier, GI history modifier, rounding rules, run carb differential (bike × 0.65), MTC requirement, realistic bike nutrition guidance, Layer 2 Refuel substitution logic, race day plan structure, carry sheet format.
- `lab/prompts/auditor-system.md`: auditing criteria aligned with new architect spec.
- `lab/serve.ts`: validator wired between architect and auditor; splits upload and race logistics context passed to prompt builder; gutTrainingStatus replaces hasGutTrained.
- `lab/tool.html`: weeks picker, splits upload, bike config and race temperature selectors.
- `lab/products.csv`: updated SKU catalogue with correct pricing and unit descriptions.

---

## [1.0.0] — 2026-03-23 — Initial Launch Build

### What you can do now

- **Buy the Sprint ($499)** — full 4-week protocol coaching + product box. Stripe checkout → post-purchase Typeform intake → protocol built within 48hrs → box ships within 5 days.
- **Buy the Bundle ($119)** — 10 Euphoria + 20 Refuel standalone. Stripe checkout → confirmation page → box ships within 5 days.
- **Calculate your time loss** — answer 4 questions about your race, GI history, and fueling strategy. Get a personalised estimate of how many minutes you're leaving on the course and why.
- **Arrive via affiliate link** — `/ref/[slug]` sets the Rewardful affiliate cookie before redirecting to the Sprint page. Coaches and ambassadors get credited automatically.

### Pages shipped

| Page | Route | Description |
|------|-------|-------------|
| Home / DTC | `/` | Product overview, bundle purchase, calculator CTA |
| Sprint | `/sprint` | 4-week programme deep-dive — science, protocol, pricing |
| Calculator | `/calculator` | Nutrition time-loss calculator with personalized results |
| Thank You | `/thank-you` | Post-purchase: Sprint shows Typeform intake CTA; Bundle shows shipping timeline |
| 404 | any unknown route | Branded error page that keeps visitors in the funnel |

### Infrastructure

- Bun static file server (`serve.ts`) with route map and `/ref/[slug]` affiliate redirect
- Rewardful affiliate tracking on all pages (key placeholder — swap before launch)
- 4 passing unit tests for calculator logic (`calculator.test.ts`)
- `.gitignore` for backups, `.gstack/`, `.DS_Store`

### Design

- Design Score: **A−** (post /design-review)
- AI Slop Score: **B** — no purple gradients, no floating blobs, no emoji decoration
- 4 design issues found and fixed: nav touch targets, calendar grid mobile collapse, invalid `<a><button>` nesting, thank-you timeline mobile stacking

### Pending before launch

- Swap `REWARDFUL_KEY_PLACEHOLDER` with real Rewardful API key
- Verify WCAG contrast on `#aaa`/`#bbb` muted text colors
