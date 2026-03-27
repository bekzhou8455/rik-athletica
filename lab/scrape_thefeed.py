#!/usr/bin/env python3
"""
scrape_thefeed.py — Scrape thefeed.com for endurance nutrition SKUs.

Strategy:
  1. Download the Google Product Feed XML (structured, fast, all SKUs)
  2. Filter to target brands + product categories
  3. For each product URL, fetch the product page and extract nutrition facts
  4. Export to lab/products.csv

Respects robots.txt (product/category pages are allowed).
Rate: 1 request / 2 seconds.

Usage:
  python3 lab/scrape_thefeed.py
  # → writes lab/products.csv

Requirements:
  pip3 install scrapling requests beautifulsoup4 lxml
"""

import csv
import re
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ── Config ──────────────────────────────────────────────────────────────────

FEED_URL   = "https://thefeed.com/google-product-feed.xml"
OUTPUT_CSV = Path(__file__).parent / "products.csv"
RATE_LIMIT_S = 2.0   # seconds between requests — be respectful

TARGET_BRANDS = {
    "maurten",
    "gu energy",
    "science in sport",
    "ucan",
    "näak", "naak",
    "clif bar", "clif",
    "precision fuel and hydration", "precision hydration", "pfh",
}

TARGET_TYPES = {
    "gels", "chews", "bars", "hydration", "waffles",
}

NS = {"g": "http://base.google.com/ns/1.0"}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

# ── Helpers ──────────────────────────────────────────────────────────────────

def norm(s):
    return (s or "").strip().lower()


def extract_number(pattern, text, group=1):
    """Return first float match for pattern in text, or None."""
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        try:
            return float(m.group(group).replace(",", ""))
        except (ValueError, IndexError):
            return None
    return None


def parse_nutrition_from_description(desc):
    """
    Best-effort extraction of key nutrition facts from product description text.
    Returns dict with keys: carbs_g, sodium_mg, caffeine_mg, servings_per_package.
    Missing values are None.
    """
    result = {
        "carbs_g": None,
        "sodium_mg": None,
        "caffeine_mg": None,
        "servings_per_package": None,
    }

    if not desc:
        return result

    # Carbs (grams per serving)
    # Patterns: "25g carbohydrates", "25 grams of carbs", "22g of carbs", "carbs: 22g"
    carb_patterns = [
        r"(\d+\.?\d*)\s*g(?:rams?)?\s+(?:of\s+)?carb",
        r"carb[a-z]*[:\s]+(\d+\.?\d*)\s*g",
        r"(\d+\.?\d*)\s*g(?:rams?)?\s+of\s+(?:total\s+)?carbohydrate",
        r"total carbohydrate[s]?\s*[\:\.]\s*(\d+\.?\d*)",
    ]
    for p in carb_patterns:
        v = extract_number(p, desc)
        if v is not None:
            result["carbs_g"] = v
            break

    # Sodium (mg per serving)
    sodium_patterns = [
        r"(\d+\.?\d*)\s*mg\s+(?:of\s+)?sodium",
        r"sodium[:\s]+(\d+\.?\d*)\s*mg",
        r"(\d+\.?\d*)\s*milligrams?\s+(?:of\s+)?sodium",
    ]
    for p in sodium_patterns:
        v = extract_number(p, desc)
        if v is not None:
            result["sodium_mg"] = v
            break

    # Caffeine (mg per serving)
    caffeine_patterns = [
        r"(\d+\.?\d*)\s*mg\s+(?:of\s+)?caffeine",
        r"caffeine[:\s]+(\d+\.?\d*)\s*mg",
        r"(\d+\.?\d*)\s*milligrams?\s+(?:of\s+)?caffeine",
        r"caf\s+(\d+)",                     # e.g. "CAF 100" in Maurten naming
    ]
    for p in caffeine_patterns:
        v = extract_number(p, desc)
        if v is not None:
            result["caffeine_mg"] = v
            break

    # Servings per package (for price-per-serving calc)
    serving_patterns = [
        r"(\d+)\s+servings?\s+per\s+(?:container|package|box|pouch|bag|tub)",
        r"(?:box|pack|bag)\s+of\s+(\d+)",
        r"(\d+)\s+(?:single\s+)?servings?",
        r"\((\d+)\s+servings?\)",
    ]
    for p in serving_patterns:
        v = extract_number(p, desc)
        if v is not None:
            result["servings_per_package"] = int(v)
            break

    return result


