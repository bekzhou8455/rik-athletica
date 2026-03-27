#!/usr/bin/env python3
"""
USAT Triathlon Club Scraper
Sources:
  1. Algolia API (primary) — member.usatriathlon.org/find-a-club uses prod_clubs_18429842
  2. Individual club pages — member.usatriathlon.org/club/{id} (findable clubs only)

Output columns: club_name, city, state, region, member_count,
                website, contact_email, social_media, notes
"""

import csv
import json
import re
import sys
import time
import warnings
from urllib.request import urlopen, Request

warnings.filterwarnings("ignore")

# ── Algolia config ──────────────────────────────────────────────────────────
ALGOLIA_APP_ID  = "Z6OHYBM37C"
ALGOLIA_API_KEY = "9d3d31de02b197ee95e8ca19a5566175"
ALGOLIA_INDEX   = "prod_clubs_18429842"
ALGOLIA_URL     = f"https://{ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/{ALGOLIA_INDEX}/query"

ALGOLIA_HEADERS = {
    "X-Algolia-Application-Id": ALGOLIA_APP_ID,
    "X-Algolia-API-Key":         ALGOLIA_API_KEY,
    "Content-Type":              "application/json",
    "User-Agent":                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
}

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# ── US state lookup ─────────────────────────────────────────────────────────
US_STATES_FULL = {
    "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
    "Delaware","District of Columbia","Florida","Georgia","Hawaii","Idaho",
    "Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine",
    "Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri",
    "Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico",
    "New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon",
    "Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee",
    "Texas","Utah","Vermont","Virginia","Washington","West Virginia",
    "Wisconsin","Wyoming",
}

# Domains that are never "the club website"
SKIP_DOMAINS = (
    "usatriathlon.org", "teamusa.org", "d393vgk75qox1d.cloudfront.net",
    "facebook.com", "twitter.com", "x.com", "instagram.com", "strava.com",
    "youtube.com", "linkedin.com", "connect.facebook.net", "google.com",
    "googletagmanager.com", "btstatic.com", "recaptcha", "gstatic.com",
    "googleadservices.com", "doubleclick.net", "paypal.com",
)

SOCIAL_DOMAINS = (
    "facebook.com", "twitter.com", "x.com", "instagram.com",
    "strava.com", "youtube.com", "linkedin.com",
)


# ── Helpers ─────────────────────────────────────────────────────────────────

def algolia_query(filters: str) -> list:
    body = json.dumps({
        "query": "",
        "hitsPerPage": 1000,
        "page": 0,
        "filters": filters,
        "attributesToRetrieve": [
            "id","name","city","state","region","zip","city_state",
            "club_email","owner_email","owner_name",
            "disciplines","specialties","guid","findable",
        ],
    }).encode()
    req = Request(ALGOLIA_URL, data=body, headers=ALGOLIA_HEADERS, method="POST")
    try:
        with urlopen(req, timeout=20) as r:
            data = json.loads(r.read().decode())
            return data.get("hits", [])
    except Exception as e:
        print(f"  [warn] Algolia error: {e}", file=sys.stderr)
        return []


def fetch_all_from_algolia() -> list:
    """Paginate by ID range to bypass the 1000-hit limit."""
    all_hits, seen = [], set()
    for lo, hi in [(0,1000),(1000,2000),(2000,3000),(3000,4000),(4000,5000),(5000,6000)]:
        hits = algolia_query(f"__soft_deleted=0 AND id>={lo} AND id<{hi}")
        new  = [h for h in hits if h.get("id") not in seen]
        seen.update(h["id"] for h in new)
        all_hits.extend(new)
        print(f"  IDs {lo:4d}–{hi:4d}: {len(hits):4d} clubs  (running total: {len(all_hits)})")
    return all_hits


def scrape_club_page(club_id: int) -> dict:
    """Fetch club detail page; extract website + social links."""
    url = f"https://member.usatriathlon.org/club/{club_id}"
    out = {"website": "", "social_media": ""}
    try:
        req = Request(url, headers=BROWSER_HEADERS)
        with urlopen(req, timeout=8) as r:
            html = r.read().decode("utf-8", errors="replace")
    except Exception:
        return out

    # All href links in the page
    all_hrefs = re.findall(r'href=["\']([^"\']+)["\']', html)

    # Website: first external link that's not in skip-list
    for href in all_hrefs:
        if not href.startswith("http"):
            continue
        if any(d in href for d in SKIP_DOMAINS):
            continue
        out["website"] = href
        break

    # Social links
    socials = []
    for href in all_hrefs:
        if any(d in href for d in SOCIAL_DOMAINS) and href.startswith("http"):
            if href not in socials:
                socials.append(href)
    out["social_media"] = "; ".join(socials[:3])
    return out


def clean_email(v) -> str:
    s = str(v or "").strip()
    if s in ("[]","None","null",""):
        return ""
    return s if "@" in s else ""


