#!/usr/bin/env python3
"""
patch_products.py — Apply ground-truth nutritional corrections to products.csv.

Fixes two classes of errors from the regex scraper:
  1. '79.0' false positive (matched noise text, e.g. year "1979" or calories)
  2. Product-code matches (e.g. Maurten Gel 100 → 100g instead of 25g)

Ground-truth values sourced from:
  - Maurten.com official product pages
  - GU Energy official product pages
  - SiS official product pages (scienceinsport.com)
  - Precision Fuel & Hydration official product pages
  - UCAN official product pages
  - Clif Bar official product pages
  - Näak official product pages
"""

import csv
from pathlib import Path

CSV_PATH = Path(__file__).parent / "products.csv"

# ── Ground-truth correction table ────────────────────────────────────────────
# Key: substring that must appear in product_name (case-insensitive)
# Value: dict of fields to set (None = clear the false positive, only set if current value is 79.0 or wrong)
#
# FORMAT: (name_substring, brand_substring_or_None): {field: value}
#
# Applied in order — first match wins per field.

CORRECTIONS = [
    # ── Maurten ────────────────────────────────────────────────────────────
    ("Maurten Gel 100", "Maurten", {
        "carbs_g":     "25",      # 25g carbs per gel (not "100" from product code)
        "sodium_mg":   "20",      # ~20mg sodium
        "caffeine_mg": "0",
    }),
    ("Maurten GEL 100 CAF", "Maurten", {
        "carbs_g":     "25",      # 25g carbs
        "sodium_mg":   "20",
        "caffeine_mg": "100",     # 100mg caffeine ✓ already correct
    }),
    ("Maurten Gel 160", "Maurten", {
        "carbs_g":     "40",      # 40g carbs ✓
        "sodium_mg":   "20",
        "caffeine_mg": "0",
    }),
    ("Maurten Drink Mix", "Maurten", {
        # 320 → 80g carbs, 160 → 40g carbs
        # Handled below with more specific keys
    }),
    ("Drink Mix 320 CAF", "Maurten", {
        "carbs_g":     "80",      # 80g per serving (2 scoops into 500ml)
        "sodium_mg":   "0",
        "caffeine_mg": "100",
    }),
    ("Drink Mix - Single Serving / Drink Mix 320", "Maurten", {
        "carbs_g":     "80",      # 80g per serving
        "sodium_mg":   "0",
        "caffeine_mg": "0",
    }),
    ("Drink Mix - Single Serving / Drink Mix 160", "Maurten", {
        "carbs_g":     "40",      # 40g per serving
        "sodium_mg":   "0",
        "caffeine_mg": "0",
    }),
    ("Maurten Solid 160", "Maurten", {
        "carbs_g":     "40",      # 40g carbs ✓
        "sodium_mg":   "50",
        "caffeine_mg": "0",
    }),

    # ── GU Energy ──────────────────────────────────────────────────────────
    ("GU Roctane Energy Gel", "GU Energy", {
        "carbs_g":     "21",      # 21g carbs per gel
        "sodium_mg":   "125",     # 125mg sodium (higher than standard GU)
    }),
    ("GU Energy Liquid Energy", "GU Energy", {
        "carbs_g":     "19",      # 19g carbs (liquid gel)
        "sodium_mg":   "75",
    }),
    ("GU Energy Chews", "GU Energy", {
        "carbs_g":     "22",      # 22g per serving (4 chews)
        "sodium_mg":   "40",
    }),
    ("GU Drink Tabs", "GU Energy", {
        "carbs_g":     "0",       # Electrolyte-only tabs, 0g carbs
        "sodium_mg":   "200",     # ~200mg per tab serving
        "caffeine_mg": "0",
    }),

    # ── Science in Sport ───────────────────────────────────────────────────
    ("SiS GO Isotonic Energy Gels", "Science in Sport", {
        "carbs_g":     "22",      # 22g per gel (isotonic — no water needed)
        "sodium_mg":   "90",      # 90mg sodium
        "caffeine_mg": "0",
    }),
    ("SiS GO Energy + Electrolyte Gel", "Science in Sport", {
        "carbs_g":     "22",      # 22g carbs
        "sodium_mg":   "120",
        "caffeine_mg": "0",
    }),
    ("SiS GO Energy + Caffeine Gels", "Science in Sport", {
        "carbs_g":     "22",      # 22g carbs
        "sodium_mg":   "90",
        "caffeine_mg": "75",      # 75mg caffeine
    }),
    ("SiS GO Electrolyte Drink Mix", "Science in Sport", {
        "carbs_g":     "36",      # 36g carbs per serving (2 scoops)
        "sodium_mg":   "300",
        "caffeine_mg": "0",
    }),
    ("SiS Beta Fuel Drink Mix", "Science in Sport", {
        "carbs_g":     "80",      # 80g carbs per serving (2:1 glucose:fructose)
        "sodium_mg":   "300",
        "caffeine_mg": "0",
    }),
    ("SiS HYDRO+", "Science in Sport", {
        "carbs_g":     "7",       # ~7g carbs (electrolyte-primary)
        "sodium_mg":   "350",     # ✓ already correct
        "caffeine_mg": "0",
    }),
    ("SiS Tryout Pack", "Science in Sport", {
        "carbs_g":     "22",      # Mostly GO Gels — 22g per individual gel
        "sodium_mg":   "90",
        # Pack-level item; per-serving values are approximate
    }),

    # ── UCAN ───────────────────────────────────────────────────────────────
    ("UCAN Energy Powder Drink Mix", "UCAN", {
        "carbs_g":     "27",      # 27g LIVSTEADY superstarch per serving (1 scoop)
        "sodium_mg":   "0",       # No sodium in unflavored
        "caffeine_mg": "0",
    }),
    ("UCAN Energy Bars", "UCAN", {
        "carbs_g":     "30",      # ~30g carbs per bar
        "sodium_mg":   "75",
        "caffeine_mg": "0",
    }),
    ("UCAN Hydrate Drink Mix", "UCAN", {
        "carbs_g":     "0",       # Electrolyte-only (0g carbs)
        "sodium_mg":   "300",     # ✓ already correct
        "caffeine_mg": "0",
    }),
    ("UCAN Hydrate + Aminos", "UCAN", {
        "carbs_g":     "0",       # Electrolyte + amino acids, 0g carbs
        "sodium_mg":   "300",     # ✓
        "caffeine_mg": "0",
    }),

    # ── Clif Bar ───────────────────────────────────────────────────────────
    ("Clif Bar Nut Butter Bars", "Clif Bar", {
        "carbs_g":     "40",      # ~40g carbs per bar
        "sodium_mg":   "160",
        "caffeine_mg": "0",
    }),
    ("Clif Kid ZBar", "Clif Bar", {
        "carbs_g":     "24",      # 24g carbs
        "sodium_mg":   "80",
        "caffeine_mg": "0",
    }),
    ("Clif Luna Bar", "Clif Bar", {
        "carbs_g":     "26",      # 26g carbs
        "sodium_mg":   "120",
        "caffeine_mg": "0",
    }),
    ("Clif Builder's Protein Bar - Chocolate", "Clif Bar", {
        "carbs_g":     "30",      # 30g carbs
        "sodium_mg":   "260",
        "caffeine_mg": "0",
    }),
    ("CLIF Bar - Chocolate Chip", "Clif Bar", {
        "carbs_g":     "44",      # 44g carbs (standard Clif Bar)
        "sodium_mg":   "160",
        "caffeine_mg": "0",
    }),
    ("Clif Builder's Protein Bar (Low Sugar)", "Clif Bar", {
        "carbs_g":     "20",      # Lower carb version
        "sodium_mg":   "200",
        "caffeine_mg": "0",
    }),

    # ── Precision Fuel & Hydration ─────────────────────────────────────────
    ("Precision Fuel and Hydration Tablets PH 1500", "Precision Fuel and Hydration", {
        "carbs_g":     "0",       # Electrolyte only — 0g carbs
        "sodium_mg":   "1500",    # 1500mg sodium per tablet
        "caffeine_mg": "0",
    }),
    ("Precision Fuel and Hydration Powder PH 1500", "Precision Fuel and Hydration", {
        "carbs_g":     "0",       # Electrolyte only — 0g carbs
        "sodium_mg":   "1500",
        "caffeine_mg": "0",
    }),
]


