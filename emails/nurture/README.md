# RIK Athletica — Marketing Nurture Sequences (Phase 3a)

**Distinct from transactional emails** in `emails/{premium,sprint,bundle}/` — those fire on discrete events (payment, screening result, weekly cron) and are sent via **Resend**. Nurture sequences fire on multi-touch lifecycle automation (warm-lead segments, abandoned checkouts, post-purchase upsell paths) and are sent via **Kit (ConvertKit)**.

| | Transactional (Resend) | Nurture (Kit) |
|---|---|---|
| What runs them | `api/stripe-webhook.js` + `api/cron/daily-sweep.js` | Kit's automation builder + tag-based triggers |
| Audience | Confirmed customer / active screening | Warm leads, past customers, segmented broadcast |
| Compliance | Implied consent (they bought) | **Explicit opt-in required** — every email has unsubscribe + physical mailing address (CAN-SPAM) |
| Templates | `emails/{tier}/*.html` | `emails/nurture/{sequence}/*.html` |

---

## Phase 3a — three highest-leverage sequences (10 emails total)

| Sequence | Audience | # emails | Span | Goal | KPI |
|---|---|---|---|---|---|
| **1. Post-Audit Nurture** | Submitted `/audit`, got Level-0 deliverable, didn't buy in 48h | **4** | 14 days | Convert audit reader → Bundle, Sprint, or Premium | Audit→purchase rate within 14d |
| **2. Cart Abandonment** | Stripe `checkout.session.expired` (started checkout, didn't complete) | **3** | 5 days | Recover abandoned checkout | Recovery rate (% returning to checkout) |
| **3. Bundle → Sprint Upsell** | Past Bundle buyer, hasn't bought Sprint | **3** | 60 days post-purchase | Upgrade Bundle customer to Sprint when race window opens | Bundle→Sprint LTV expansion |

---

## Decisions made for these sequences (Bek can override)

These are the 5 questions I asked earlier with my default decisions. Override any by editing the template file headers and Kit automation accordingly.

### 1. Sender voice / signature

**Default: All Phase 3a uses `— Bek` (founder-direct).**

Reason: Audit nurture is a methodology conversation, cart-abandonment carries meaningful dollars, and Bundle→Sprint upsell is the moment Bek personally takes over the relationship. Generic "— The RIK team" softens the message; founder-direct stays tighter on iter-5 voice.

**Override:** edit the `<p style="...">— Bek</p>` line in each template's footer block, swap to `— The RIK team` if you want lower presence on a specific email.

### 2. Cadence

| Sequence | Email # | When |
|---|---|---|
| Post-Audit | 1 | Day +2 (after audit deliverable lands on Day 0) |
| Post-Audit | 2 | Day +5 |
| Post-Audit | 3 | Day +9 |
| Post-Audit | 4 | Day +14 |
| Cart Abandonment | 1 | +1 hour after `checkout.session.expired` |
| Cart Abandonment | 2 | +1 day |
| Cart Abandonment | 3 | +3 days |
| Bundle→Sprint | 1 | Day +14 post-purchase |
| Bundle→Sprint | 2 | Day +30 post-purchase |
| Bundle→Sprint | 3 | Day +60 post-purchase OR 4 weeks before next-known race date if `race_date_next` is set on Kit profile |

**Why these gaps**: Audit nurture is dense early (Day 2 → 5 → 9) because the audit deliverable creates strong recency and we want to convert in-window; tail tapers with Day +14 as a soft Bundle ask. Cart abandonment is fastest of all (1hr is Stripe-recommended). Bundle→Sprint is slow because the trigger is "athlete now has a race in 4–8 weeks" — we wait for them to qualify themselves.

### 3. Compliance — physical mailing address (CAN-SPAM requirement)

**Bek action required:** every nurture email must list a physical mailing address in the footer. Provide one of:
- Registered Inc. address
- Bek's home address (allowed but personal-info exposure)
- A virtual mailbox / PO box (e.g., iPostal1, Anytime Mailbox)

**Until provided**, templates use `{{registered_address}}` as a placeholder token — Kit will fail-soft if unsubstituted but the email itself won't pass CAN-SPAM.

Also required (already handled by Kit's loader script):
- Unsubscribe link in every email — Kit's auto-injected `{{unsubscribe_url}}`
- Sender identification matches the Inc. (Rik Athletic Nutrition Inc.)
- Clear "why You're getting this" line in the email — included in templates as the eyebrow row

### 4. Discount strategy — single sitewide code

**Locked May 2026:** one promo code (`WELCOME15`) covers every first-time-customer nurture path. Stripe's "first-time customer" eligibility flag enforces 1-use-per-customer regardless of how many channels surface the code, so reuse is safe and clean.

| Sequence | Code | Type | Reasoning |
|---|---|---|---|
| Post-Audit Nurture | **`WELCOME15`** | 15% off, first-time customer | Single sitewide code. Stronger lever (15% > 10%) since the audit reader has expressed real intent — they paid 15min of attention to a free deliverable. |
| Cart Abandonment | **`WELCOME15`** | 15% off, first-time customer | Same code as exit-intent popup + post-audit. Stripe's 1-use-per-customer cap = no abuse risk. |
| Bundle → Sprint Upsell | **No discount in any of the 3 emails** | n/a | They're already customers; the upsell is the calibration value, not price. Adding a discount lever here cheapens the service. |

**Bek action required:** verify `WELCOME15` is live in Stripe per `STRIPE_PROMO_SETUP.md` (Steps 1–4 — Coupon → Promotion Code → toggle on each Payment Link → URL-prefill smoke-test). No new codes to create.

**Attribution per channel:** GA4 events (`exit_popup_promo_apply`, `nurture_promo_apply` w/ `sequence_name` payload) cover what Stripe-coupon-name attribution would have given You. Single code is simpler, single source of truth.

### 5. Pause condition (kill switch when athlete buys mid-sequence)

**Default:** `api/stripe-webhook.js` (on `checkout.session.completed`) calls Kit's API to **remove all nurture tags** from the customer's Kit profile, which exits them from any active sequence.

Tags to remove on conversion:
- `post-audit-nurture`
- `cart-recovery-bundle`
- `cart-recovery-sprint`
- `cart-recovery-premium`
- `bundle-to-sprint-upsell`

This requires extending `api/stripe-webhook.js` (~10 lines of Kit API call). Spec'd out in section "Stripe webhook → Kit kill switch" below.

---

## Sequence details

### Sequence 1 — Post-Audit Nurture (4 emails / 14 days)

**Trigger:** `/api/audit/submit` → admin approves → audit deliverable email fires (transactional, exists). Kit then tags the recipient `post-audit-nurture` and starts the 4-email sequence.

**Tag enters/exits:**
- Enters: when audit deliverable is sent (Kit listens for the Resend send event OR the admin-approve webhook fires Kit API directly)
- Exits: when athlete makes any purchase (any tier), unsubscribes, or 14 days elapse without conversion (then tagged `post-audit-cold`)

| # | File | Subject | Goal |
|---|---|---|---|
| 1 | `01-day2-translate-audit-to-action.html` | "Three things in Your audit point at Sprint" | Reframe the audit's findings into a Sprint-tier nudge |
| 2 | `02-day5-customer-story.html` | _(on hold)_ "What Maya found between her audit and her sub-12" | **DO NOT ENABLE** — placeholder customer. FTC §255 requires real testimonials. Reactivate after a real Sprint customer hits a documented outcome + signs a consent line. Until then, Kit sequence skips Day +5 (PA1 → PA3 → PA4). |
| 3 | `03-day9-sprint-cta-with-discount.html` | "Race in 4–8 weeks? Sprint takes Your audit and runs the loop." | Direct Sprint CTA + WELCOME15 (15% off, first-time) |
| 4 | `04-day14-soft-bundle-ask.html` | "If Sprint isn't right yet — start with the products" | Soft Bundle ask, WELCOME15 still valid, recovery email |

### Sequence 2 — Cart Abandonment (3 emails / 5 days)

**Trigger:** Stripe `checkout.session.expired` event (~30 minutes after a session is opened without payment). Kit gets webhook ping with the customer's email + the tier they were checking out.

**Tag enters/exits:**
- Enters: `cart-recovery-{tier}` on session expiration
- Exits: any successful purchase, or 5 days elapsed (then `cart-recovery-cold`)

| # | File | Subject | Goal |
|---|---|---|---|
| 1 | `01-1hour-soft-touch.html` | "Saw You started checkout — anything we can answer?" | Low-pressure: "we're here if You have a question." Inline WhatsApp CTA. No discount yet. |
| 2 | `02-day1-talk-it-through.html` | "Want to talk it through?" | Conversational. WhatsApp CTA primary, Stripe link secondary. Still no discount. |
| 3 | `03-day3-welcome15-last-call.html` | "WELCOME15 — 15% off if You finish today" | Discount activation. Last touch. Pure recovery play. |

### Sequence 3 — Bundle → Sprint Upsell (3 emails / 60 days)

**Trigger:** Stripe `checkout.session.completed` for Bundle ($119) → Kit tags `bundle-to-sprint-upsell` → 14-day delay before email 1.

**Tag enters/exits:**
- Enters: 14 days post-Bundle-purchase
- Exits: Sprint purchase, 60 days elapsed without Sprint (then `bundle-buyer-cold`), or unsubscribe

| # | File | Subject | Goal |
|---|---|---|---|
| 1 | `01-day14-how-were-the-gels.html` | "How were the gels?" | Genuine product check-in (not pitch). Asks for honest feedback. Light Sprint primer at the bottom. |
| 2 | `02-day30-race-coming.html` | "Got a race in the next 8 weeks?" | Direct Sprint pitch — "the same products, calibrated." Race-gate logic explained. |
| 3 | `03-day60-final-touch-with-receipt.html` | "If a race is on the calendar — Sprint takes it from here." | Last touch. Mentions next race generally. Optional `SPRINT_RETURN` code if You want me to add one. |

---

## Token glossary (nurture-specific)

In addition to the transactional tokens documented in `emails/README.md`, nurture sequences use these:

| Token | Source | Used in |
|---|---|---|
| `{{audit_summary_oneliner}}` | Pulled from athlete's audit deliverable record (e.g., "Your protocol is leaking ~22 minutes on bike-to-run hydration") | Post-Audit emails |
| `{{audit_url}}` | Permalink to the rendered audit at `/a/{slug}` | Post-Audit emails |
| `{{tier_in_cart}}` | Bundle / Sprint 70.3 / Sprint Full / Sprint Pro / Premium — pulled from Stripe checkout session | Cart Abandonment emails |
| `{{tier_in_cart_price}}` | Numeric price the athlete had in their cart | Cart Abandonment emails |
| `{{stripe_resume_url}}` | Stripe-provided resume URL for the abandoned session | Cart Abandonment emails |
| `{{quantity}}` | Number of Bundles purchased | Bundle→Sprint emails |
| `{{purchase_date_short}}` | When they bought the Bundle | Bundle→Sprint emails |
| `{{registered_address}}` | RIK's CAN-SPAM mailing address — **Bek to provide** | All nurture emails (footer) |
| `{{unsubscribe_url}}` | Kit auto-injects | All nurture emails (footer) |
| `{{kit_profile_url}}` | Kit profile management URL ("update preferences") | All nurture emails (footer) |

---

## Stripe webhook → Kit kill switch (spec)

Add to `api/stripe-webhook.js` (~10 lines, pending `ALLOW_BACKEND_TOUCH=1`):

```js
if (event.type === 'checkout.session.completed') {
  const email = session.customer_details?.email?.toLowerCase();
  if (email && process.env.KIT_API_SECRET) {
    // Remove all active nurture tags so customer exits any running sequence
    const TAGS_TO_REMOVE = [
      'post-audit-nurture',
      'cart-recovery-bundle',
      'cart-recovery-sprint',
      'cart-recovery-premium',
      'bundle-to-sprint-upsell',
    ];
    for (const tag of TAGS_TO_REMOVE) {
      await fetch(`https://api.kit.com/v4/subscribers/${encodeURIComponent(email)}/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${process.env.KIT_API_SECRET}` }
      }).catch(() => {});  // Fail-soft
    }
  }
}
```

---

## Kit setup checklist (Bek action — ~30 min)

1. **Resend integration disabled for these sequences** — Kit owns nurture, Resend owns transactional. No conflict.
2. **Create the 5 tags** in Kit:
   - `post-audit-nurture`
   - `cart-recovery-bundle`
   - `cart-recovery-sprint`
   - `cart-recovery-premium`
   - `bundle-to-sprint-upsell`
3. **Create 3 sequences** in Kit (one per Phase 3a sequence above):
   - Each sequence imports the HTML templates from `emails/nurture/{sequence}/*.html`
   - Substitution: Kit's merge-tag syntax matches our `{{token}}` syntax — direct paste works
   - Set entry trigger: tag added matching the sequence
   - Set exit triggers: any nurture tag removed (kill switch above) OR `purchased-{tier}` tag added
   - Set send-time delays per cadence above
4. **Stripe webhook → Kit auto-tagger** is in `api/stripe-webhook.js`. Need to extend (1) `cart-recovery-{tier}` tag on `checkout.session.expired`, (2) tag removal on `checkout.session.completed`. Both pending `ALLOW_BACKEND_TOUCH=1`.
5. **Audit-deliverable handoff**: when `api/audit/approve.js` sends the audit email, also POST to Kit API to add `post-audit-nurture` tag. ~5 lines, also pending `ALLOW_BACKEND_TOUCH=1`.
6. **Physical mailing address** in `Settings → Sending → Footer` so Kit substitutes it everywhere automatically. (Or rely on `{{registered_address}}` per-template.)

---

## File index

```
emails/nurture/
├── README.md                                       ← this file
├── post-audit/
│   ├── 01-day2-translate-audit-to-action.html
│   ├── 02-day5-customer-story.html
│   ├── 03-day9-sprint-cta-with-discount.html
│   └── 04-day14-soft-bundle-ask.html
├── cart-abandonment/
│   ├── 01-1hour-soft-touch.html
│   ├── 02-day1-talk-it-through.html
│   └── 03-day3-welcome15-last-call.html
└── bundle-to-sprint/
    ├── 01-day14-how-were-the-gels.html
    ├── 02-day30-race-coming.html
    └── 03-day60-final-touch.html
```

10 templates. ~7–10 KB each. iter-5 voice. Footer with unsubscribe + physical address + Kit profile link. Same Outfit / sand-bg / period-stacked headline patterns as the transactional set.
