# TODOS — RIK Athletica

Last updated by /plan-ceo-review on 2026-03-26

---

## ✅ DONE

- **Bundle standalone checkout** — Separate thank-you flow for ?type=bundle vs ?type=sprint. Done 2026-03-23.
- **Rewardful key swap** — API key 73b07c wired across all pages. Done 2026-03-24.
- **Calculator email gate** — EmailGate component + Resend endpoint live. Done 2026-03-26.
- **Privacy Policy + Terms of Service** — Full content pages live at /privacy and /terms. Done 2026-03-26.
- **Typeform intake link** — Wired on /thank-you?type=sprint. Done 2026-03-26.
- **Resend /api/leads endpoint** — Serverless function built and deployed. Needs API key to activate.

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

### P1 — Internal Protocol Generation Tool
**What:** An internal-only web page (password-protected or localhost only) where:
1. Upload athlete's Typeform intake CSV + any attachments (training plan, screenshots)
2. AI pipeline runs RIK methodology:
   - Layer 1 analysis: carb requirement (g/hr), sodium requirement (mg/hr), caffeine threshold — using intake data + race distance + training load
   - Layer 1 generation: product selection from products.csv + dosing schedule mapped to race/training timeline
   - Layer 1 audit: check for GI risk flags, caffeine sensitivity, known allergies
   - Layer 2 analysis: gut training progression plan (weeks 1-4), current intake vs target
   - Layer 2 generation: week-by-week gut training schedule + product introduction timeline
   - Layer 2 audit: check timeline vs race date, no new products in final 7 days rule
3. Exports two files for Bek to review before sending:
   - **Protocol PDF**: formatted document with analysis summary, Layer 1 dosing table, Layer 2 gut training calendar, race-week hour-by-hour plan
   - **Calendar .ics file**: each training session has a calendar event with that session's protocol (what to take, when, dosing)
4. Bek reviews both files → sends to athlete

**Why this matters:** Reduces protocol build time from 3 hours to 30-45 min. Makes Sprint scalable past 10 customers. Makes the product consistent and auditable.
**Architecture:** Next.js or plain HTML/JS internal page. Claude API for analysis + generation. puppeteer/playwright for PDF export. ics library for calendar file.
**Effort:** L (human: 2-3 weeks / CC+gstack: 2-3 sessions)
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

## NOT in scope (this planning session)

- Protocol generation pipeline AI methodology design — needs dedicated /plan-eng-review session
- Paid advertising (FB/IG ads) — defer until organic channels validated and LTV known
- Ambassador programme beyond affiliates — defer until brand has earned athlete trust
- Mobile app — not needed at this revenue stage
- Custom checkout (replacing Stripe Payment Links) — Stripe Links are fine up to $500K ARR
