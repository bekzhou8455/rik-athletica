#!/usr/bin/env bash
# /scripts/no-touch-check.sh
# Phase 1 deliverable per PLAN.md (Eng review D5 boundary).
#
# Pre-commit hook that fails if the staged diff includes any backend file
# that the revamp is NOT supposed to touch:
#   lib/methodology.js, lib/routing.js, lib/render.js, lib/ai-drafter.js,
#   lib/db.js, anything under api/.
#
# Override: set ALLOW_BACKEND_TOUCH=1 in env to bypass (with intent
# documented in commit message).
#
# Install as a pre-commit hook:
#   ln -sf "$(pwd)/scripts/no-touch-check.sh" .git/hooks/pre-commit
#
# Or call manually:
#   ./scripts/no-touch-check.sh

set -euo pipefail

if [[ "${ALLOW_BACKEND_TOUCH:-}" == "1" ]]; then
  echo "⚠ no-touch-check: ALLOW_BACKEND_TOUCH=1 set — bypassing (verify intent in commit message)"
  exit 0
fi

# Compare against staged changes, or against HEAD if no stage
STAGED=$(git diff --cached --name-only 2>/dev/null || true)
if [[ -z "$STAGED" ]]; then
  STAGED=$(git diff --name-only 2>/dev/null || true)
fi
[[ -z "$STAGED" ]] && exit 0

PROTECTED_PATTERNS=(
  '^lib/methodology\.js$'
  '^lib/routing\.js$'
  '^lib/render\.js$'
  '^lib/ai-drafter\.js$'
  '^lib/db\.js$'
  '^api/'
)

VIOLATIONS=()
while IFS= read -r FILE; do
  for PATTERN in "${PROTECTED_PATTERNS[@]}"; do
    if [[ "$FILE" =~ $PATTERN ]]; then
      VIOLATIONS+=("$FILE")
    fi
  done
done <<< "$STAGED"

if [[ ${#VIOLATIONS[@]} -gt 0 ]]; then
  echo "❌ no-touch-check: backend file(s) modified — frontend-only revamp boundary violated"
  echo ""
  echo "Modified backend files:"
  for V in "${VIOLATIONS[@]}"; do
    echo "  - $V"
  done
  echo ""
  echo "If this is intentional:"
  echo "  - Document the reason in the commit message"
  echo "  - Re-run with: ALLOW_BACKEND_TOUCH=1 git commit -m '...'"
  echo "  - Note that lib/methodology.js changes trigger §6.1 14-day re-review with Emily"
  exit 1
fi

echo "✓ no-touch-check: frontend-only boundary maintained"
exit 0
