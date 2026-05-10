# Launch sequence — what's done, what's left

## ✅ Done in this session

### Visual / IA / copy (4 pages on iter-5)
- **Bundle:** new hero + DTC product gallery (3 tabs × 8 packshots, enlarged) + matte-glass ingredient carousel + dynamic Three Moments illustration + clean refund banner with redesigned 30-day stamp
- **Sprint:** video hero (Final Video 1.mp4 trimmed 12s, 1280×720, first-frame poster) + marginal-gains copy throughout + closing-meta legibility scrim
- **Premium:** new hero (`premium-hero.jpg`, face/gel-focused bg-position) + MyHealthPrac-style hero icon-list + posh value-stack with strike-through + WhatsApp concierge section (RIK Direct, async-first) + founder-note removed + clean refund-near-CTA banner
- **Calculator:** token swap to iter-5 (sand+ink, Outfit-only typography), green-accent dropped, italic ems → non-italic ink-soft

### Pre-launch task batch (this thread)
- **Premium eligibility form:** mirrors Sprint's screening pattern with race-distance + race-date (28–56d gate) + coach gate + experience gate + medical exclusion + cohort consent + refund consent + ToS. Stripe button is `aria-disabled` until all six gates pass. Failed click = scroll-to-form + red flash on first incomplete field.
- **Coached-athletes banner:** prominent ink+amber inline section above the screening form on both Sprint and Premium. Copy: "We Calibrate Fueling. Your Coach Calibrates Training." Reinforces the hard gate before the athlete fills the form.
- **Stripe Premium link:** `STRIPE_PREMIUM_LINK_TO_BE_SET` placeholder in markup. Setup guide at [`STRIPE_PREMIUM_SETUP.md`](./STRIPE_PREMIUM_SETUP.md) walks through product creation → payment link config → after-payment Typeform redirect → `sed` swap to wire it in.
- **WhatsApp Business plan:** full deployment plan at [`WHATSAPP_DEPLOYMENT.md`](./WHATSAPP_DEPLOYMENT.md) — account setup (eSIM + WhatsApp Business app), green-checkmark verification application, welcome/away messages, **strict rule: number is never published on the public website, only delivered post-payment**, lifecycle (Day 0 → Day +14), data hygiene, SLA + boundaries, future scaling.

## 🟨 Next phases (in order)

### Phase 3 — Email sequences
Resend templated emails for:
- Bundle: order confirmation, shipping notification
- Sprint: race-gate failure, screening pass + Dropbox Sign hand-off, intake form prompt, weekly check-in reminders, Race Pack ship notification
- Premium: enrollment confirmation, intake form prompt, weekly check-in, **RIK Direct go-live email (Day -7)** with the actual WhatsApp number, post-race debrief request
- All transactional emails: Bek.Zhou@rikathletica.com sender, brand-aligned templates

### Phase 4 — Deliverable + asset design
- Race Pack two-box packaging (training box + race pack labels)
- Athlete-facing PDF protocol guide (template per tier)
- Dashboard URL design (Premium race-week view)
- Emily Norman §1.6(b) live-placement approval batch PDF (compile all current usages of her quote/credit and send for sign-off)
- Founding Cohort welcome PDF (Premium tier — physical card or printable)

### Phase 5 — Legal & compliance check
- Privacy policy review for WhatsApp data flow + Stripe + Typeform + Dropbox Sign
- Terms of service: explicit Premium scope (fueling protocol service, NOT medical care, NOT coaching, NOT meal planning) — already drafted, needs review
- FDA disclaimer audit (every "supports / aids / boosts" claim has a † footnote)
- FTC disclosure: Emily Norman paid review disclosed adjacent to citation everywhere her quote appears
- GDPR/CCPA: data retention policy on intake forms, WhatsApp threads (18mo per WhatsApp plan), payment records (legal minimum)
- WhatsApp Business Terms: confirm we comply with Meta's commerce policy (we're a service provider, not a marketplace)

### Phase 6 — Push and deploy
- `git add` modified files + new assets + docs
- Single coherent commit with full changelog
- `git push origin main`
- `vercel --prod --yes`
- Wait for `readyState: READY`
- Curl-verify live URLs (every page returns 200, key markers present)
- Announce launch to existing waitlist