def parse_nutrition_from_product_page(url):
    """
    Fetch the product page and extract nutrition facts from the HTML.
    Returns same dict as parse_nutrition_from_description.
    Falls back to empty dict on error.
    """
    result = {
        "carbs_g": None,
        "sodium_mg": None,
        "caffeine_mg": None,
        "servings_per_package": None,
    }
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        # Try to find a nutrition facts table or structured nutrition section
        full_text = soup.get_text(separator=" ", strip=True)
        result = parse_nutrition_from_description(full_text)

        # Shopify product pages often have nutrition in a structured table
        # Look for table rows with "Total Carbohydrate", "Sodium", "Caffeine"
        for row in soup.find_all("tr"):
            cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
            row_text = " ".join(cells)

            if result["carbs_g"] is None:
                if any(kw in row_text.lower() for kw in ["total carb", "carbohydrate"]):
                    v = extract_number(r"(\d+\.?\d*)\s*g", row_text)
                    if v is not None:
                        result["carbs_g"] = v

            if result["sodium_mg"] is None:
                if "sodium" in row_text.lower():
                    v = extract_number(r"(\d+\.?\d*)\s*mg", row_text)
                    if v is not None:
                        result["sodium_mg"] = v

            if result["caffeine_mg"] is None:
                if "caffeine" in row_text.lower():
                    v = extract_number(r"(\d+\.?\d*)\s*mg", row_text)
                    if v is not None:
                        result["caffeine_mg"] = v

    except Exception as e:
        print(f"    ⚠ Page fetch failed: {e}", file=sys.stderr)

    return result


def infer_servings_from_title(title):
    """Pull serving count from product title like 'Box of 12' or '(18 Servings)'."""
    patterns = [
        r"box\s+of\s+(\d+)",
        r"pack\s+of\s+(\d+)",
        r"\((\d+)\s+servings?\)",
        r"(\d+)\s+(?:single\s+)?servings?",
        r"(\d+)\s+count",
        r"(\d+)\s+pack",
    ]
    for p in patterns:
        m = re.search(p, title, re.IGNORECASE)
        if m:
            return int(m.group(1))
    return 1  # single serving default


def infer_caffeine_from_title(title):
    """Infer caffeine mg from product title (e.g. 'CAF 100' → 100mg)."""
    m = re.search(r"CAF\s+(\d+)", title, re.IGNORECASE)
    if m:
        return float(m.group(1))
    if re.search(r"\bcaffeine\b|\bcaffeinated\b", title, re.IGNORECASE):
        return 1.0  # caffeine present but amount unknown; flag > 0
    return 0.0


