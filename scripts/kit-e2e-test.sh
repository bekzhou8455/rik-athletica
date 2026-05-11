#!/usr/bin/env bash
# Kit (ConvertKit) end-to-end test
# ─────────────────────────────────────────────────────────────────────────────
# What it does:
#   1. Submits a fresh test audit  → fires KIT_TAG_AUDIT_SUBMITTED
#   2. Approves that audit          → fires KIT_TAG_AUDIT_DELIVERED + tier tag
#                                     + "post-audit-nurture" v4 tag
#   3. Sends Stripe "checkout.session.expired" for a Bundle price
#                                   → fires "cart-recovery-bundle" v4 tag
#
# After running, log into Kit and verify the test subscriber received the
# 4 expected tags. Then delete the test subscriber from Kit so the test
# email isn't polluted with real sequences.
#
# Usage:
#   BASE_URL=https://www.rikathletica.com \
#   TEST_EMAIL=bek+kit-test-$(date +%s)@rikathletica.com \
#   ADMIN_TOKEN=... \
#   STRIPE_WEBHOOK_SECRET=whsec_... \
#   ./scripts/kit-e2e-test.sh
#
# Notes:
#   - The Stripe step requires the real webhook secret to compute a valid
#     signature. If you don't have it locally, skip step 3 (set SKIP_STRIPE=1).
#   - DO NOT run against prod with a real customer email — always use bek+...
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="${BASE_URL:-https://www.rikathletica.com}"
TEST_EMAIL="${TEST_EMAIL:-bek+kit-test-$(date +%s)@rikathletica.com}"
FIRST_NAME="${FIRST_NAME:-KitTest}"
SKIP_STRIPE="${SKIP_STRIPE:-0}"

echo "═══════════════════════════════════════════════════════════════"
echo "Kit E2E test"
echo "  BASE_URL:   $BASE_URL"
echo "  TEST_EMAIL: $TEST_EMAIL"
echo "═══════════════════════════════════════════════════════════════"

# ─── Step 1: Submit a test audit ────────────────────────────────────────────
echo
echo "→ Step 1/3 — POST /api/audit/submit"

SUBMIT_BODY=$(cat <<JSON
{
  "raceDistance": "Full Ironman",
  "raceDate":     "2026-09-15",
  "targetTime":   "10:30",
  "weeklyHours":  "12",
  "brands":       ["Maurten","SiS"],
  "carbsPerHour": "70",
  "giHistory":    "mild",
  "giNotes":      "Test submission — please ignore.",
  "bodyWeight":   "75",
  "weightUnit":   "kg",
  "sweatRate":    "1.2 L/h",
  "hasCoach":     "no",
  "specificConcern": "Testing Kit lifecycle end-to-end. Safe to delete.",
  "firstName":    "$FIRST_NAME",
  "email":        "$TEST_EMAIL",
  "consent":      true,
  "utmSource":    "kit-e2e-test",
  "utmMedium":    "script",
  "utmCampaign":  "internal-validation"
}
JSON
)

SUBMIT_RESP=$(curl -sS -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d "$SUBMIT_BODY" \
  "$BASE_URL/api/audit/submit")

SUBMIT_CODE=$(printf '%s' "$SUBMIT_RESP" | tail -n 1)
SUBMIT_JSON=$(printf '%s' "$SUBMIT_RESP" | sed '$d')

if [ "$SUBMIT_CODE" != "200" ] && [ "$SUBMIT_CODE" != "201" ]; then
  echo "  ✗ submit failed ($SUBMIT_CODE):"
  echo "$SUBMIT_JSON"
  exit 1
fi
echo "  ✓ submit ok ($SUBMIT_CODE)"
AUDIT_ID=$(printf '%s' "$SUBMIT_JSON" | sed -n 's/.*"id":[[:space:]]*"\?\([a-zA-Z0-9_-]*\)"\?.*/\1/p' | head -1)
echo "  audit_id: ${AUDIT_ID:-(could not parse)}"
echo "  → Kit: KIT_TAG_AUDIT_SUBMITTED should now be applied to $TEST_EMAIL"

