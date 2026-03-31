# TODOS — RIK Athletica

Last updated by /plan-ceo-review on 2026-03-27

---

## ✅ DONE

- **Bundle standalone checkout** — Separate thank-you flow for ?type=bundle vs ?type=sprint. Done 2026-03-23.
- **Rewardful key swap** — API key 73b07c wired across all pages. Done 2026-03-24.
- **Calculator email gate** — EmailGate component + Resend endpoint live. Done 2026-03-26.
- **Privacy Policy + Terms of Service** — Full content pages live at /privacy and /terms. Done 2026-03-26.
- **Typeform intake link** — Wired on /thank-you?type=sprint. Done 2026-03-26.
- **Resend /api/leads endpoint** — Serverless function built and deployed. Needs API key to activate.
- **thefeed.com product scrape** — 60 SKUs (Maurten, GU, SiS, PF&H, UCAN, Clif, Näak) written to lab/products.csv. Done 2026-03-26.

---

## PHASE 0 — Before First Customer (do this week)

---

### P1 — Stripe payment notification
**What:** Get an instant notification (email or SMS) every time a payment clears on Stripe.
**Why:** Without this, a Sprint customer could wait days for intake acknowledgement while you're unaware they paid. This is a customer service failure before day one.
**How:** Stripe Dashboard → Developers → Webhooks → add endpoint. OR simpler: Stripe Dashboard → Settings → Email notifications → enable "Successful payments" email to your address. Takes 2 minutes.
**Effort:** XS (human: 5 min / CC: not needed)
**Depends on:** Nothing. Do this today.

---

### P1 — Resend domain verification + email activation
**What:** Complete Resend setup so calculator leads receive the follow-up email.
**Why:** The /api/leads endpoint is deployed and will call Resend — but Resend can't send from hello@rikathletica.com until the domain is verified. Every calculator completion is currently a warm lead going cold.
**How:**
1. Sign up at resend.com (free: 3,000 emails/month)
2. Add domain rikathletica.com → copy the 3 DNS records it gives you
3. Add those DNS records in WIX dashboard → DNS Settings
4. In Vercel dashboard → rik-athletica-v2 → Settings → Environment Variables → add RESEND_API_KEY = your key (starts with re_...)
5. Redeploy: `~/.bun/bin/bunx vercel --prod`
**Effort:** XS (human: 20 min / CC: 5 min for redeploy)
**Depends on:** Resend account signup

---

### P1 — Vercel Analytics (1-click, free)
**What:** Enable Vercel's built-in analytics to see visitors, page views, and top-performing pages.
**Why:** Without it you're blind to whether GTM channels are driving traffic. Are tri club partners sending anyone? Is the calculator page getting organic visits?
**How:** Vercel Dashboard → rik-athletica-v2 → Analytics tab → Enable. No code changes needed.
**Effort:** XS (human: 2 min / CC: not needed)
**Depends on:** Nothing.

---

### P1 — Customer tracker spreadsheet (simple CRM)
**What:** A Google Sheet or Airtable base with one row per customer: name, email, Stripe order ID, product purchased, intake status, protocol sent date, box shipped date, check-in week.
**Why:** Without it, customers exist across Stripe + Typeform + inbox with no central view. At 5 customers you'll lose track. At 10 it's chaos.
**How:** Create a Google Sheet today. Columns: Customer Name | Email | Product | Stripe Order ID | Payment Date | Intake Submitted? | Protocol Sent Date | Box Tracking # | Week 1 Check-in | Week 4 Check-in.
**Effort:** XS (human: 30 min)
**Migrate to Airtable at:** 10 customers (Airtable supports automation, Zapier webhooks, views by status)
**Depends on:** Nothing.

---

