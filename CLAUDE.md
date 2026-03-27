# RIK Athletica — Project Instructions for Claude

## What this project is

Static marketing + checkout site for RIK Athletica, an endurance sports nutrition brand. Built with plain HTML/CSS/JS, served by Bun. No framework, no build step, no bundler.

## Project structure

```
.
├── wireframe.html          # Home page (DTC, bundle purchase, calculator CTA)
├── sprint.html             # Sprint product page (4-week coaching programme)
├── calculator.html         # Nutrition time-loss calculator
├── thank-you.html          # Post-purchase confirmation
├── 404.html                # Branded 404 page
├── serve.ts                # Bun static file server
├── calculator.test.ts      # Unit tests for calculator logic
├── assets/
│   └── media/              # Images, video, logo
├── README.md
├── CHANGELOG.md
├── TODOS.md
└── VERSION
```

## Running

```bash
bun serve.ts         # Start dev server on http://localhost:3456
bun test calculator.test.ts   # Run tests (4 passing)
```

## Key conventions

**HTML files are standalone.** Each page is a single self-contained HTML file with inline `<style>` and `<script>`. No external CSS files, no JS modules. Keep it that way — the simplicity is intentional.

**Design system tokens** are defined in `:root` CSS variables at the top of each file:
- `--sand: #f6f5f4` · `--off-black: #0a0a0a` · `--green: #2D5A3D` · `--green-light: #4ade80`
- `--r-card: 20px` · `--r-btn: 36px`
- Spacing: 8px base scale

**Nav height is 56px.** Nav links must have `padding: 19px 0; display: flex; align-items: center;` to fill the full touch target. Do not reduce nav link padding.

**No `<a><button>` nesting.** Use `<a class="btn btn-primary">` directly. Interactive nesting is invalid HTML.

**Stripe Payment Links:**
- Sprint Full Ironman ($649): stored as `STRIPE_LINK_FULL` env var — do not hardcode in HTML
- Sprint 70.3 ($549): stored as `STRIPE_LINK_703` env var — do not hardcode in HTML
- Bundle: `https://buy.stripe.com/4gM7sN6Wq3cc7T0fZ67Re00`

**Typeform URLs:**
- Full intake: `https://form.typeform.com/to/XT5Qo0HD`
- Screening form: `https://form.typeform.com/to/XdU5A5FQ` (set as `TYPEFORM_SCREENING_URL` constant in sprint.html)

## Sprint v2 Architecture (Race Pack model)

**Flow:** Typeform screening → Dropbox Sign contract → Stripe payment → Typeform full intake → two-box delivery

**Two-box delivery:**
- Training Box: ships within 5 days of intake (Layer 1 products + RIK Bundle)
- Race Pack: ships ~10 days before race date (race-day products per final protocol)

**Race gate:** Athletes must have a confirmed race 28–56 days from sign-up. Validated server-side in `/api/create-sign-request.js`.

**API routes (Vercel serverless, `api/` directory):**
- `POST /api/create-sign-request` — creates Dropbox Sign request, returns signing URL
- `POST /api/screen` — Typeform screening webhook (FAIL → operator email)
- `POST /api/intake` — Typeform full intake webhook (sends Training Box + Race Pack emails)

**Required env vars (Vercel dashboard + `.env.local`):**
```
DROPBOX_SIGN_API_KEY          # from app.hellosign.com → API → API Keys
DROPBOX_SIGN_TEMPLATE_FULL    # template ID for Full Ironman service contract
DROPBOX_SIGN_TEMPLATE_703     # template ID for 70.3 service contract
STRIPE_LINK_FULL              # Stripe Payment Link URL for $649 Full Ironman
STRIPE_LINK_703               # Stripe Payment Link URL for $549 70.3
INTERNAL_ALERT_EMAIL          # operator email for race pack + screening alerts
TYPEFORM_WEBHOOK_SECRET       # signing secret (used by both /api/screen and /api/intake)
RESEND_API_KEY                # re_... from resend.com (sender: hello@rikathletica.com)
```

**Pre-work required before going live (manual, not code):**
1. Create 2 Dropbox Sign templates (Full Ironman + 70.3 service contract)
2. Create 2 Stripe Payment Links ($649 Full + $549 70.3), post-payment redirect to Typeform intake
3. Build Typeform screening form (race date, red flags, training plan — see TODOS.md)
4. Update Typeform full intake: add race_date, race_distance, brand_preference fields; note field refs → update `FIELD_REFS` in `api/intake.js`
5. Add all env vars to Vercel + `.env.local`

**Rewardful key:** Currently `REWARDFUL_KEY_PLACEHOLDER` in all HTML files. Swap when account is ready:
```bash
sed -i '' "s|REWARDFUL_KEY_PLACEHOLDER|YOUR_KEY|g" \
  sprint.html wireframe.html calculator.html thank-you.html 404.html
```

## Testing

Framework: **Bun test** (`bun:test`)
Test file: `calculator.test.ts`
Run: `bun test calculator.test.ts`

**Testing expectations:**
- 100% test coverage is the goal
- When writing new calculator logic, write a corresponding test
- When fixing a calculator bug, write a regression test
- When adding a new distance/condition combination, test all cases

## What NOT to do

- Do not add a build step, bundler, or package.json dependencies
- Do not create separate CSS files — keep styles inline in each HTML file
- Do not use a JS framework — plain vanilla JS only
- Do not commit `.gstack/` (it's gitignored) — design/QA reports live there locally
- Do not commit `wireframe.backup-*.html` files (gitignored)
- Do not change the Stripe payment link URLs without confirming with the operator

## Lab / Internal Tool

The `lab/` directory is a separate internal tool (port 3457) for building athlete protocols. It has its own design system.

**Read `lab/DESIGN.md` before making any visual or UI decisions in `lab/`.**

Key additions for `lab/` (beyond the shared tokens above):
- `--tool-label: #aaa` — JetBrains Mono labels (never use with Plus Jakarta Sans body text)
- `--audit-pass: #2D5A3D`, `--audit-flag: #b7791f`, `--audit-fail: #e53e3e` — verdict badges
- `--red-flag-bg: #fff5f5`, `--red-flag-border: #e53e3e` — hard-block panel
- Protocol draft line-height: 1.8 (not the default 1.5 — clinical data needs space)
- JetBrains Mono used for all numeric/technical values (g/hr, timing, session durations) — not just code

## See also

- `README.md` — setup and route map
- `TODOS.md` — roadmap and deferred items
- `CHANGELOG.md` — version history
- `lab/DESIGN.md` — internal tool design system
