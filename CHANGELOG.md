# Changelog — RIK Athletica

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