### P1 — Intake deadline tracker
**What:** A system to track whether Sprint customers complete Typeform within 7 days of payment.
**Why:** If they don't complete intake, the protocol never gets built. No system = you discover this 2 weeks later when they email asking where their protocol is.
**How (manual):** When a Sprint payment comes in, set a 7-day calendar event "Follow up [Name] — intake overdue?". If intake isn't in Typeform by day 7, send a manual nudge email.
**How (Typeform-native):** Typeform → Notifications → Reminder emails for incomplete responses. Configure once.
**Effort:** XS (human: 15 min)
**Depends on:** Customer tracker spreadsheet (to log intake status)

---

### P1 — 4-week check-in email templates
**What:** Email templates for the 3 key Sprint touchpoints: Week 1 (gut training check-in), Week 3 (mid-protocol performance review), Week 4 (race-week protocol + final brief).
**Why:** The check-in cadence IS the Sprint product — it's what differentiates $499 from just buying gels. Without templates, each check-in is 30 minutes of writing. With templates: 5 minutes to personalise.
**Content to cover:**
- Week 1: "How is gut training going? Any GI discomfort? Rate 1-5. What was your longest training session this week?"
- Week 3: "How's carb intake tracking? Sharing your pacing data this week. Protocol adjustment if needed."
- Week 4: "Race week protocol: your hour-by-hour fueling plan. Final brief."
**Effort:** S (human: 3 hours / CC: 45 min)
**Depends on:** Nothing. Draft before first customer.

---

### P1 — Tri club coach outreach assets
**What:** (A) A 1-page PDF explaining the RIK Sprint affiliate partnership: what it is, what athletes get, what the coach earns, how the link works. (B) A coach one-liner to post/share. (C) A personalised /ref/[slug] Rewardful link for each partner.
**Why:** Outreach without leave-behind materials has a 3x lower close rate. Coaches need something to look at between your conversation and their decision.
**How:** Create Rewardful affiliate link for each coach at rewardful.com → Partners. Design the PDF (Canva or similar). Use the formats from the website design system.
**Effort:** S (human: 4 hours / CC: 1 hour for copy)
**Depends on:** Rewardful account active (already done)

---

### P1 — Coach outreach DM + email template
**What:** A ≤150-word outreach message for Instagram DM or email. Leads with athlete outcome, not product pitch. Ends with a clear ask (15-min call or "interested?").
**Why:** Cold outreach without a tested template leads to inconsistent messaging and low response rates.
**Draft angle:** "Hi [Coach Name] — I built a 4-week fueling protocol specifically for IRONMAN/70.3 athletes. Most of your athletes are leaving 20-40 minutes on course from GI issues and carb deficits alone — I've mapped the science to a structured system. Would love to share it with your training group. Happy to set up a 15-min call or send you the details."
**Effort:** XS (human: 1 hour to test 3 versions)
**Depends on:** Outreach assets (PDF)

---

### P1 — thefeed.com product scrape (Scrapling)
**What:** Scrape The Feed (thefeed.com) for all relevant endurance nutrition SKUs: carb gels, chews, bars, drink mixes, electrolyte tabs. For each SKU: product name, brand, size/serving count, carbs per serving (g), sodium per serving (mg), caffeine per serving (mg if applicable), price, URL.
**Why:** This becomes the product database the protocol engine uses to recommend and dose specific products. Also informs which SKUs to pre-stock at ShipWizard.
**How:** Use Scrapling (python library, great for JS-rendered sites) to crawl thefeed.com category pages. Output: products.csv with structured fields.
**Target categories:** Gels, Chews, Bars, Drink Mixes/Hydration, Electrolytes
**Target brands:** Maurten, SIS, PF&H (Precision Fuel & Hydration), GU, Clif, Näak, Precision Hydration, UCAN
**Effort:** S (human: 4 hours / CC: 45 min with Scrapling)
**Output:** products.csv — ~200-400 rows
**Depends on:** Nothing. Do before protocol engine.
**Note:** Scrapling handles JS-rendered pages well. Use respectful crawl rate (1 req/2s). Check robots.txt first.

---

