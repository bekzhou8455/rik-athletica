#!/usr/bin/env python3
"""
Kit tag ID fetcher.

Reads KIT_API_SECRET from env, hits Kit v4 API, and prints:
  1. A name → id table (visual sanity check)
  2. Ready-to-run `vercel env add` commands for each of the 11 KIT_TAG_* vars
  3. Sanity check that the 5 by-name tags exist (post-audit-nurture etc.)

Usage:
  KIT_API_SECRET=kit_... ./scripts/kit-fetch-tag-ids.py

Then paste the commands into your shell (where `vercel` CLI is linked
to the rik-athletica project). After all are set:
  vercel --prod --yes --scope rik-athletica
"""
import json
import os
import sys
import urllib.request

# Env-var name → exact Kit tag name (case-sensitive)
ENV_TO_TAG = [
    ("KIT_TAG_AUDIT_SUBMITTED",   "audit-submitted"),
    ("KIT_TAG_AUDIT_DELIVERED",   "audit-delivered"),
    ("KIT_TAG_AUDIT_NO_CONVERT",  "audit-no-convert"),
    ("KIT_TAG_AUDIT_CONVERTED",   "audit-converted"),
    ("KIT_TAG_TIER_BUNDLE",       "audit-tier-bundle"),
    ("KIT_TAG_TIER_BUNDLE_PDF",   "audit-tier-bundle-pdf"),
    ("KIT_TAG_TIER_SPRINT",       "audit-tier-sprint"),
    ("KIT_TAG_TIER_PREMIUM",      "audit-tier-premium"),
    ("KIT_TAG_CONVERTED_BUNDLE",  "audit-converted-bundle"),
    ("KIT_TAG_CONVERTED_SPRINT",  "audit-converted-sprint"),
    ("KIT_TAG_CONVERTED_PREMIUM", "audit-converted-premium"),
]

# Tags resolved by NAME via v4 API (no env var — but must exist in Kit)
BY_NAME_TAGS = [
    "post-audit-nurture",
    "cart-recovery-bundle",
    "cart-recovery-sprint",
    "cart-recovery-premium",
    "bundle-to-sprint-upsell",
]


def fetch_tags(secret):
    req = urllib.request.Request(
        "https://api.kit.com/v4/tags?per_page=500",
        headers={"Authorization": f"Bearer {secret}"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read().decode("utf-8"))
    return {t["name"]: str(t["id"]) for t in data.get("tags", [])}


def main():
    secret = os.environ.get("KIT_API_SECRET")
    if not secret:
        print("ERROR: set KIT_API_SECRET in your environment first.", file=sys.stderr)
        print("       export KIT_API_SECRET=kit_...", file=sys.stderr)
        sys.exit(1)

    try:
        tags = fetch_tags(secret)
    except Exception as e:
        print(f"ERROR fetching tags from Kit: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Fetched {len(tags)} tags from Kit.\n")

    # ── 1. env-var mapping table ─────────────────────────────────────────────
    print("─── ENV VAR → KIT TAG ID ───")
    missing = []
    for env_var, tag_name in ENV_TO_TAG:
        tag_id = tags.get(tag_name)
        if tag_id:
            print(f"  {env_var:30s} = {tag_id:>10s}   ({tag_name})")
        else:
            print(f"  {env_var:30s} = MISSING        ({tag_name})  WARN")
            missing.append(tag_name)

    # ── 2. by-name tags sanity check ─────────────────────────────────────────
    print("\n─── BY-NAME TAGS (no env var — must exist in Kit) ───")
    for tag_name in BY_NAME_TAGS:
        if tag_name in tags:
            print(f"  ok  {tag_name}")
        else:
            print(f"  XX  {tag_name}  (MISSING)")
            missing.append(tag_name)

    if missing:
        print(f"\nWARNING: {len(missing)} tag(s) missing from Kit:")
        for n in missing:
            print(f"    - {n}")
        print("Create them at https://app.kit.com/subscribers/tags before proceeding.")

    # ── 3. ready-to-paste vercel commands ────────────────────────────────────
    print("\n─── VERCEL ENV ADD COMMANDS ───")
    print("# Paste these into your shell (vercel CLI must be linked to rik-athletica).")
    print("# Pipes the value via stdin so no interactive prompt is shown.")
    print("# When all are set, redeploy:  vercel --prod --yes --scope rik-athletica")
    print()
    for env_var, tag_name in ENV_TO_TAG:
        tag_id = tags.get(tag_name)
        if tag_id:
            print(f'echo "{tag_id}" | vercel env add {env_var} production')

    if missing:
        sys.exit(2)


if __name__ == "__main__":
    main()
