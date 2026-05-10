# RIK Direct on WhatsApp for Business — Deployment Plan

**Status (as of 2026-05-09):** Account created and number registered — `+1 (626) 360-9822`. Profile setup in progress. Verified-business badge **not currently available** to us (Meta requires higher message volume + business documentation; we'll re-apply once we have that history). This doc is the operating manual.

**Direct link for any in-product or website use:** `https://wa.me/16263609822`
**Pre-filled message link (for support entry):** `https://wa.me/16263609822?text=Hi%20RIK%20%E2%80%94%20`

---

## Strategic shift from the original plan

The original plan said **"Premium customers only, post-payment, never published on the public website."** I'm revising that based on Bek's actual goals:

1. Get first-hand feedback from customers (Bundle, Sprint, Premium — all of them)
2. Solve customer problems quickly (pre- and post-purchase)
3. Convert warm leads (people on the fence about Sprint or Premium)

The number now serves **five distinct use cases at three different SLA tiers**. The Premium concierge promise is preserved by giving Premium customers a separate **routing tag** (so they get prioritized inside the same channel), not a separate number.

---

## The five use cases

### A — Race-week Premium concierge (HIGHEST priority)
- **Who:** Premium customers in the 7 days before their race
- **SLA:** 2-hour response, 06:00–23:00 ET, all 7 days of race week
- **Tone:** Calm, decisive, founder-voice. Anchored to their finalized protocol.
- **Routing:** Premium customers get a "PREMIUM" label inside WhatsApp Business. Threads with this label get answered before everything else.
- **Boundary:** Async-first. Not a phone line. Not on-call for medical emergencies — disclaimer in welcome message.

### B — Sprint customer support during the 4 protocol weeks
- **Who:** Sprint customers (any tier) actively running their protocol
- **SLA:** Same business day during the 4-week window. Otherwise 1 business day.
- **Tone:** Coaching-adjacent. Reinforces the weekly check-in loop.
- **Use:** Protocol questions ("Should I take Refuel before or after the brick?"), gut-tolerance issues, race-pack questions.
- **Routing:** "SPRINT" label.

### C — Bundle customer support
- **Who:** Bundle buyers (one-off product customers)
- **SLA:** 1 business day.
- **Tone:** Friendly, product-focused, upsell-aware (they are warm leads for Sprint).
- **Use:** Shipping questions, refund requests, "how do I take this?", "what's the difference between Euphoria and Refuel?"
- **Routing:** "BUNDLE" label. Auto-tagged from Stripe webhook on order.

### D — Warm-lead conversion (the new one)
- **Who:** Anyone on the public website who clicks the WhatsApp link before buying
- **SLA:** 1 business day. Not faster — the goal is qualification, not panic-selling.
- **Tone:** Consultative. Default reply is **a question, not a pitch.** Use Quick Replies (templates) to qualify in 2–3 messages.
- **Use:** "Sprint vs Premium?", "Should I do this with my coach?", "Race date?", "International shipping?", general doubt.
- **Routing:** "WARM-LEAD" label. After 7 days with no purchase → moved to "WARM-LEAD-COLD" and unsubscribed from outbound nudges.

### E — First-hand feedback collection (outbound)
- **Who:** Recent customers, batched
- **Cadence:**
  - Bundle: Day +30 from order — "How were the gels? Any GI issues? Honest feedback wanted, no pitch."
  - Sprint: Day +14 post-race — "How did race day go? What worked, what didn't?"
  - Premium: Day +14 post-race — same as Sprint, plus a phone call offer
- **Goal:** Three-line response, gut signals on protocol revisions
- **Method:** Manual founder-voice messages; **never automated**. WhatsApp doesn't allow proactive marketing without explicit opt-in via the original conversation, so we only do this with customers who replied to a transactional message in the past 24h, or who explicitly opted in at checkout.

---

## Where to expose the WhatsApp link on the website

| Surface | Show link? | Behavior |
|---|---|---|
| **Footer (all pages)** | ✅ Yes | Small "Talk to us on WhatsApp" link in the legal footer alongside Privacy + Terms. Single tap → `wa.me`. |
| **`/audit` after submission** | ✅ Yes | "Get more help — message us" CTA on the audit deliverable page. Pre-filled: `Hi RIK — about my audit ` |
| **`/calculator` after results** | ✅ Yes | "Discuss this with us" link below the results card. Pre-filled: `Hi RIK — I just used the calculator and ` |
| **`/bundle` page** | ✅ Yes (footer only) | Already covered by global footer. No inline CTA — keep purchase friction low. |
| **`/sprint` page** | ✅ Yes (in screening form) | "Questions before You apply? Message us." Pre-filled: `Hi RIK — I'm thinking about Sprint and ` |
| **`/premium` page** | ✅ Yes (next to Reserve CTA + the WhatsApp section already exists) | Pre-filled: `Hi RIK — I'm considering Premium and ` |
| **`/checkin` page** | ❌ No | Athlete-only utility page. Already noindexed. Adding WhatsApp here muddles the form's purpose. |
| **`/thank-you` page** | ⚠️ Premium tier only | The Premium thank-you card explicitly says the RIK Direct number is delivered via Day −7 email — **don't** expose it at thank-you-page time, or you break the scarcity/exclusivity framing of "race-week-only." |

The link itself should always be `https://wa.me/16263609822?text=<URL-encoded-prefilled>` so the message arrives pre-tagged, making it easier to triage.

### Footer link snippet (paste into iter-5 `footer.legal` block on each page)

```html
<a href="https://wa.me/16263609822?text=Hi%20RIK%20%E2%80%94%20"
   target="_blank" rel="noopener"
   data-track="whatsapp_open"
   style="color:rgba(255,255,255,.55);font-size:12px;letter-spacing:.06em;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
    <path d="M17.5 14.4c-.3-.2-1.7-.8-2-1-.3-.1-.4-.2-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.7-1.4-1.7-1.6-1.9-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.6-1.5-.9-2.1-.2-.5-.5-.5-.6-.5h-.5c-.2 0-.5.1-.7.4-.2.3-.9.9-.9 2.2 0 1.3.9 2.6 1.1 2.7.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.4.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.1.2-.5.2-1 .1-1.1-.1-.1-.3-.1-.6-.3zM12 0C5.4 0 0 5.4 0 12c0 2.1.5 4.1 1.5 5.8L0 24l6.4-1.4c1.7.9 3.6 1.4 5.6 1.4 6.6 0 12-5.4 12-12S18.6 0 12 0zm0 22c-1.9 0-3.6-.5-5.1-1.4l-3.7.8.8-3.6C3 16.2 2.5 14.1 2.5 12 2.5 6.7 6.7 2.5 12 2.5S21.5 6.7 21.5 12 17.3 22 12 22z"/>
  </svg>
  Talk to us on WhatsApp
</a>
```

I'll roll this into all six iter-5 footers in a follow-up commit if you greenlight the tier-A-through-E plan.

---

## WhatsApp Business profile setup — copy-paste ready

Open WhatsApp Business app → Settings → Business profile. Fill these fields exactly:

### Profile picture (the round avatar)

**Recommendation:** the `GI` mark you already have works at small sizes. Re-upload a higher-res version though — the current one looks fine but a 1024×1024 PNG with transparent background gives crisper rendering on retina displays and on Meta's verification review.

If You want options:
- **Option A:** Black `GI` mark on white background (current, minimal, recognizable in 32px)
- **Option B:** Black `GI` mark on warm-amber background (`#7a4a2a` from the iter-5 warm-img token) — connects WhatsApp to the brand's atmosphere
- **Option C:** Full `rik / athletica` wordmark — only legible at 200px+; not recommended for the tiny avatar circle

Recommendation: **Option A** for now (matches what you've already uploaded). Switch to B once we have the warm-amber asset prepped.

### Business information

| Field | Value |
|---|---|
| **Name** | `RIK Athletica` (already set ✓) |
| **Category** | `Sports` (already set ✓) — alternative: "Health & wellness" if Meta lets you switch later, more accurate |
| **Business description** (256 char max) | `Endurance sports nutrition for triathletes & ultrarunners. Layer 2 functional gels + 4-week personalized fueling protocols. RD-reviewed methodology. Race-day fueling, calibrated.` |
| **Business hours** | `Mon–Fri 09:00–18:00 ICT` (Bangkok time — Bek's timezone). Set "Open 24/7 except race week" if you want to claim race-week extended hours. |
| **Address** | Use Your registered business address. If You don't want it public, leave blank — it's optional. |

### Links

| Field | Value |
|---|---|
| **Website** | `https://www.rikathletica.com` |
| **Instagram** | `https://instagram.com/rikathletica` (or whichever handle You're using) |
| **Facebook** | leave blank if no presence yet |

### Contact information

| Field | Value |
|---|---|
| **Business email** | `Bek.Zhou@rikathletica.com` |
| **Phone** | `+1 (626) 360-9822` (already set ✓) |
| **Status / About line** (replace "Hello. I'm using WhatsApp Business.") | `Race-day fueling, calibrated. Async-first. Reply window M–F.` |

### Catalog (Products & services)

WhatsApp Business lets You publish a catalog of products. Use this to send product cards inline to warm leads. Suggested entries:

1. **The RIK Bundle** — `$119` — 30 functional gels (10 Euphoria + 20 Refuel). Photo: `assets/web/bundle-hero.jpg`. Link to `https://www.rikathletica.com/bundle`.
2. **4-Week Sprint — 70.3** — `$569` — Personalized 70.3 fueling protocol. Photo: a Sprint hero crop. Link to `https://www.rikathletica.com/sprint`.
3. **4-Week Sprint — Full Ironman** — `$659` — same.
4. **4-Week Sprint — Pro** — `$899` — same.
5. **Founding Cohort Premium** — `$1,599` — Done-for-you race fueling. Photo: `assets/web/premium-hero.jpg`. Link to `https://www.rikathletica.com/premium`.
6. **Free Methodology Audit** — `Free` — Submit a 2-min form, receive an audit deliverable in 48 hrs. Link to `https://www.rikathletica.com/audit`.

The audit-as-catalog-item is the warm-lead conversion play: pasting the catalog card into a WhatsApp thread gives the customer a clean, photo-led path back to a low-commitment touchpoint.

---

## Replacing the missing verified business badge

Without the green checkmark, You need to **build trust through completeness and consistency** instead. Action items:

1. **Profile completeness** — fill every field above. Meta's algorithm partly bases verified-eligibility on profile completeness.
2. **Brand consistency** — the WhatsApp profile pic, banner, and welcome message all use the same iter-5 visual + voice as the website. Customers who land on WhatsApp from the site should feel zero discontinuity.
3. **Pinned welcome message** with verifiable details (see "Welcome message" section below).
4. **Web → WhatsApp consistency** — the wa.me link should always be on `rikathletica.com` so click-through traffic shows the website→WhatsApp pattern in Meta's logs (helps verification later).
5. **Business email match** — `Bek.Zhou@rikathletica.com` is on the same domain as the website. Don't use a Gmail address here; that flags as low-trust.
6. **Privacy policy linked** — the WhatsApp profile points to `rikathletica.com` which has `/privacy` and `/terms`. Stripe's same-domain check + this same-domain check together establish the business as legitimate to Meta.
7. **Re-apply for verified badge in 6 months** — once You have ≥500 active conversations and a clean ToS-compliant message history, Meta's verification team is more likely to approve. Apply via Meta Business Manager → WhatsApp Business Account → Verification.

---

## Welcome message + Quick Replies (paste into the app)

### Welcome message (Settings → Business tools → Greeting message)

```
Hi! You've reached RIK Athletica.

I'm Bek (founder). We're endurance sports nutrition — Layer 2 functional gels + RD-reviewed 4-week protocols.

Quick orientation:
• Just have a question? Type it.
• Premium customer? Reply PREMIUM to route Yourself.
• Sprint customer? Reply SPRINT.
• Race-day issue? Reply RACE.

Async-first, M–F 09:00–18:00 ICT. For medical emergencies, dial Your local emergency number — we're not on call.

Talk soon.
```

### Away message (Settings → Business tools → Away message)

```
We're outside reply hours right now (M–F 09:00–18:00 ICT). I'll see Your message first thing tomorrow morning.

If You're a Premium customer in race week, message back with PREMIUM RACE — that pings me through.

— Bek
```

### Quick Replies (Settings → Business tools → Quick replies)

Each is a `/shortcut` you type to insert a saved template. Worth setting up:

| Shortcut | Reply text |
|---|---|
| `/sprint-vs-premium` | Sprint = personalized 4-week protocol, two training shipments, weekly revision loop. You execute it. $569–$899 by training volume. Race Pack (race-day product mix) is an optional add-on at checkout. <br><br>Premium = same protocol + we source every product (Race Pack included), run race-week WhatsApp concierge, deliver the post-race debrief. White glove. $1,599. <br><br>If Your race is 4–8 weeks out and You want to focus on swim-bike-run instead of sourcing gels, it's Premium. Otherwise Sprint. |
| `/race-date` | Sprint and Premium are race-gated by design. Your race needs to be **28–56 days** from sign-up. Closer than 28 days, the gut won't adapt. Further than 8 weeks, the protocol drifts. <br><br>If You're outside that window, the Bundle ($119) gives You the products to start gut training right now, no protocol. |
| `/coach-required` | Yes — Sprint and Premium both require an active coach or structured training plan. We don't write training; we calibrate fueling. Coaching + fueling are different jobs and we want to do ours well. |
| `/refund-bundle` | The Bundle has a 30-day money-back guarantee, no questions. Train with the gels for 30 days; if You don't notice better energy or fewer GI issues, email Bek.Zhou@rikathletica.com — full refund, keep the gels. |
| `/refund-premium` | Premium refund: complete the 4-week protocol as written, race, and within 14 days request the refund if it didn't deliver value. Full $1,599 returned, conditional on every weekly check-in being submitted. We carry the risk so You can race. |
| `/start-here` | Honestly the fastest first move is the **free audit**: https://www.rikathletica.com/audit — 2-min form, You get back a methodology audit deliverable in 48 hrs. No purchase, no email spam. From there You'll know if it's the Bundle, Sprint, or Premium. |
| `/medical` | Sprint and Premium have a medical exclusion list (heart conditions, diabetes, eating disorders, pregnancy, IBS, anti-arrhythmics, etc.). If any apply, we refund and terminate enrollment — please consult Your physician before any high-intensity nutrition protocol. |
| `/international` | Phase 1 ships to US + Canada only. Phase 2 (later this year) opens UK + EU. If You're outside North America right now, get on the audit list and we'll email when we open Your region. |
| `/founder` | I (Bek) personally deliver the Founding Cohort Premium tier — 10 athletes per cycle. Sprint and Bundle are also founder-built but at scale. Founder note + methodology details: https://www.rikathletica.com/premium |

---

## Day-to-day operating SLAs

| Tier | Response window | Hours | Founder-or-team |
|---|---|---|---|
| Premium race-week (Days −7 to +1) | 2 hours | 06:00–23:00 ET, 7 days | Founder only |
| Premium non-race-week | 1 business day | M–F 09:00–18:00 ICT | Founder |
| Sprint during 4-week protocol | Same business day | M–F 09:00–18:00 ICT | Founder + Emily (RD) for nutrition q's |
| Sprint between cycles | 1 business day | M–F | Team |
| Bundle | 1 business day | M–F | Team |
| Warm lead | 1 business day | M–F | Founder for now (manual qualification) |

These are written into the welcome message + away message so customers self-set expectations.

---

## Data hygiene + privacy

WhatsApp messages are encrypted end-to-end. Bek owns the device. **Don't:**
- Screenshot threads with customer names + paste into Slack/Notion. If You need to capture a learning, anonymize first.
- Forward customer messages to anyone outside RIK without written consent.
- Use customer phone numbers for outbound marketing without explicit opt-in within the past 24h conversation (WhatsApp Business policy + GDPR/CCPA).

**Do:**
- Use Quick Replies aggressively — fewer typos, consistent voice.
- Apply labels (PREMIUM, SPRINT, BUNDLE, WARM-LEAD) so threads are sortable.
- Archive resolved threads; keep active ones in the inbox.
- Export thread metadata (counts, response time) monthly to a spreadsheet for trend analysis.

---

## The setup checklist

1. ✅ Phone registered (`+1 626 360 9822`)
2. ☐ Profile pic uploaded (Option A — 1024×1024 PNG, black GI mark on white)
3. ☐ Business description pasted (the 256-char string above)
4. ☐ Business hours set (M–F 09:00–18:00 ICT)
5. ☐ Business email set (`Bek.Zhou@rikathletica.com`)
6. ☐ Website link set (`https://www.rikathletica.com`)
7. ☐ Instagram link set
8. ☐ Welcome message pasted
9. ☐ Away message pasted
10. ☐ All 9 Quick Replies created
11. ☐ Catalog populated with 6 entries
12. ☐ Status line updated to `Race-day fueling, calibrated. Async-first. Reply window M–F.`
13. ✅ Footer wa.me link added to all 6 iter-5 pages (`index`, `bundle`, `sprint`, `premium`, `calculator`, `audit`) — utility pages (`/checkin`, `/thank-you`) intentionally excluded. Each link fires `gtag('event','whatsapp_open',{page:'<page>'})` via the existing `data-track` click handler.
14. ☐ Re-apply for verified business badge at 6-month mark

Items 2–12 are inside the WhatsApp Business app on Bek's phone. Item 13 is a code change I can do.