### P1 — Coach and tri club target lists
**What:** Two structured lists: (A) 50-100 qualified IRONMAN/70.3 coaches (TrainingPeaks coach directory + USAT certified coach directory). (B) 50-100 tri clubs with active IRONMAN programs (USAT club directory + Google + Facebook groups + Slowtwitch).
**Why:** You need qualified targets before outreach. "Spray and pray" wastes time. Qualified = coaching athletes at IRONMAN/70.3 distance, 50+ member clubs with race-focused programs.
**How:** Scrape TrainingPeaks coach directory (filter: triathlon, coaching), USAT coach/club search. Export to CSV. Columns: Name | Club/Org | Location | Email/Instagram | Athletes coached | Distance focus | Notes.
**Effort:** M (human: 2 days / CC: 2 hours with scrapers)
**Output:** coaches.csv + triclubs.csv
**Depends on:** Nothing.

---

## PHASE 1 — After First 5 Customers

---

### P1 — Protocol Generation Tool: Deterministic Engine Rebuild
**What:** Replace the LLM Architect with a TypeScript protocol engine. Keep: pipeline (build→validate→audit→approve), tool.html UI, science docs, products catalogue. Rebuild: the generation core.

**Architecture decision (from /plan-ceo-review 2026-03-31):**
- Hybrid approach: deterministic engine for all numbers, LLM prose layer for narrative
- Engine computes: bracket, g/hr targets, products, Euphoria/Refuel placement, gut ramp, race-day plan
- LLM writes: session notes, assumption flags, carry sheet tips (500 tokens, not 3000+)
- Validator + Auditor AI unchanged (auditor should now PASS on first try, always)

**New files to build:**
```
lab/lib/protocol-engine/
  bracket.ts           ~80 LOC
  targets.ts           ~120 LOC
  product-selector.ts  ~150 LOC
  placer.ts            ~100 LOC
  race-day.ts          ~200 LOC
  session-planner.ts   ~150 LOC
  gut-ramp.ts          ~40 LOC
  index.ts             ~80 LOC
lab/prompts/prose-system.md
```

**Why:** LLM Architect was executing a formal rule system (276-line prompt) probabilistically. Rules that should be code. Deterministic engine: zero hallucinated numbers, zero revision loops, 10x cheaper generation step.

**Plan doc:** `~/.gstack/projects/bekzhou8455-rik-athletica/ceo-plans/2026-03-31-deterministic-protocol-engine.md`
**Effort:** M (human: 2-3 days / CC+gstack: 1 session)
**Depends on:** Run `/plan-eng-review` before coding.
**Priority:** P1 — block on this before taking any new customers.
**Depends on:** products.csv from thefeed.com scrape (TODO above). Requires /plan-eng-review before build.
**Note:** This is the core product IP — design carefully. Plan its own dedicated session.

---

### P1 — Website copy + positioning update: "Outsource your fueling to the pro"
**What:** Rewrite homepage hero, Sprint page intro, and key section headers around the positioning discussed in /office-hours: "Outsource your fueling to the pro." Lead with the outcome (time recovered), lead with the professional handling it (not the product ingredients).
**Why:** Current copy describes what the product IS. The new positioning speaks to what the athlete GETS — a pro-grade fueling system without having to become a nutrition scientist themselves. This is clearer, more differentiated, and more emotionally resonant for the target buyer.
**Key copy changes:**
- Homepage hero: from product description → "Stop guessing. Outsource your fueling to the pro."
- Sprint page: clarify 4-week program structure (currently references 12 weeks in some places)
- Add social proof placeholders (testimonial slots ready for first customers)
- Calculator → "Find out how much time you're losing" remains strong, keep
- Emphasize two-layer protocol + gut training as the differentiator (vs "just another gel")
**Effort:** M (human: 1 week / CC: 1 session)
**Depends on:** Final sign-off on positioning from Bek. Requires /plan-design-review before implementing layout changes.

---