def category_from_type(product_type):
    pt = norm(product_type)
    if pt == "gels":
        return "gel"
    if pt == "chews":
        return "chew"
    if pt == "bars":
        return "bar"
    if pt in ("hydration", "drink mixes", "electrolytes"):
        return "drink_mix"
    if pt == "waffles":
        return "waffle"
    return pt


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("Downloading Google Product Feed …", flush=True)
    resp = requests.get(FEED_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    root = ET.fromstring(resp.content)
    items = root.find("channel").findall("item")
    print(f"  {len(items)} total items in feed", flush=True)

    # ── Filter to target brands + types ────────────────────────────────────
    candidates = []
    seen_urls = set()  # deduplicate by base URL (ignore ?variant=...)

    for item in items:
        brand = item.findtext("g:brand", default="", namespaces=NS).strip()
        ptype = item.findtext("g:product_type", default="", namespaces=NS).strip()
        title = item.findtext("g:title", default="", namespaces=NS).strip()
        link  = item.findtext("g:link", default="", namespaces=NS).strip()
        price = item.findtext("g:price", default="", namespaces=NS).strip()
        avail = item.findtext("g:availability", default="", namespaces=NS).strip()
        desc  = item.findtext("g:description", default="", namespaces=NS).strip()
        item_group = item.findtext("g:item_group_id", default="", namespaces=NS).strip()

        if norm(brand) not in TARGET_BRANDS:
            continue
        if norm(ptype) not in TARGET_TYPES:
            continue
        if avail != "in_stock":
            continue

        # Deduplicate: keep one variant per product (we want per-serving facts, not per-variant)
        base_url = link.split("?")[0]
        if base_url in seen_urls:
            continue
        seen_urls.add(base_url)

        price_val = 0.0
        if price:
            m = re.match(r"([\d.]+)", price)
            if m:
                price_val = float(m.group(1))

        candidates.append({
            "brand": brand,
            "product_type": ptype,
            "title": title,
            "url": link,
            "price_usd": price_val,
            "description": desc,
            "item_group": item_group,
        })

    print(f"  {len(candidates)} unique in-stock products from target brands + categories", flush=True)

    # ── Collect nutrition facts ─────────────────────────────────────────────
    rows = []
    total = len(candidates)

    for i, prod in enumerate(candidates, 1):
        title = prod["title"]
        print(f"[{i:3d}/{total}] {prod['brand']:30s} {title[:60]}", flush=True)

        # Step 1: parse from description text
        nutrition = parse_nutrition_from_description(prod["description"])

        # Step 2: infer caffeine from title if not found in description
        if nutrition["caffeine_mg"] is None:
            caf = infer_caffeine_from_title(title)
            nutrition["caffeine_mg"] = caf if caf > 0 else None

        # Step 3: infer servings from title (used for price-per-serving)
        servings = nutrition["servings_per_package"] or infer_servings_from_title(title)

        # Step 4: if we're still missing carbs (the critical field), scrape the page
        if nutrition["carbs_g"] is None:
            print(f"       → scraping product page for nutrition facts …", flush=True)
            time.sleep(RATE_LIMIT_S)
            page_nutrition = parse_nutrition_from_product_page(prod["url"])
            for k in ("carbs_g", "sodium_mg", "caffeine_mg"):
                if nutrition[k] is None and page_nutrition[k] is not None:
                    nutrition[k] = page_nutrition[k]
            if page_nutrition["servings_per_package"]:
                servings = page_nutrition["servings_per_package"]
        else:
            # Still do a light rate limit for feed-only entries
            time.sleep(0.3)

        price_per_serving = (
            round(prod["price_usd"] / servings, 3) if servings else None
        )

        rows.append({
            "product_name":      title,
            "brand":             prod["brand"],
            "category":          category_from_type(prod["product_type"]),
            "servings_per_pkg":  servings,
            "carbs_g":           nutrition["carbs_g"],
            "sodium_mg":         nutrition["sodium_mg"],
            "caffeine_mg":       nutrition["caffeine_mg"],
            "price_usd":         prod["price_usd"],
            "price_per_serving": price_per_serving,
            "url":               prod["url"],
        })

    # ── Write CSV ───────────────────────────────────────────────────────────
    fieldnames = [
        "product_name", "brand", "category",
        "servings_per_pkg", "carbs_g", "sodium_mg", "caffeine_mg",
        "price_usd", "price_per_serving", "url",
    ]

    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    # ── Summary ─────────────────────────────────────────────────────────────
    filled_carbs    = sum(1 for r in rows if r["carbs_g"] is not None)
    filled_sodium   = sum(1 for r in rows if r["sodium_mg"] is not None)
    filled_caffeine = sum(1 for r in rows if r["caffeine_mg"] is not None)

    print(f"\n✓ Done — {len(rows)} products written to {OUTPUT_CSV}")
    print(f"  carbs_g populated:    {filled_carbs}/{len(rows)}")
    print(f"  sodium_mg populated:  {filled_sodium}/{len(rows)}")
    print(f"  caffeine_mg populated:{filled_caffeine}/{len(rows)}")
    print(f"\nMissing carbs_g ({len(rows)-filled_carbs} rows):")
    for r in rows:
        if r["carbs_g"] is None:
            print(f"  {r['brand']:30s} {r['product_name'][:60]}")


if __name__ == "__main__":
    main()
