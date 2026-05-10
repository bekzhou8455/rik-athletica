#!/usr/bin/env bash
# /scripts/stripe-link-hot-test.sh
# Phase 1 deliverable per PLAN.md.
#
# Probes every Stripe Payment Link referenced in HTML or env vars.
# Expects each URL to return HTTP 200 or 302/303. Exits non-zero on
# any URL that fails to resolve.
#
# Run before every production deploy.
#
# Usage:
#   ./scripts/stripe-link-hot-test.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Collect all Stripe Payment Link URLs from HTML + .env.example
# Portable for bash 3.2 (macOS default) — no mapfile.
URLS=()
while IFS= read -r LINE; do
  [[ -n "$LINE" ]] && URLS+=("$LINE")
done < <(
  grep -roEh 'https://buy\.stripe\.com/[A-Za-z0-9_-]+' "$ROOT" \
    --include='*.html' \
    --include='.env*' \
    --include='*.md' 2>/dev/null \
  | sort -u
)

# Also pick up env-var-driven URLs if present in current shell
[[ -n "${STRIPE_LINK_FULL:-}" ]] && URLS+=("$STRIPE_LINK_FULL")
[[ -n "${STRIPE_LINK_703:-}" ]]  && URLS+=("$STRIPE_LINK_703")

# Deduplicate
TMP_URLS=()
while IFS= read -r LINE; do
  [[ -n "$LINE" ]] && TMP_URLS+=("$LINE")
done < <(printf "%s\n" "${URLS[@]}" | sort -u)
URLS=("${TMP_URLS[@]}")

if [[ ${#URLS[@]} -eq 0 ]]; then
  echo "⚠ No Stripe Payment Link URLs found (skipping)"
  exit 0
fi

EXIT_CODE=0
for URL in "${URLS[@]}"; do
  # Skip example/placeholder URLs
  if [[ "$URL" == *example* || "$URL" == *placeholder* ]]; then
    continue
  fi
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -I "$URL" || echo "000")
  case "$CODE" in
    200|301|302|303)
      echo "✓ $CODE $URL"
      ;;
    *)
      echo "❌ $CODE $URL"
      EXIT_CODE=1
      ;;
  esac
done

if [[ $EXIT_CODE -eq 0 ]]; then
  echo ""
  echo "✓ stripe-link-hot-test: all ${#URLS[@]} links live"
else
  echo ""
  echo "❌ stripe-link-hot-test: one or more links broken"
fi

exit $EXIT_CODE
