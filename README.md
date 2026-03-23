# RIK Athletica — Website

Marketing and checkout site for RIK Athletica, an endurance sports nutrition brand targeting Ironman and 70.3 athletes.

## What's here

| File | Purpose |
|------|---------|
| `wireframe.html` | Home / DTC page — product overview, bundle purchase, calculator CTA |
| `sprint.html` | Sprint product page — 4-week coaching + supply programme |
| `calculator.html` | IRONMAN Nutrition Calculator — "how many minutes are you losing?" |
| `thank-you.html` | Post-purchase confirmation — Sprint intake flow or bundle ships message |
| `404.html` | Branded 404 page — keeps visitors in funnel |
| `serve.ts` | Bun static file server with route map and `/ref/[slug]` affiliate redirect |
| `calculator.test.ts` | Unit tests for calculator minute-loss logic (Bun test) |
| `TODOS.md` | Roadmap and deferred work items |

## Routes

| URL | Serves |
|-----|--------|
| `/` | wireframe.html (home) |
| `/sprint` | sprint.html |
| `/calculator` | calculator.html |
| `/thank-you` | thank-you.html (use `?type=sprint` or `?type=bundle`) |
| `/404` | 404.html (also served for unknown routes with HTTP 404 status) |
| `/ref/[slug]` | Affiliate redirect — sets Rewardful cookie, redirects to `/sprint` |
| `/assets/*` | Static media files |

## Running locally

Requires [Bun](https://bun.sh).

```bash
bun serve.ts
```

Starts on `http://localhost:3456`.

## Running tests

```bash
bun test calculator.test.ts
```

4 tests covering all calculator distance × GI-history combinations.

## Payment links

- **Sprint ($499):** `https://buy.stripe.com/00waEZ6Wq1441uC6ow7Re01`
- **Bundle ($119):** `https://buy.stripe.com/4gM7sN6Wq3cc7T0fZ67Re00`

Stripe redirects to `/thank-you?type=sprint` or `/thank-you?type=bundle` on success.

## Affiliate tracking

Uses [Rewardful](https://www.getrewardful.com). The JS snippet on every page uses `REWARDFUL_KEY_PLACEHOLDER` — swap with your real key when your Rewardful account is ready:

```bash
sed -i '' "s|REWARDFUL_KEY_PLACEHOLDER|YOUR_KEY|g" \
  sprint.html wireframe.html calculator.html thank-you.html 404.html
```

Affiliate links follow the pattern `/ref/[slug]` (e.g. `/ref/coach-sarah`). The server sets the Rewardful cookie and redirects to `/sprint`.

## Post-purchase intake

Sprint purchases redirect to `/thank-you?type=sprint`, which shows a CTA to complete the 10-minute Typeform intake:
`https://form.typeform.com/to/XT5Qo0HD`

The intake must be completed before the protocol can be built.

## Design system

- **Fonts:** Plus Jakarta Sans (300–800), JetBrains Mono (400)
- **Palette:** Off-black `#0a0a0a`, sand `#f6f5f4`, brand green `#2D5A3D`, accent `#4ade80`
- **Radii:** Cards `20px`, buttons `36px` (pill)
- **Spacing:** 8px base scale

Design audit: `.gstack/design-reports/design-audit-localhost-2026-03-23.md` — Design Score A−, AI Slop B.

## For contributors / Claude

See `CLAUDE.md` for project conventions, design tokens, and things not to do.

## Science references

- Pfeiffer et al. 2012 — carbohydrate oxidation and GI distress in Ironman
- Jeukendrup et al. 2000 — multiple-transportable carbohydrates
- de Oliveira et al. 2014 — GI symptoms and endurance performance