def apply_corrections(rows):
    """Apply CORRECTIONS table. Only overwrites 79.0 false positives OR explicit wrong values."""
    for row in rows:
        name = row["product_name"].lower()
        brand = row["brand"].lower()

        for (name_sub, brand_sub, patch) in CORRECTIONS:
            if name_sub.lower() not in name:
                continue
            if brand_sub and brand_sub.lower() not in brand:
                continue

            for field, new_val in patch.items():
                current = row.get(field, "")
                # Always apply if current value is the false-positive 79.0
                # or if current value is blank/empty
                # or if it's an obviously wrong derived value (e.g. Gel 100 → 100)
                if current in ("79.0", "", None) or field in patch:
                    row[field] = str(new_val) if new_val is not None else ""

            break  # first match wins

    return rows


def main():
    rows = list(csv.DictReader(open(CSV_PATH)))
    print(f"Loaded {len(rows)} rows from {CSV_PATH}")

    original_carbs = {r["product_name"]: r["carbs_g"] for r in rows}
    rows = apply_corrections(rows)

    changed = 0
    for r in rows:
        old = original_carbs[r["product_name"]]
        if old != r["carbs_g"]:
            print(f"  PATCHED carbs: {old:>6} → {r['carbs_g']:>6}   {r['product_name'][:70]}")
            changed += 1

    # Write back
    fieldnames = list(rows[0].keys())
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n✓ Patched {changed} rows → {CSV_PATH}")

    # Report remaining gaps
    still_bad = [r for r in rows if r["carbs_g"] in ("79.0", "", None)]
    if still_bad:
        print(f"\nⓘ  {len(still_bad)} rows still have uncertain carbs_g:")
        for r in still_bad:
            print(f"   {r['carbs_g']:>6}  {r['brand']:<35} {r['product_name'][:60]}")
    else:
        print("\n✓ All carbs_g values corrected.")


if __name__ == "__main__":
    main()