### P2 — 3-email Resend nurture sequence
**What:** Two follow-up emails after the initial results email (Day 0):
- Day 2: "Here's what's actually happening in your gut" — GI science deep-dive, introduces gut training concept, CTA to Sprint.
- Day 5: "An athlete like you, before/after" — placeholder for first real case study. Write a generalised athlete story before real data, replace when available.
**Why:** Not all buyers convert on first contact. A 3-touch sequence recovers the 60-70% who were interested but didn't act immediately.
**Depends on:** Resend activated (TODO above). Day 5 email ideally uses real customer story.
**Effort:** S (human: 1 day / CC: 1 hour)

---

### P2 — ShipWizard Bundle auto-fulfillment
**What:** Configure ShipWizard to auto-receive and fulfill Bundle orders without manual intervention.
**Why:** Bundle orders have a fixed SKU (10 Euphoria + 20 Refuel). No protocol needed. ShipWizard already has the inventory. Auto-fulfillment removes a manual task per Bundle order.
**How:** Stripe webhook → ShipWizard order creation via their API or integration. Sprint orders remain manual (box contents vary per protocol).
**Important:** Sprint orders ALWAYS need manual ShipWizard push after protocol build — box contents are protocol-specific. Do NOT auto-fulfill Sprint orders.
**Effort:** M (human: 1 week / CC: 2 hours — confirm ShipWizard API capability first)
**Depends on:** Confirm ShipWizard webhook/API capability for custom-site orders. Do after 5 manual orders to understand the flow.

---

### P2 — Typeform → Airtable → Bek notification (Zapier)
**What:** When an athlete submits the intake form, automatically: (1) create an Airtable record, (2) send Bek a notification email with the intake summary.
**Why:** Currently Bek must check Typeform manually. At 10+ customers/month this becomes the daily admin task.
**How:** Typeform → Zapier → Airtable + Gmail/Resend notification
**Cost:** ~$20/mo Zapier (or Make.com equivalent)
**Effort:** S (human: 4 hours / CC: 1 hour)
**Depends on:** First 10 customers using manual flow to confirm intake questions are right before automating.

---

## PHASE 2 — Scaling (20+ customers/month)

---

### P2 — Pricing test
**What:** After first 10 Sprint customers, test $499 vs $599 vs $699.
**Why:** $499 may be underpriced for exec/business owner athlete profile who spends $5K on a bike frame. Even a $100 increase = 20% revenue lift with no extra cost.
**How:** Alternate Stripe Payment Link in /sprint between price points. 2 weeks per price point, min 10 customers per data point.
**Effort:** XS (human: 2h / CC: 5 min)
**Depends on:** First 10 paying Sprint customers.

---

### P3 — WCAG contrast check on muted text
**What:** Verify #aaa and #bbb text colors meet WCAG AA (4.5:1 body, 3:1 large text) on white backgrounds.
**Why:** Eyebrow labels and descriptors may fall below accessibility threshold.
**How:** Run through webaim.org/resources/contrastchecker or axe DevTools.
**Effort:** XS (< 30 min)
**Found by:** /design-review 2026-03-23

---

### P3 — WebP image conversion
**What:** Convert media assets from JPEG to WebP. Euphoria_back.jpg at 4MB causes slow LCP.
**Why:** Google PageSpeed will flag this. Mobile visitors on LTE see perceptible load delay.
**How:** Run through cwebp or Squoosh. Replace .jpg src refs with .webp. Host on jsDelivr CDN (already set up).
**Effort:** XS (human: 30 min / CC: 10 min)
**Found by:** /design-review 2026-03-24

---

### P3 — Resend contact audience export
**What:** Configure Resend to store all captured emails in a named Audience (not just ephemeral logs).
**Why:** Vercel function logs are ephemeral — if Resend is ever disrupted, email list is lost. Resend Audiences persist the contact list.
**How:** Resend Dashboard → Audiences → Create "Calculator Leads". Update /api/leads.js to also call Resend Contacts API to add email to audience.
**Effort:** XS (human: 30 min / CC: 15 min)
**Depends on:** Resend domain verified (TODO above).