# ─── Step 2: Approve that audit ────────────────────────────────────────────
echo
echo "→ Step 2/3 — POST /api/audit/approve"

if [ -z "${ADMIN_TOKEN:-}" ]; then
  echo "  ⚠ Skipping — set ADMIN_TOKEN to run this step"
elif [ -z "${AUDIT_ID:-}" ]; then
  echo "  ⚠ Skipping — couldn't parse audit_id from step 1"
else
  APPROVE_RESP=$(curl -sS -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "{\"id\":\"$AUDIT_ID\"}" \
    "$BASE_URL/api/audit/approve")

  APPROVE_CODE=$(printf '%s' "$APPROVE_RESP" | tail -n 1)
  APPROVE_JSON=$(printf '%s' "$APPROVE_RESP" | sed '$d')

  if [ "$APPROVE_CODE" != "200" ]; then
    echo "  ✗ approve failed ($APPROVE_CODE):"
    echo "$APPROVE_JSON"
    exit 1
  fi
  echo "  ✓ approve ok ($APPROVE_CODE)"
  echo "  → Kit: KIT_TAG_AUDIT_DELIVERED + tier tag + 'post-audit-nurture'"
fi

# ─── Step 3: Trigger cart-recovery via Stripe webhook ──────────────────────
echo
echo "→ Step 3/3 — POST /api/stripe-webhook (checkout.session.expired)"

if [ "$SKIP_STRIPE" = "1" ]; then
  echo "  ⚠ Skipping — SKIP_STRIPE=1"
elif [ -z "${STRIPE_WEBHOOK_SECRET:-}" ]; then
  echo "  ⚠ Skipping — set STRIPE_WEBHOOK_SECRET to run this step"
else
  EVENT_TS=$(date +%s)
  EVENT_BODY=$(cat <<JSON
{
  "id": "evt_test_$EVENT_TS",
  "type": "checkout.session.expired",
  "data": {
    "object": {
      "id": "cs_test_$EVENT_TS",
      "amount_total": 11900,
      "customer_email": "$TEST_EMAIL",
      "customer_details": {
        "email": "$TEST_EMAIL",
        "name":  "$FIRST_NAME Tester"
      }
    }
  }
}
JSON
)
  # Compute Stripe-Signature: t=<ts>,v1=<HMAC_SHA256(ts.body, secret)>
  SIG_BODY="$EVENT_TS.$EVENT_BODY"
  SIG_HEX=$(printf '%s' "$SIG_BODY" | openssl dgst -sha256 -hmac "$STRIPE_WEBHOOK_SECRET" -hex | sed 's/^.* //')
  SIG_HEADER="t=$EVENT_TS,v1=$SIG_HEX"

  HOOK_RESP=$(curl -sS -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -H "Stripe-Signature: $SIG_HEADER" \
    -d "$EVENT_BODY" \
    "$BASE_URL/api/stripe-webhook")

  HOOK_CODE=$(printf '%s' "$HOOK_RESP" | tail -n 1)
  if [ "$HOOK_CODE" != "200" ]; then
    echo "  ✗ webhook failed ($HOOK_CODE):"
    printf '%s' "$HOOK_RESP" | sed '$d'
    exit 1
  fi
  echo "  ✓ webhook ok ($HOOK_CODE)"
  echo "  → Kit: 'cart-recovery-bundle' should now be applied"
fi

echo
echo "═══════════════════════════════════════════════════════════════"
echo "Done. Verify in Kit:"
echo "  https://app.kit.com/subscribers?q=$TEST_EMAIL"
echo
echo "Expected tags on $TEST_EMAIL:"
echo "  • KIT_TAG_AUDIT_SUBMITTED         (step 1)"
echo "  • KIT_TAG_AUDIT_DELIVERED         (step 2)"
echo "  • KIT_TAG_TIER_<recommended-tier> (step 2)"
echo "  • post-audit-nurture              (step 2)"
echo "  • cart-recovery-bundle            (step 3)"
echo
echo "After verifying, delete the subscriber from Kit so it doesn't"
echo "receive real sequences."
echo "═══════════════════════════════════════════════════════════════"
