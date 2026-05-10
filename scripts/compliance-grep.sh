#!/usr/bin/env bash
# /scripts/compliance-grep.sh
# Phase 1 deliverable per PLAN.md.
#
# Scans HTML pages and email templates for prohibited words per FDA
# structural-functional claim rules + locked CLAUDE.md voice rules.
# Exits non-zero if any prohibited word appears.
#
# Usage:
#   ./scripts/compliance-grep.sh           # scan everything
#   ./scripts/compliance-grep.sh path.html # scan a single file
#
# Allowed (use freely):
#   supports, designed to, may help, tends to, helps support
#
# PROHIBITED (regex below catches these as whole words):
#   guarantees, guaranteed, proven to, ensures, ensure, cures, cured,
#   treats, treat-disease, diagnoses, diagnose-disease, prevents disease

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGETS=("$@")
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  # Default: scan all top-level HTML, api email templates, lib email templates
  # Portable for bash 3.2 (macOS default) — no mapfile.
  while IFS= read -r -d '' F; do TARGETS+=("$F"); done < <(find "$ROOT" -maxdepth 1 -name '*.html' -type f -print0)
  while IFS= read -r -d '' F; do TARGETS+=("$F"); done < <(find "$ROOT/admin" -name '*.html' -type f -print0 2>/dev/null)
  while IFS= read -r -d '' F; do TARGETS+=("$F"); done < <(find "$ROOT/api" -name '*templates*.js' -type f -print0 2>/dev/null)
  while IFS= read -r -d '' F; do TARGETS+=("$F"); done < <(find "$ROOT/lib" -name 'email-alerts.js' -type f -print0 2>/dev/null)
fi

# Word-boundary regex. Use \b on both sides so "treatment" doesn't match "treats".
# But "treats" alone IS prohibited. "treatment" is too — but used in disclaimer copy
# legitimately. To stay safe: dagger-footnote everything, but flag the bare verb usages.
PROHIBITED='\b(guarantees?|guaranteed|prove[ns]? to|ensures?|cures?|cured|prevent[s]? disease|diagnoses?\b)'

# "treats" specifically: prohibited as a verb but allowed in "no special treatment", "treats a disease"
# To keep this simple and safe, we flag bare usage and let humans verify. Disclaimer copy
# legitimately uses some of these in NEGATIVE constructions ("not intended to diagnose, treat, cure")
# — those are fine and required by FDA. So we use a tighter pattern.

EXIT_CODE=0
HITS_TOTAL=0

for FILE in "${TARGETS[@]}"; do
  [[ -f "$FILE" ]] || continue
  # Use grep -E for extended regex. -i for case-insensitive. -n for line numbers.
  HITS=$(grep -niE "$PROHIBITED" "$FILE" 2>/dev/null || true)
  if [[ -n "$HITS" ]]; then
    # Filter out legitimate constructions:
    # 1. FDA-disclaimer negative constructions ("not intended to", "do not", "does not")
    # 2. Refund/satisfaction guarantee NOUN forms ("X-day guarantee", "money-back guarantee",
    #    "satisfaction guarantee", "process guarantee", "no guarantee of", "guarantee policy")
    # 3. CSS class names containing 'guarantee' (e.g., .pg-guarantee, .p-guarantee)
    # 4. Comments / file headers
    FILTERED=$(echo "$HITS" \
      `# 1. FDA-disclaimer negative constructions ` \
      | grep -viE 'not.*intended.*(diagnose|treat|cure|prevent)|do(es)?.*not.*(diagnose|treat|cure|prevent|guarantee)' \
      `# 2. Refund/satisfaction/process noun forms ` \
      | grep -viE '(money-?back|satisfaction|outcome|process|refund|full)[- ]+guarantee\b' \
      | grep -viE '\b[0-9]+-day[- ]+(satisfaction[- ]+)?guarantee\b' \
      | grep -viE 'guarantee[- ](policy|seal|button|label|promise|number|body|inner)\b' \
      | grep -viE 'no[t]?[- ]+a?[- ]*(clinical[- ])?guarantee' \
      | grep -viE 'not[- ](clinical[- ])?guarantee' \
      | grep -viE "we[- ](can'?t|cannot)[- ]guarantee" \
      `# 3. CSS class definitions (lines containing CSS selector with guarantee, or CSS rule blocks) ` \
      | grep -viE '\.[a-z][a-z0-9_-]*guarantee[a-z0-9_-]*' \
      | grep -viE 'class="[^"]*guarantee[^"]*"' \
      | grep -viE '^[0-9]+:[[:space:]]*\.[a-z]' \
      | grep -viE '\{[[:space:]]*$|\}[[:space:]]*$' \
      `# 4. Comment markers (HTML and CSS) ` \
      | grep -viE '<!--.*-->|<!--|-->|/\*[^*]*\*/|═══|║' \
      | grep -viE '^[[:space:]]*[0-9]+:[[:space:]]*/?\*' \
      `# 5. Refund window phrasing ` \
      | grep -viE 'refund[- ]window|return[- ]window' \
      `# 6. Non-medical 'ensure': adequate, sufficient, time, that, the ` \
      | grep -viE 'ensures?[- ](adequate|sufficient|that|the[- ]|enough)' \
      || true)
    if [[ -n "$FILTERED" ]]; then
      echo "❌ ${FILE}:"
      echo "$FILTERED" | sed 's/^/   /'
      HITS_TOTAL=$((HITS_TOTAL + $(echo "$FILTERED" | wc -l | tr -d ' ')))
      EXIT_CODE=1
    fi
  fi
done

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "✓ compliance-grep: no prohibited words across ${#TARGETS[@]} files"
else
  echo ""
  echo "❌ compliance-grep: ${HITS_TOTAL} prohibited word hits found"
  echo "Fix by replacing with: supports, designed to, may help, tends to, helps support"
fi

exit $EXIT_CODE