---

---

## SPRINT v2 — Race Pack Model (from /plan-ceo-review 2026-03-27)

---

### P1 — Sprint v2 full implementation
**What:** Implement the Sprint v2 Race Pack model (updated scope from /plan-eng-review 2026-03-27). Full scope:

**MANUAL PRE-WORK (you do these in dashboards first):**
1. Create 2 Dropbox Sign templates (Full Ironman, 70.3). Do NOT set signing_redirect_url in the template — the API passes it per-request from env vars.
2. Create 2 new Stripe Payment Links ($649 Full Ironman, $549 70.3). Note both URLs.
3. Build Typeform Screening Form (see separate TODO below for full spec).
4. Update Typeform Full Intake: add race_date (date), race_distance (Full/70.3), brand_preference (Maurten/GU/PF&H) fields. Note each field's `ref` value from Typeform dashboard. Add 28-56 day Logic Jump validation (branch to fail endings). Configure webhook → `https://prod-domain/api/intake`.
5. Add env vars (Vercel dashboard + .env.local): DROPBOX_SIGN_API_KEY, DROPBOX_SIGN_TEMPLATE_FULL, DROPBOX_SIGN_TEMPLATE_703, STRIPE_LINK_FULL, STRIPE_LINK_703, INTERNAL_ALERT_EMAIL, TYPEFORM_WEBHOOK_SECRET, RESEND_API_KEY (verify).
6. Pre-order Race Pack standing stock to ShipWizard before first customer.

**CODE (CC+gstack builds after manual pre-work):**
7. Build `/api/create-sign-request.js` — POST: {name, email, distance, race_date, referral?} → Dropbox Sign API → returns {signingUrl}. Constructs signing_redirect_url from STRIPE_LINK_FULL/STRIPE_LINK_703 env vars, appends ?via= if Rewardful referral present.
8. Build `/api/screen.js` — Typeform screening webhook: FAIL submission → Resend email to INTERNAL_ALERT_EMAIL ("Blocked: [name], reason: [reason]").
9. Build `/api/intake.js` — Typeform full intake webhook: immediate Resend emails (internal Race Pack alert + athlete confirmation).
10. Rewrite sprint.html: two tiers ($649/$549), CTA → Typeform screening form link (replaces old Stripe link), URL-param-triggered auto-sign section (activated when ?screen=pass params present), two-box "What's in your box" section, updated hero copy.
11. Update wireframe.html: service upsell CTA price ($499 → from $549) and copy.
12. Deactivate old $499 Stripe link after first v2 customer confirms full flow.

**Why:** Current Sprint = training products only, no race gate, no contract, no Race Pack. Promise/delivery gap. v2 closes it with screening → contract → payment → Race Pack fulfillment.
**Plan doc:** `~/.gstack/projects/bekzhou8455-rik-athletica/ceo-plans/2026-03-27-sprint-race-pack.md`
**Eng review:** `~/.gstack/projects/bekzhou8455-rik-athletica/bekzhou-main-eng-review-test-plan-20260327-122951.md`
**Effort:** M (human: 1-2 days setup / CC+gstack: 2-3 hours code)
**Priority:** P1
**Depends on:** Items 1-6 above must be done manually first before any code is written.

---

### P1 — Typeform Screening Form setup
**What:** Build the Typeform screening form that gates Sprint enrollment before Dropbox Sign + payment. This is the first touch in the new v2 checkout flow.
**Fields to build:**
- Name (short text, required)
- Email (email, required)
- Race date (date, required)
- Race distance (radio: Full Ironman / 70.3, required)
- Training plan confirmation: "I currently have a structured training plan (from a coach or self-coached)" — must be YES to proceed. This service adds nutrition only; no training plan = not the right fit.
- Red flags checklist (multiple-select: athlete selects all that apply):
  - Uncontrolled diabetes or insulin therapy
  - Diagnosed heart condition (last 12 months)
  - Kidney disease or renal impairment
  - Severe food allergy (nuts, dairy, soy, gluten)
  - Currently pregnant or breastfeeding
  - Other: (free text)
