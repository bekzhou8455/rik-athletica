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
- Sprint: `https://buy.stripe.com/00waEZ6Wq1441uC6ow7Re01`
- Bundle: `https://buy.stripe.com/4gM7sN6Wq3cc7T0fZ67Re00`

**Typeform intake URL:** `https://form.typeform.com/to/XT5Qo0HD`

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

## See also

- `README.md` — setup and route map
- `TODOS.md` — roadmap and deferred items
- `CHANGELOG.md` — version history
