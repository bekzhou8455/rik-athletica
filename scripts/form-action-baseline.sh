#!/usr/bin/env bash
# /scripts/form-action-baseline.sh
# Phase 1 deliverable per PLAN.md.
#
# Captures and diffs all <form action="..."> values across HTML pages.
# This is the regression guard against silent breakage of audit/calculator/
# Stripe submission paths during copy-only edits.
#
# Usage:
#   ./scripts/form-action-baseline.sh capture   # save current values to lockfile
#   ./scripts/form-action-baseline.sh diff      # exit non-zero if drift
#   ./scripts/form-action-baseline.sh           # default: diff

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCKFILE="$ROOT/.form-actions.lock"
MODE="${1:-diff}"

extract_actions() {
  # The actual regression risk: API endpoint URLs referenced anywhere in HTML
  # pages OR in compiled JS bundles in /assets/, in any form (fetch, xhr,
  # form action, JS variable). Capture all.
  # Output as sorted unique "file:url" lines so any URL drift surfaces.
  {
    find "$ROOT" -maxdepth 1 -name '*.html' -type f -print0
    find "$ROOT/assets" -maxdepth 2 -name '*.js' -type f -print0 2>/dev/null
  } | while IFS= read -r -d '' f; do
    base=$(basename "$f")
    # Native form action="..."
    grep -oE 'action="/[^"]*"' "$f" 2>/dev/null \
      | sed -E 's|action="([^"]*)"|\1|' \
      | sed "s|^|$base:|" || true
    # Any string literal /api/something — single or double quoted
    grep -oE "[\"']/api/[a-zA-Z0-9/_.-]+[\"']" "$f" 2>/dev/null \
      | sed -E "s|[\"']([^\"']*)[\"']|\1|" \
      | sed "s|^|$base:|" || true
  done | sort -u
}

case "$MODE" in
  capture)
    extract_actions > "$LOCKFILE"
    echo "✓ Captured $(wc -l < "$LOCKFILE" | tr -d ' ') form actions to .form-actions.lock"
    ;;
  diff)
    if [[ ! -f "$LOCKFILE" ]]; then
      echo "⚠ No baseline yet. Run: $0 capture"
      exit 2
    fi
    DIFF=$(diff <(extract_actions) "$LOCKFILE" || true)
    if [[ -z "$DIFF" ]]; then
      echo "✓ form-action-baseline: no drift ($(wc -l < "$LOCKFILE" | tr -d ' ') actions match)"
      exit 0
    else
      echo "❌ form-action-baseline: drift detected"
      echo "$DIFF"
      echo ""
      echo "If the change is intentional (e.g., new form added), refresh the lockfile:"
      echo "  $0 capture"
      exit 1
    fi
    ;;
  *)
    echo "Usage: $0 {capture|diff}"
    exit 2
    ;;
esac
