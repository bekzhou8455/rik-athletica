"""
TrainingPeaks Coach Scraper
Uses the public tpapi.trainingpeaks.com API discovered via network interception.
Filters for triathlon coaches and exports to coaches.csv.
"""

import requests
import csv
import time
import sys
import json

BASE_URL = 'https://tpapi.trainingpeaks.com/public/v1/coach-profiles'
OUTPUT = '/Users/bekzhou/Documents/Claude Code - Gstack/lab/coaches.csv'

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://www.trainingpeaks.com/',
    'Origin': 'https://www.trainingpeaks.com',
}

TRIATHLON_SPORTS = {'triathlon', 'swimming', 'cycling', 'running', 'multisport', 'swim', 'bike', 'run'}

PAGE_SIZE = 100  # API max observed


def fetch_page(offset: int, sport_filter: str = '') -> dict:
    params = {
        'keywords': '',
        'location': '',
        'radius': 200,
        'units': 'mi',
        'sportTypes': sport_filter,
        'services': '',
        'languages': '',
        'abilityLevels': '',
        'genders': '',
        'trainingPeaksCertifications': '',
        'requestId': int(time.time() * 1000),
        'offset': offset,
        'limit': PAGE_SIZE,
    }
    r = requests.get(BASE_URL, params=params, headers=HEADERS, timeout=20)
    r.raise_for_status()
    return r.json()


def is_triathlon_coach(hit: dict) -> bool:
    sport_types = [s.lower() for s in hit.get('sportTypes', [])]
    preferred = [s.lower() for s in hit.get('preferredAthleteTypes', [])]
    all_sports = set(sport_types + preferred)
    return bool(all_sports & TRIATHLON_SPORTS) or 'triathlon' in ' '.join(sport_types + preferred).lower()


def clean_name(name: str) -> str:
    return name.replace('--', '').strip()


def certification_level(hit: dict) -> str:
    level = hit.get('trainingPeaksCertificationLevel', '')
    return str(level) if level else ''


def main():
    all_coaches = []
    triathlon_coaches = []
    offset = 0
    total = None
    page = 0

    print('Fetching TrainingPeaks coaches (triathlon filter)...')

    # First pass: fetch triathlon-specific results
    while True:
        try:
            data = fetch_page(offset, sport_filter='triathlon')
        except Exception as e:
            print(f'  ERROR at offset {offset}: {e}', file=sys.stderr)
            break

        hits = data.get('hits', [])
        if total is None:
            total = data.get('totalHits', 0)
            print(f'Total triathlon coaches available: {total}')

        if not hits:
            break

        for hit in hits:
            person_id = hit.get('personId', '')
            coach = {
                'person_id': str(person_id),
                'name': clean_name(hit.get('fullName', '')),
                'company': hit.get('companyName', ''),
                'email': hit.get('email', ''),
                'website': hit.get('url', ''),
                'city': hit.get('city', ''),
                'state': hit.get('stateName', '') or hit.get('state', ''),
                'country': hit.get('countryName', '') or hit.get('country', ''),
                'sports': ', '.join(hit.get('sportTypes', [])),
                'certification_level': certification_level(hit),
                'is_coach_match': 'Yes' if hit.get('isCoachMatchProgramMember') else '',
                'profile_url': f'https://www.trainingpeaks.com/coaches/{hit.get("profileSlug", "")}' if hit.get('profileSlug') else '',
                'twitter': hit.get('twitterId', ''),
                'facebook': hit.get('facebookId', ''),
                'linkedin': hit.get('linkedInId', ''),
                'services': ', '.join(hit.get('coachServices', [])),
                'bio_snippet': (hit.get('summaryText', '') or '')[:200].replace('\n', ' '),
            }
            if coach['name'] and coach['country'] in ('', 'United States', 'US', 'USA', 'Canada', 'Australia', 'United Kingdom', 'New Zealand'):
                triathlon_coaches.append(coach)

        page += 1
        offset += PAGE_SIZE
        print(f'  Page {page}: {len(hits)} hits, running total: {len(triathlon_coaches)} tri coaches')

        if offset >= min(total, 2000):  # cap at 2000 to avoid hammering
            break

        time.sleep(0.5)

    # Deduplicate by personId (already stored in profile_url slug) or name+state
    seen = set()
    deduped = []
    for c in triathlon_coaches:
        # Use personId as unique key — guaranteed unique per coach
        key = c.get('person_id', '') or f"{c['name'].lower().strip()}|{c['state'].lower().strip()}"
        if key and key not in seen:
            seen.add(key)
            deduped.append(c)

    # Sort by certification level desc, then name
    deduped.sort(key=lambda c: (
        -int(c['certification_level']) if c['certification_level'].isdigit() else 0,
        c['name']
    ))

    # Write CSV
    fieldnames = ['person_id', 'name', 'company', 'email', 'website', 'city', 'state', 'country',
                  'sports', 'certification_level', 'is_coach_match', 'profile_url',
                  'twitter', 'facebook', 'linkedin', 'services', 'bio_snippet']

    with open(OUTPUT, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(deduped)

    print(f'\n✓ Done — {len(deduped)} unique triathlon coaches written to {OUTPUT}')
    print(f'  With email: {sum(1 for c in deduped if c["email"])}')
    print(f'  With website: {sum(1 for c in deduped if c["website"])}')
    print(f'  Certified: {sum(1 for c in deduped if c["certification_level"])}')


if __name__ == '__main__':
    main()