**Logic Jump rules:**
- If race_date < 28 days from today → FAIL ending "Too close" ("We need at least 4 weeks. Email hello@rikathletica.com.")
- If race_date > 56 days from today → FAIL ending "Too far" ("We build programs for races 4-8 weeks out. Come back when you're closer!")
- If training_plan = NO → FAIL ending "No training plan" ("Our service adds a nutrition layer on top of your training plan. Get one set first.")
- If any red flag selected → FAIL ending "Medical flag" ("Please consult your doctor before enrolling. Email hello@rikathletica.com if you have questions.")
- All pass → PASS ending → redirect to: `https://www.rikathletica.com/sprint?screen=pass&name={{name}}&email={{email}}&distance={{distance}}&race_date={{race_date}}`
**Webhook:** All submissions → `https://www.rikathletica.com/api/screen` (FAIL submissions trigger operator notification email)
**Why:** Without screening, any athlete can pay regardless of fit. The screening catches: too early/late for the service window, athletes without a training plan (service won't help them), and medical red flags that require clinical nutrition (not our service).
**Effort:** S (human: 1-2 hours in Typeform / CC: not needed — this is Typeform config only)
**Depends on:** Typeform Pro plan (user is on Pro — confirmed). Sprint v2 code must be deployed before the PASS redirect URL works end-to-end.

---

### P2 — Race Pack fulfillment backup channel via protocol gen tool
**What:** When the Typeform intake CSV is uploaded to the internal protocol generation tool (Phase 1), the tool should also extract race_date and display a "Race Pack ship by" date prominently on the protocol review screen. This gives a second visual channel for Race Pack reminders beyond the /api/intake email.
**Why:** The Typeform webhook → Resend email is a single point of failure. If the webhook silently fails (Typeform retries 3x and drops), no internal alert fires and the Race Pack ships late. The protocol gen tool upload step is always done manually by the operator, making it a reliable second channel.
**How:** When operator uploads intake CSV to protocol gen tool, the tool parses race_date, computes ship_by_date = race_date - 10 days, and shows a yellow banner: "Race Pack due to ShipWizard by [date] (ships [date] → arrives [race_date - 3 to -5])."
**Effort:** XS — add to protocol gen tool design when that tool is built. No separate implementation needed.
**Depends on:** Internal Protocol Generation Tool (Phase 1 P1).

---

### P3 — Race Pack standalone product
**What:** A $199 standalone Race Pack sold to athletes who already have their own training protocol but want done-for-you race-day product sourcing. New Stripe link, simple product page (or section on sprint.html). Ships ~10 days before athlete's race.
**Why:** Opens the Race Pack as a standalone revenue stream. Serves repeat Sprint customers on future races and referrals from Sprint alumni.
**Effort:** S (CC+gstack: 20 min)
**Priority:** P3 — launch after Sprint v2 has 10+ customers.
**Depends on:** Sprint v2 live and standing inventory established.

---

### P3 — Race Pack inventory reorder SOP
**What:** Document par levels and reorder triggers for Race Pack standing stock at ShipWizard: Maurten Gel 100, Maurten Drink Mix 320, PH 1000 Tubes. When to reorder, where to order (thefeed.com), how to submit to ShipWizard receiving.
**Effort:** XS (human: 30 min)
**Priority:** P3 — before volume makes manual tracking unreliable.

---

## NOT in scope (this planning session)

- Protocol generation pipeline AI methodology design — needs dedicated /plan-eng-review session
- Paid advertising (FB/IG ads) — defer until organic channels validated and LTV known
- Ambassador programme beyond affiliates — defer until brand has earned athlete trust
- Mobile app — not needed at this revenue stage
- Custom checkout (replacing Stripe Payment Links) — Stripe Links are fine up to $500K ARR
