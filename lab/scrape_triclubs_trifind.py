"""
Tri Club Scraper — trifind.com
Scrapes all US triathlon clubs by state and exports to triclubs.csv
"""

import requests
from bs4 import BeautifulSoup
import csv
import time
import sys

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
}

STATES = [
    ('AL', 'Alabama'), ('AK', 'Alaska'), ('AZ', 'Arizona'), ('AR', 'Arkansas'),
    ('CA', 'California'), ('CO', 'Colorado'), ('CT', 'Connecticut'), ('DC', 'District of Columbia'),
    ('DE', 'Delaware'), ('FL', 'Florida'), ('GA', 'Georgia'), ('HI', 'Hawaii'),
    ('ID', 'Idaho'), ('IL', 'Illinois'), ('IN', 'Indiana'), ('IA', 'Iowa'),
    ('KS', 'Kansas'), ('KY', 'Kentucky'), ('LA', 'Louisiana'), ('ME', 'Maine'),
    ('MD', 'Maryland'), ('MA', 'Massachusetts'), ('MI', 'Michigan'), ('MN', 'Minnesota'),
    ('MS', 'Mississippi'), ('MO', 'Missouri'), ('MT', 'Montana'), ('NE', 'Nebraska'),
    ('NV', 'Nevada'), ('NH', 'New Hampshire'), ('NJ', 'New Jersey'), ('NM', 'New Mexico'),
    ('NY', 'New York'), ('NC', 'North Carolina'), ('ND', 'North Dakota'), ('OH', 'Ohio'),
    ('OK', 'Oklahoma'), ('OR', 'Oregon'), ('PA', 'Pennsylvania'), ('RI', 'Rhode Island'),
    ('SC', 'South Carolina'), ('SD', 'South Dakota'), ('TN', 'Tennessee'), ('TX', 'Texas'),
    ('UT', 'Utah'), ('VT', 'Vermont'), ('VA', 'Virginia'), ('WA', 'Washington'),
    ('WV', 'West Virginia'), ('WI', 'Wisconsin'), ('WY', 'Wyoming'),
]

OUTPUT = '/Users/bekzhou/Documents/Claude Code - Gstack/lab/triclubs.csv'


def scrape_state(state_code: str, state_name: str) -> list[dict]:
    url = f'https://www.trifind.com/Clubs/FindAClub?state={state_code}'
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
    except Exception as e:
        print(f'  ERROR {state_code}: {e}', file=sys.stderr)
        return []

    soup = BeautifulSoup(r.text, 'html.parser')

    # Find the clubs container
    container = soup.find('div', class_='triathlon_clubes')
    if not container:
        return []

    clubs = []
    # Each club is a .row div with: col name (has <a href="ClubDetails?id=N">), col city, col usat
    rows = container.find_all('div', class_='row')

    for row in rows:
        link = row.find('a', href=lambda h: h and 'ClubDetails' in str(h))
        if not link:
            continue
        name = link.get_text(strip=True)
        if not name or len(name) < 2:
            continue

        # Full profile URL
        href = link['href']
        base = 'https://www.trifind.com/Clubs/'
        profile_url = base + href if not href.startswith('http') else href

        # City is the second col div in the row
        cols = row.find_all('div', class_=lambda c: c and 'col-lg' in c)
        city = cols[1].get_text(strip=True) if len(cols) > 1 else ''

        # USAT member? (glyphicon-ok present in 3rd col)
        usat_col = cols[2] if len(cols) > 2 else None
        is_usat = bool(usat_col and usat_col.find('i', class_='glyphicon-ok')) if usat_col else False

        clubs.append({
            'club_name': name,
            'city': city,
            'state': state_name,
            'state_code': state_code,
            'region': region(state_code),
            'usat_member': 'Yes' if is_usat else '',
            'website': '',
            'contact_email': '',
            'profile_url': profile_url,
            'notes': '',
        })

    return clubs


def region(state_code: str) -> str:
    west = {'CA', 'OR', 'WA', 'NV', 'AZ', 'UT', 'CO', 'ID', 'MT', 'WY', 'NM', 'AK', 'HI'}
    south = {'TX', 'FL', 'GA', 'NC', 'SC', 'VA', 'AL', 'MS', 'LA', 'AR', 'TN', 'KY', 'WV', 'OK', 'DC', 'DE', 'MD'}
    midwest = {'IL', 'OH', 'MI', 'IN', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'}
    northeast = {'NY', 'PA', 'NJ', 'CT', 'MA', 'RI', 'VT', 'NH', 'ME'}
    if state_code in west: return 'West'
    if state_code in south: return 'South'
    if state_code in midwest: return 'Midwest'
    if state_code in northeast: return 'Northeast'
    return 'Other'


def main():
    all_clubs = []
    print(f'Scraping {len(STATES)} states...')

    for state_code, state_name in STATES:
        clubs = scrape_state(state_code, state_name)
        all_clubs.extend(clubs)
        if clubs:
            print(f'  {state_code}: {len(clubs)} clubs')
        time.sleep(0.4)  # polite crawl rate

    # Deduplicate by name+state
    seen = set()
    deduped = []
    for c in all_clubs:
        key = (c['club_name'].lower().strip(), c['state_code'])
        if key not in seen:
            seen.add(key)
            deduped.append(c)

    # Write CSV
    fieldnames = ['club_name', 'city', 'state', 'state_code', 'region', 'usat_member', 'website', 'contact_email', 'profile_url', 'notes']
    with open(OUTPUT, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(deduped)

    print(f'\n✓ Done — {len(deduped)} clubs written to {OUTPUT}')


if __name__ == '__main__':
    main()