def parse_state(hit: dict) -> str:
    """Get US state name from Algolia hit."""
    state = (hit.get("state") or "").strip()
    if state in US_STATES_FULL:
        return state
    # Fall back to city_state field
    cs = (hit.get("city_state") or "").strip()
    if "," in cs:
        candidate = cs.rsplit(",", 1)[-1].strip()
        if candidate in US_STATES_FULL:
            return candidate
    return state  # may be empty or non-US


def parse_city(hit: dict) -> str:
    city = (hit.get("city") or "").strip()
    if not city:
        cs = (hit.get("city_state") or "").strip()
        city = cs.split(",")[0].strip() if "," in cs else cs
    return city


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    OUT = "/Users/bekzhou/Documents/Claude Code - Gstack/lab/triclubs.csv"

    print("=" * 62)
    print("USAT Triathlon Club Scraper")
    print("=" * 62)

    # ── 1. Algolia fetch ────────────────────────────────────────────────
    print("\n[1/4] Fetching all clubs from Algolia API...")
    raw = fetch_all_from_algolia()
    print(f"      Total raw hits: {len(raw)}")

    # ── 2. Normalize ────────────────────────────────────────────────────
    print("\n[2/4] Normalising records...")
    clubs = []
    for h in raw:
        state = parse_state(h)
        # Skip non-US (skip records with a known non-US state)
        if state and state not in US_STATES_FULL:
            continue
        disciplines = h.get("disciplines") or []
        specialties = h.get("specialties") or []
        notes_parts = []
        if disciplines:
            notes_parts.append("Disciplines: " + ", ".join(sorted(disciplines)))
        if specialties:
            notes_parts.append("Specialties: " + ", ".join(sorted(specialties)))
        owner = (h.get("owner_name") or "").strip()
        if owner:
            notes_parts.append(f"Contact: {owner}")

        clubs.append({
            "club_name":     (h.get("name") or "").strip(),
            "city":          parse_city(h),
            "state":         state,
            "region":        (h.get("region") or "").strip(),
            "member_count":  "",
            "website":       "",
            "contact_email": clean_email(h.get("club_email")) or clean_email(h.get("owner_email")),
            "social_media":  "",
            "notes":         " | ".join(notes_parts),
            # internal
            "_id":       h.get("id"),
            "_findable": h.get("findable", 0),
        })
    print(f"      US clubs: {len(clubs)}")

    # ── 3. Scrape individual pages for findable clubs ───────────────────
    findable = [c for c in clubs if c["_findable"] == 1 and c["_id"]]
    print(f"\n[3/4] Scraping {len(findable)} public club pages for website URLs...")
    print(f"      (8s timeout, 0.4s sleep between requests)")

    websites_found = 0
    for i, club in enumerate(findable):
        data = scrape_club_page(club["_id"])
        if data["website"]:
            club["website"]      = data["website"]
            club["social_media"] = data["social_media"]
            websites_found += 1
        elif data["social_media"]:
            club["social_media"] = data["social_media"]

        if (i + 1) % 50 == 0:
            print(f"      {i+1}/{len(findable)} done — websites found: {websites_found}")
        time.sleep(0.4)

    print(f"      Complete. Websites found: {websites_found}/{len(findable)}")

    # ── 4. Sort, dedup, write ───────────────────────────────────────────
    print(f"\n[4/4] Writing CSV...")
    clubs.sort(key=lambda c: (c["state"] or "ZZZ", c["club_name"].lower()))

    seen, deduped = set(), []
    for c in clubs:
        key = (c["club_name"].lower(), c["city"].lower())
        if key not in seen:
            seen.add(key)
            deduped.append(c)

    FIELDS = ["club_name","city","state","region","member_count",
              "website","contact_email","social_media","notes"]
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        w.writerows(deduped)

    # ── Summary ─────────────────────────────────────────────────────────
    with_email   = sum(1 for c in deduped if c["contact_email"])
    with_website = sum(1 for c in deduped if c["website"])
    with_state   = sum(1 for c in deduped if c["state"] in US_STATES_FULL)
    b2b_targets  = sum(1 for c in deduped if c["contact_email"] and c["state"] in US_STATES_FULL)

    print(f"\n{'='*62}")
    print("RESULTS")
    print(f"{'='*62}")
    print(f"  Total US clubs in CSV : {len(deduped)}")
    print(f"  With known state      : {with_state}")
    print(f"  With contact email    : {with_email}")
    print(f"  With website URL      : {with_website}")
    print(f"  Email + state (B2B)   : {b2b_targets}  ← best outreach targets")
    print(f"\n  Output → {OUT}")

    print("\nFirst 5 rows with email:")
    shown = 0
    for c in deduped:
        if c["contact_email"]:
            print(f"  {c['club_name']:45s} {c['city']}, {c['state']}")
            print(f"    email: {c['contact_email']}  web: {c['website'] or '—'}")
            shown += 1
            if shown >= 5:
                break


if __name__ == "__main__":
    main()
