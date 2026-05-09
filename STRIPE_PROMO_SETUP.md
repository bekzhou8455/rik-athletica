# Stripe — WELCOME15 Promo Code Setup

**Status:** ✅ **LIVE** — May 10, 2026. Bek confirmed coupon created, promotion code `WELCOME15` issued, Step 4 URL-prefill smoke-tested ($119 → $101.15 on Bundle).

| Field | Value |
|---|---|
| Coupon ID | `NoSP2FVP` (internal — Stripe-assigned) |
| Coupon name | Welcome 15% — first-time customer |
| Type | 15% off · once · all products |
| Promotion code | `WELCOME15` |
| Promotion API ID | `promo_1TVHQ3QwwrfrAsaG1uv57Qmz` |
| Customer eligibility | First-time customers only |
| Maximum redemptions | 1,000 |
| Created | May 9, 2026 |

This single sitewide code now powers: exit-intent popup · cart-abandonment Email C3 · post-audit Email PA3 · post-audit Email PA4 · sprint S1 cart-abandonment recovery. Stripe's "first-time customer" eligibility flag enforces 1-use-per-customer regardless of channel.

---

**Original setup walkthrough (kept for reference):**

**Required by:** the exit-intent popup (`assets/exit-intent.js`) wired into 6 customer pages — it offers a "15% off, valid 48 hours" code to warm leads who try to leave the site without purchasing.

**Until this is done, the popup will:**
- Still fire and still capture the warm-lead conversation via WhatsApp ✅
- Still copy `WELCOME15` to the athlete's clipboard when they click "Apply 15% off" ✅
- BUT — when they paste it on Stripe checkout, **Stripe will say the code is invalid** ❌

**Time required: ~5 minutes in Stripe dashboard.**

---

## Step 1 — Create the Coupon (the discount-amount object)

Stripe → **Products** tab → **Coupons** → **+ New**

| Field | Value |
|---|---|
| Name | `Welcome 15% — first-time customer` |
| Type | **Percentage off** |
| Percentage off | `15` |
| Duration | **Once** |
| Apply to | **All products** (or scope to specific products if you want to exclude Premium) |
| Redemption limit | Leave blank (per-customer cap is below) |
| Limit to first-time customers | ✅ ON if Stripe offers it (Stripe Tax / Customer-level promotion settings) — otherwise enforce via `Redeem by` date below |
| Redeem by | Leave blank initially. The 48-hour validity is enforced **client-side** via the popup's localStorage timestamp; Stripe's coupon stays evergreen. |

Click **Create coupon**. Save the `coupon_id` (e.g., `WELCOME_15_OFF_xyz123`).

---

## Step 2 — Create the Promotion Code (the customer-facing string)

Stripe → **Products** tab → **Promotion codes** → **+ New**

| Field | Value |
|---|---|
| Coupon | Pick the one you just created |
| Code | `WELCOME15` (must match exactly — case-sensitive) |
| Customer eligibility | **First-time customers only** (✅ check this box) |
| Maximum redemptions | `1000` (cap to prevent abuse — adjust as needed) |
| Expires | Leave blank or set to a far-future date |
| Restrictions: minimum amount | Leave blank |

Click **Create promotion code**.

---

## Step 3 — Enable promotion codes on each Stripe Payment Link

For **each of the 5 payment links**, edit and toggle ON "Allow promotion codes":

| Tier | Stripe Payment Link |
|---|---|
| Bundle | `https://buy.stripe.com/4gM7sN6Wq3cc7T0fZ67Re00` |
| Sprint 70.3 | `https://buy.stripe.com/7sY9AVdkOdQQ3CKbIQ7Re02` |
| Sprint Full Ironman | `https://buy.stripe.com/7sY28tfsW2887T07sA7Re03` |
| Sprint Pro | `https://buy.stripe.com/3cI4gB1C65kk1uCdQY7Re04` |
| Founding Cohort Premium | `https://buy.stripe.com/00waEZ1C68ww2yG0087Re06` |

For each link in Stripe Payment Links → **Edit** → **Options** → toggle ON `Allow promotion codes` → **Save**.

This enables a "Add promotion code" link on Stripe's checkout page, OR it lets the URL-prefilled `?prefilled_promo_code=WELCOME15` parameter auto-apply.

---

## Step 4 — Verify URL-prefill behavior

Test with this URL (replace tier as needed):
```
https://buy.stripe.com/4gM7sN6Wq3cc7T0fZ67Re00?prefilled_promo_code=WELCOME15
```

You should see:
- Stripe checkout opens with the discount **already applied** ✅
- $119 → $101.15 (Bundle, 15% off)
- Discount line: "WELCOME15 — 15% off"

If the discount doesn't auto-apply, double-check Step 3 (allow-promotion-codes toggle).

---

## How the popup uses this

When a warm lead triggers the popup and clicks "Apply 15% off":

1. **Bundle / Premium pages**: popup builds the URL `<stripe-link>?prefilled_promo_code=WELCOME15`, opens it in a new tab. Stripe auto-applies the discount on checkout.
2. **Sprint pages**: there's no direct Stripe link (Sprint requires the screening form). Popup copies `WELCOME15` to clipboard + shows a toast: "Code copied. Paste it on the Stripe checkout page after picking Your Sprint tier." The athlete then completes the screening form, gets routed to Stripe via the form's tier dispatcher, and pastes WELCOME15 on the Stripe checkout page (where the "Add promotion code" link now appears thanks to Step 3).
3. **Calculator / Audit / Index pages**: same as Sprint behavior — code copied to clipboard, athlete then navigates to a tier and pastes the code at checkout.

---

## How the 48-hour expiry works

The popup writes `localStorage.rik_exit_popup = { shown_at: <timestamp> }` when first shown.

Subsequent visits within 48 hours: popup respects the cooldown and doesn't reshow (unless 7 days have passed — see `COOLDOWN_DAYS` in `assets/exit-intent.js`).

The "valid 48 hours" framing is enforced **client-side narrative** — Stripe's coupon itself stays evergreen so the athlete can still redeem if they save the URL or paste the code later. If you want hard 48-hour enforcement on Stripe's side, you'd need to generate per-visitor unique codes via Stripe API, which adds complexity. **The current setup balances "urgency framing" with "no broken links if athletes return after 48h."**

---

## GA4 events the popup fires

| Event | When | Payload |
|---|---|---|
| `exit_popup_shown` | Popup renders | `page`, `time_on_page_s`, `scroll_pct` |
| `exit_popup_promo_apply` | Athlete clicks "Apply 15% off" | `page`, `promo_code: 'WELCOME15'` |
| `exit_popup_whatsapp_open` | Athlete clicks WhatsApp CTA | `page` |
| `exit_popup_dismissed` | Popup closed (X / overlay click / Escape) | `reason` |

You'll see these in GA4 Reports → Events. Use them to:
- Measure popup conversion: `exit_popup_promo_apply` ÷ `exit_popup_shown`
- Compare against eventual `purchase` event with `coupon: 'WELCOME15'` for end-to-end attribution
- Tune the warm-lead qualifier thresholds if conversion is low (currently 30s + 30% scroll)

---

## When this can be turned off

Disable the popup site-wide by removing the script tag from each customer page:

```bash
sed -i '' '/exit-intent.js/d' index.html bundle.html sprint.html premium.html calculator.html audit.html
```

Or temporarily disable for just one page by removing only that file's tag.
