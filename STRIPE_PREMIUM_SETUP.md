# Stripe Premium Payment Link — Setup Guide

**Goal:** create a Stripe Payment Link for the Founding Cohort Premium tier ($1,599) and wire it into `/premium`.

**Status (as of 2026-05-09):** ✅ **PRODUCTION LIVE.** Payment link created, wired into `premium.html`, and full GA4 + Rewardful + RIK analytics tracking attached.

- **Live link:** `https://buy.stripe.com/00waEZ1C68ww2yG0087Re06`
- **Wired into:** `premium.html` line ~881 (`#premium-reserve-btn`)
- **Tracking events:** `view_item`, `premium_page_view`, `begin_checkout`, `premium_reserve_click`, `stripe_checkout_open`, `premium_eligibility_passed`
- **Rewardful affiliate:** `data-rewardful` attribute attached + Rewardful loader script live
- **RIK helper:** `window.RIK.cta('premium_stripe_checkout')` fires on click

**Site URLs to paste into Stripe payment-link "Business details" panel:**

| Field | Value |
|---|---|
| Customer support email | `Bek.Zhou@rikathletica.com` |
| Business website | `https://www.rikathletica.com` |
| Privacy policy URL | `https://www.rikathletica.com/privacy` |
| Terms of service URL | `https://www.rikathletica.com/terms` |

The original setup walkthrough is preserved below for reference / re-creation in test mode.

---

## Step 1 — Create the Premium product first

The screenshot shows existing products like "Sprint Protocol Service — Pro" but no Premium. Create the Premium product before the payment link.

1. In Stripe Dashboard → **Products** → **+ Add product**
2. Fill in:
   - **Name:** `RIK ATHLETICA™ Founding Cohort Premium`
   - **Description:** `Founder-delivered race fueling concierge. 4-week protocol + 3 RIK Bundles + race-week WhatsApp concierge + RD-reviewed methodology + post-race debrief. Founding Cohort: 10 slots, single payment.`
   - **Image:** Upload `assets/web/premium-hero.jpg` (the same hero image), or a clean version of the bundle box on the program guidebook
   - **Tax category:** **General — Services** (NOT Dietary Supplements — Premium is the service tier; products are included as service deliverables)
3. Pricing:
   - **Price:** `$1,599.00 USD`
   - **Type:** **One-off** (not recurring)
   - Leave currency as USD
4. Click **Save product**

---

## Step 2 — Create the Payment Link

1. Stripe Dashboard → **Payment links** → **+ New**
2. **Select type:** Products or subscriptions
3. **Product:** Search and pick `RIK ATHLETICA™ Founding Cohort Premium · $1,599.00 USD`
4. **Quantity:** Customers can adjust → **OFF** (founding cohort = one slot per athlete)

### Options to enable

```
✅ Collect tax automatically              (already on per screenshot)
✅ Collect customer names                  (required — we need legal name for contract)
✅ Collect customer addresses              (required — Race Pack ships to physical address)
✅ Require customers to provide a phone number   (required — RIK Direct WhatsApp uses E.164)
☐  Enable Managed Payments                 (leave OFF — Stripe Billing not needed)
☐  Collect business names                  (OFF — B2C only)
✅ Limit the number of payments            (set to 10 — Founding Cohort hard cap)
```

### Advanced options

- **Allow promotion codes:** OFF (no Founding Cohort discounts; Rewardful affiliate runs separately)
- **Collect shipping address:** ON, restricted to ship-to countries: US + Canada (Phase 1)

---

## Step 3 — Configure "After payment"

This is critical — it routes paid customers into the Typeform full-intake.

1. Click **After payment** tab in the Payment Link editor
2. Choose **Don't show confirmation page** → **Send customers to a custom URL**
3. URL: `https://form.typeform.com/to/XT5Qo0HD?stripe_session_id={CHECKOUT_SESSION_ID}&tier=premium&email={EMAIL}`
   - Stripe substitutes `{CHECKOUT_SESSION_ID}` and `{EMAIL}` automatically
   - The `tier=premium` param tells the Typeform webhook to treat this as a Premium intake (different downstream flow)
4. **Confirmation email:** Use Stripe's default for now; we'll replace with Resend templated email in Phase 3
5. Save

---

## Step 4 — Copy the link and wire it into `/premium`

1. After saving, Stripe gives you a URL like `https://buy.stripe.com/XXXXXXXXXXXXXXXXXXX`
2. **Copy it.**
3. In this repo, run from project root:

   ```bash
   PREMIUM_LINK="https://buy.stripe.com/XXXXXXXXXXXXXXXXXXX"
   sed -i '' "s|STRIPE_PREMIUM_LINK_TO_BE_SET|$PREMIUM_LINK|g" premium.html
   ```

4. Verify the swap:

   ```bash
   grep -c "STRIPE_PREMIUM_LINK_TO_BE_SET" premium.html   # should print 0
   grep -c "buy.stripe.com" premium.html                  # should print 1+
   ```

5. Also add it to `.env.local` and Vercel env vars for future serverless reference:

   ```
   STRIPE_LINK_PREMIUM=https://buy.stripe.com/XXXXXXXXXXXXXXXXXXX
   ```

---

## Step 5 — Test end-to-end before launch

Stripe gives you a **test mode** version of the same link. Before going live:

1. In Stripe Dashboard, toggle to **Test mode** (top-right)
2. Re-create the product and payment link in test mode (one-time)
3. Use test card `4242 4242 4242 4242`, any future expiry, any 3-digit CVC
4. Confirm:
   - [ ] Stripe collects address + phone correctly
   - [ ] Quantity is locked to 1
   - [ ] After-payment redirect lands on the right Typeform with `tier=premium` in URL
   - [ ] Slot counter (10) decrements when a real payment goes through
5. Switch back to **Live mode** for the real link

---

## Why we gate before checkout (eligibility form)

The `/premium` page now has a screening form ahead of the Stripe link (`#premium-screening-form`). The form locks the Stripe button until the athlete:

- Confirms race distance (70.3 / Full Ironman)
- Picks a race date 28–56 days out
- Confirms active coach / structured plan
- Confirms prior race experience at the chosen distance
- Confirms none of the medical exclusions apply
- Accepts the Founding Cohort terms + refund policy + ToS

Until all six gates pass, the button is `aria-disabled="true"` and clicks scroll the user back to the first incomplete field with a red flash. Stripe doesn't know about this — the form is a client-side gate that protects the Stripe link from unqualified clicks.

This means the Stripe Payment Link itself doesn't need any extra fields beyond name/address/phone. Our form does the qualification work upstream.

---

## Slots remaining counter (Phase 2)

Right now `slotsRemaining` is hardcoded to `10` in `premium.html`. After launch, we'll wire it to a Stripe webhook (`checkout.session.completed`) → KV/Redis decrement → live count. For Phase 1, manually decrement by editing `premium.html` after each sale (small founder-delivered cohort, 10 slots → manageable by hand).

When you decrement, also update the slot ticker copy if you want to add urgency:

- 10 slots → "Founding Cohort opens"
- 7 slots → "Most slots taken"
- 3 slots → "Final 3 slots"
- 0 slots → "Cohort full — waitlist open"
