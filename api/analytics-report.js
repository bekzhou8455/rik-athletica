// GET /api/analytics-report?t=<ADMIN_TOKEN>&days=2
// Returns a comprehensive markdown site activity report.
//
// Filters out internal traffic: vercel.com referrals, *.vercel.app previews,
// localhost, and conversions tied to known internal/system-generated emails.

import { sql } from '@vercel/postgres';

/* ── Auth ──────────────────────────────────────────────────────────────── */

function checkAdmin(req) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const provided = req.headers['x-admin-token'] ?? req.query?.t;
  return provided === token;
}

/* ── Internal-traffic filters ──────────────────────────────────────────── */

const INTERNAL_EMAILS_EXACT = new Set([
  'bek.zhou@rikathletica.com',
  'bek.zhou@rik-sports.com',
  'bekzhou8455@gmail.com',
  'bek@rikathletica.com',
]);

function isInternalEmail(email) {
  if (!email) return false;
  const e = String(email).toLowerCase().trim();
  if (INTERNAL_EMAILS_EXACT.has(e)) return true;
  if (e.includes('+test') || e.includes('+dev') || e.includes('+qa') || e.includes('+staging')) return true;
  if (e.endsWith('@example.com') || e.endsWith('@test.com')) return true;
  if (e.startsWith('test@') || e.startsWith('dev@') || e.startsWith('qa@')) return true;
  if (e.includes('noreply') || e.includes('no-reply')) return true;
  if (e.includes('vercel.com')) return true;
  if (/^[a-f0-9]{16,}@/.test(e)) return true;
  if (/^test-[a-z0-9]+@/.test(e)) return true;
  return false;
}

function isInternalSource(source) {
  const s = (source || '').toLowerCase();
  if (s === 'vercel.com') return true;
  if (s.includes('vercel.app')) return true;
  if (s.includes('localhost')) return true;
  return false;
}

/* ── GA4 client ────────────────────────────────────────────────────────── */

const GA4_BASE = 'https://analyticsdata.googleapis.com/v1beta';
let cachedToken = null;
let tokenExp = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExp) return cachedToken;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.GA4_OAUTH_CLIENT_ID,
      client_secret: process.env.GA4_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GA4_OAUTH_REFRESH_TOKEN,
    }).toString(),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('GA4 auth failed: ' + JSON.stringify(data));
  cachedToken = data.access_token;
  tokenExp = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function ga4(propertyId, token, kind, body) {
  const path = kind === 'realtime' ? ':runRealtimeReport' : ':runReport';
  const res = await fetch(`${GA4_BASE}/properties/${propertyId}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GA4 error ${res.status}: ${await res.text()}`);
  return res.json();
}

function rows(report, dims, metrics) {
  if (!report.rows) return [];
  return report.rows.map((r) => {
    const obj = {};
    (r.dimensionValues || []).forEach((v, i) => { obj[dims[i]] = v.value; });
    (r.metricValues || []).forEach((v, i) => { obj[metrics[i]] = Number(v.value); });
    return obj;
  });
}

function total(report, idx = 0) {
  if (!report.rows || !report.rows[0]) return 0;
  return Number(report.rows[0].metricValues?.[idx]?.value ?? 0);
}

/* ── Display helpers ───────────────────────────────────────────────────── */

function friendlySource(source, medium) {
  const s = (source || '').toLowerCase();
  const m = (medium || '').toLowerCase();
  if (s === '(direct)') return 'Direct (typed URL / bookmark)';
  if (s === 'ig' && m === 'social') return 'Instagram (bio link / posts)';
  if (s === 'l.instagram.com') return 'Instagram (in-app link tap)';
  if (s.includes('instagram')) return `Instagram (${s})`;
  if (s.includes('facebook')) return `Facebook (${s})`;
  if (s.includes('tiktok')) return `TikTok (${s})`;
  if (s.includes('twitter') || s === 't.co' || s === 'x.com') return `X / Twitter (${s})`;
  if (s.includes('linkedin')) return `LinkedIn (${s})`;
  if (s.includes('youtube')) return `YouTube (${s})`;
  if (s.includes('reddit')) return `Reddit (${s})`;
  if (s === 'google' && m === 'organic') return 'Google Search (organic)';
  if (s === 'bing' && m === 'organic') return 'Bing Search (organic)';
  if (s === 'duckduckgo') return 'DuckDuckGo (organic)';
  if (s.includes('chatgpt') || s.includes('openai')) return 'ChatGPT (AI citation)';
  if (s.includes('perplexity')) return 'Perplexity (AI citation)';
  if (s.includes('claude.ai')) return 'Claude.ai (AI citation)';
  if (s.includes('gemini')) return 'Gemini (AI citation)';
  if (s === 'upgrade_hook') return 'Audit upgrade hook (deliverable → Sprint CTA)';
  if (s === 'audit_email') return 'Audit email link';
  if (m === 'cpc' || m === 'paid' || m === 'ppc') return `${s} (paid · ${m})`;
  if (m === 'email') return `Email (${s})`;
  if ((s === '(not set)' || !s) && (m === '(not set)' || !m)) return 'Unknown / untagged';
  return `${s} / ${m}`;
}

function friendlyPage(p) {
  const map = {
    '/': 'Homepage',
    '/calculator': 'Fueling Calculator',
    '/audit': 'Free Audit form',
    '/bundle': 'Bundle product ($119)',
    '/sprint': 'Sprint 4-week ($569–$899)',
    '/premium': 'Premium 1:1 ($1,599)',
    '/thank-you': 'Thank-You / post-purchase',
    '/terms': 'Terms',
    '/privacy': 'Privacy',
    '/checkin': 'Sprint check-in form',
  };
  return map[p] || p;
}

function num(n) { return (n || 0).toLocaleString(); }
function pct(n, d) { return d > 0 ? Math.round((n / d) * 100) + '%' : '—'; }
function fmtDuration(sec) {
  if (!sec || sec < 1) return '0s';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s < 10 ? '0' : ''}${s}s`;
}
function table(headers, rowsArr) {
  if (!rowsArr.length) return '_(no data)_\n';
  let out = '| ' + headers.join(' | ') + ' |\n';
  out += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
  for (const r of rowsArr) out += '| ' + r.join(' | ') + ' |\n';
  return out;
}

/* ── Main handler ──────────────────────────────────────────────────────── */

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  if (!checkAdmin(req)) return res.status(401).json({ error: 'unauthorized' });

  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId || !process.env.GA4_OAUTH_REFRESH_TOKEN) {
    return res.status(500).json({ error: 'Missing GA4 env vars' });
  }

  const days = Number(req.query?.days || 2);
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
    const token = await getToken();

    const [
      realtimeRes, kpiRes, dailyRes, pagesRes, sourcesRes, countriesRes,
      citiesRes, devicesRes, browsersRes, osRes, eventsRes, hourlyRes, landingRes,
    ] = await Promise.all([
      ga4(propertyId, token, 'realtime', { metrics: [{ name: 'activeUsers' }] }),

      ga4(propertyId, token, 'report', {
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'totalUsers' }, { name: 'newUsers' }, { name: 'sessions' },
          { name: 'screenPageViews' }, { name: 'eventCount' },
          { name: 'averageSessionDuration' }, { name: 'bounceRate' },
          { name: 'engagedSessions' }, { name: 'engagementRate' },
        ],
      }),

      ga4(propertyId, token, 'report', {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'totalUsers' }, { name: 'newUsers' }, { name: 'sessions' },
          { name: 'screenPageViews' }, { name: 'averageSessionDuration' }, { name: 'bounceRate' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      }),

      ga4(propertyId, token, 'report', {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' }, { name: 'totalUsers' },
          { name: 'averageSessionDuration' }, { name: 'bounceRate' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 30,
      }),

      ga4(propertyId, token, 'report', {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'engagementRate' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 50,
      }),

      ga4(propertyId, token, 'report', {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'totalUsers' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 20,
      }),

      ga4(propertyId, token, 'report', {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'country' }, { name: 'city' }],
        metrics: [{ name: 'totalUsers' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 25,
      }),

      ga4(propertyId, token, 'report', {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'totalUsers' }, { name: 'sessions' }],
      }),

      ga4(propertyId, token, 'report', {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'browser' }],
        metrics: [{ name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 10,
      }),

      ga4(propertyId, token, 'report', {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'operatingSystem' }],
        metrics: [{ name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 10,
      }),

      ga4(propertyId, token, 'report', {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
        dimensionFilter: {
          orGroup: {
            expressions: ['calc_', 'audit_', 'cta_', 'scroll_depth_', 'page_exit'].map((p) => ({
              filter: { fieldName: 'eventName', stringFilter: { value: p, matchType: 'BEGINS_WITH' } },
            })),
          },
        },
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 100,
      }),

      ga4(propertyId, token, 'report', {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'dateHour' }],
        metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'dateHour' }, desc: false }],
      }),

      ga4(propertyId, token, 'report', {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'landingPagePlusQueryString' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'engagementRate' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20,
      }),
    ]);

    // Postgres audit submissions
    let auditRows = [];
    let auditFiltered = [];
    try {
      const r = await sql`
        SELECT id, slug, email, name, status, tier, created_at, delivered_at, converted_at
        FROM audits
        WHERE created_at >= NOW() - (${days} || ' days')::interval
        ORDER BY created_at DESC
      `;
      auditRows = r.rows;
      auditFiltered = auditRows.filter((a) => !isInternalEmail(a.email));
    } catch (err) {
      console.warn('[analytics-report] Postgres query failed:', err.message);
    }

    // Process
    const sources = rows(sourcesRes, ['source', 'medium'], ['sessions', 'users', 'engagementRate']);
    const sourcesExternal = sources.filter((s) => !isInternalSource(s.source));
    const sourcesInternal = sources.filter((s) => isInternalSource(s.source));
    const externalSessions = sourcesExternal.reduce((sum, s) => sum + s.sessions, 0);
    const externalUsers = sourcesExternal.reduce((sum, s) => sum + s.users, 0);
    const internalSessions = sourcesInternal.reduce((sum, s) => sum + s.sessions, 0);
    const internalUsers = sourcesInternal.reduce((sum, s) => sum + s.users, 0);

    const allPages = rows(pagesRes, ['path'], ['views', 'users', 'avgDuration', 'bounceRate']);
    const allEvents = rows(eventsRes, ['event'], ['count', 'users']);
    const eventMap = Object.fromEntries(allEvents.map((e) => [e.event, e]));
    const sumByPrefix = (p) => allEvents.filter((e) => e.event.startsWith(p)).reduce((s, e) => s + e.count, 0);

    const daily = rows(dailyRes, ['date'], ['users', 'newUsers', 'sessions', 'pageViews', 'avgDuration', 'bounceRate']);
    const countries = rows(countriesRes, ['country'], ['users', 'sessions']);
    const cities = rows(citiesRes, ['country', 'city'], ['users', 'sessions']);
    const devices = rows(devicesRes, ['device'], ['users', 'sessions']);
    const browsers = rows(browsersRes, ['browser'], ['users']);
    const os = rows(osRes, ['os'], ['users']);
    const landings = rows(landingRes, ['landing'], ['sessions', 'users', 'engagementRate']);
    const hourly = rows(hourlyRes, ['dateHour'], ['users', 'sessions', 'pageViews']);
    const peakHour = [...hourly].sort((a, b) => b.users - a.users)[0];

    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10);
    const timeStamp = now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

    const homeUsers = allPages.find(p => p.path === '/')?.users || 0;
    const calcUsers = allPages.find(p => p.path === '/calculator')?.users || 0;
    const auditUsers = allPages.find(p => p.path === '/audit')?.users || 0;
    const bundleUsers = allPages.find(p => p.path === '/bundle')?.users || 0;
    const sprintUsers = allPages.find(p => p.path === '/sprint')?.users || 0;
    const premiumUsers = allPages.find(p => p.path === '/premium')?.users || 0;
    const purchaseUsers = allPages.find(p => p.path === '/thank-you')?.users || 0;

    let md = `# RIK Athletica — Site Activity Report

**Period:** Past ${days} days · **Generated:** ${timeStamp}
**Data source:** Google Analytics 4 (property ${propertyId}) + Postgres (audit submissions)

> Internal traffic excluded: \`vercel.com\` referrals, \`*.vercel.app\` previews, localhost sessions, and conversions tied to ${[...INTERNAL_EMAILS_EXACT].join(', ')} or system-generated email patterns (\`+test\`, \`+dev\`, \`+qa\`, \`+staging\`, \`@example.com\`, \`@test.com\`, \`test@*\`, \`dev@*\`, \`qa@*\`, hex-prefixed addresses).

---

## 1 · Top-line summary

| Metric | All traffic | External only | Internal removed |
| --- | --- | --- | --- |
| Total users | ${num(total(kpiRes, 0))} | ${num(externalUsers)} | ${num(internalUsers)} |
| New users | ${num(total(kpiRes, 1))} | — | — |
| Sessions | ${num(total(kpiRes, 2))} | ${num(externalSessions)} | ${num(internalSessions)} |
| Page views | ${num(total(kpiRes, 3))} | — | — |
| Total events | ${num(total(kpiRes, 4))} | — | — |
| Avg session duration | ${fmtDuration(Math.round(total(kpiRes, 5)))} | — | — |
| Bounce rate | ${Math.round(total(kpiRes, 6) * 100)}% | — | — |
| Engaged sessions | ${num(total(kpiRes, 7))} | — | — |
| Engagement rate | ${Math.round(total(kpiRes, 8) * 100)}% | — | — |
| Realtime users (right now) | ${num(total(realtimeRes))} | — | — |

**Headline:** ${externalUsers} external users · ${externalSessions} external sessions over the past ${days} days, after stripping ${internalUsers} internal-source users (${internalSessions} sessions).

---

## 2 · Daily breakdown

${table(
  ['Date', 'Users', 'New', 'Sessions', 'Page Views', 'Avg Duration', 'Bounce'],
  daily.map((d) => [
    `${d.date.slice(0,4)}-${d.date.slice(4,6)}-${d.date.slice(6,8)}`,
    num(d.users), num(d.newUsers), num(d.sessions), num(d.pageViews),
    fmtDuration(Math.round(d.avgDuration)),
    `${Math.round(d.bounceRate * 100)}%`,
  ])
)}

**Peak hour:** ${peakHour ? `${peakHour.dateHour} UTC (${num(peakHour.users)} users, ${num(peakHour.sessions)} sessions)` : '—'}

---

## 3 · Traffic sources (external only — internal removed)

${table(
  ['Source', 'Raw source/medium', 'Sessions', 'Users', 'Engagement'],
  sourcesExternal.slice(0, 25).map((s) => [
    friendlySource(s.source, s.medium),
    `\`${s.source} / ${s.medium}\``,
    num(s.sessions), num(s.users),
    `${Math.round(s.engagementRate * 100)}%`,
  ])
)}

${sourcesInternal.length ? `### Internal sources removed
${table(
  ['Source', 'Sessions', 'Users'],
  sourcesInternal.map((s) => [friendlySource(s.source, s.medium), num(s.sessions), num(s.users)])
)}` : ''}

---

## 4 · Top landing pages

${table(
  ['Landing page', 'Sessions', 'Users', 'Engagement'],
  landings.slice(0, 15).map((l) => [
    `\`${l.landing}\``,
    num(l.sessions), num(l.users),
    `${Math.round(l.engagementRate * 100)}%`,
  ])
)}

---

## 5 · Top pages by views

${table(
  ['Page', 'Path', 'Views', 'Users', 'Avg dwell', 'Bounce'],
  allPages.slice(0, 20).map((p) => [
    friendlyPage(p.path),
    `\`${p.path}\``,
    num(p.views), num(p.users),
    fmtDuration(Math.round(p.avgDuration)),
    `${Math.round(p.bounceRate * 100)}%`,
  ])
)}

---

## 6 · Custom event counts (rik-analytics.js taxonomy)

${table(
  ['Event', 'Count', 'Unique users'],
  allEvents.slice(0, 50).map((e) => [`\`${e.event}\``, num(e.count), num(e.users)])
)}

### Aggregated by category

| Category | Total events |
| --- | --- |
| Calculator engagement (\`calc_*\`) | ${num(sumByPrefix('calc_'))} |
| Audit form engagement (\`audit_*\`) | ${num(sumByPrefix('audit_'))} |
| CTA clicks (\`cta_*\`) | ${num(sumByPrefix('cta_'))} |
| Scroll depth (\`scroll_depth_*\`) | ${num(sumByPrefix('scroll_depth_'))} |
| Page exits (\`page_exit\`) | ${num(eventMap['page_exit']?.count || 0)} |

---

## 7 · Calculator funnel

| Step | Event | Count | % of prev | % of page visitors |
| --- | --- | --- | --- | --- |
| Page visit | (page view) | ${num(calcUsers)} | — | 100% |
| Engaged form | \`calc_field_focus\` | ${num(eventMap['calc_field_focus']?.count || 0)} | ${pct(eventMap['calc_field_focus']?.count || 0, calcUsers)} | ${pct(eventMap['calc_field_focus']?.count || 0, calcUsers)} |
| Submitted | \`calc_submit\` | ${num(eventMap['calc_submit']?.count || 0)} | ${pct(eventMap['calc_submit']?.count || 0, eventMap['calc_field_focus']?.count || 0)} | ${pct(eventMap['calc_submit']?.count || 0, calcUsers)} |
| Saw result | \`calc_result_view\` | ${num(eventMap['calc_result_view']?.count || 0)} | ${pct(eventMap['calc_result_view']?.count || 0, eventMap['calc_submit']?.count || 0)} | ${pct(eventMap['calc_result_view']?.count || 0, calcUsers)} |
| CTA clicked | \`calc_cta_*\` | ${num(sumByPrefix('calc_cta_'))} | ${pct(sumByPrefix('calc_cta_'), eventMap['calc_result_view']?.count || 0)} | ${pct(sumByPrefix('calc_cta_'), calcUsers)} |

---

## 8 · Audit form funnel

| Step | Event | Count | % of prev | % of page visitors |
| --- | --- | --- | --- | --- |
| Page visit | (page view) | ${num(auditUsers)} | — | 100% |
| Field focus | \`audit_field_focus\` | ${num(eventMap['audit_field_focus']?.count || 0)} | ${pct(eventMap['audit_field_focus']?.count || 0, auditUsers)} | ${pct(eventMap['audit_field_focus']?.count || 0, auditUsers)} |
| Step advance | \`audit_step_advance\` | ${num(eventMap['audit_step_advance']?.count || 0)} | ${pct(eventMap['audit_step_advance']?.count || 0, eventMap['audit_field_focus']?.count || 0)} | ${pct(eventMap['audit_step_advance']?.count || 0, auditUsers)} |
| Submit | \`audit_submit\` | ${num(eventMap['audit_submit']?.count || 0)} | ${pct(eventMap['audit_submit']?.count || 0, eventMap['audit_field_focus']?.count || 0)} | ${pct(eventMap['audit_submit']?.count || 0, auditUsers)} |
| Confirmation | \`audit_confirmation_view\` | ${num(eventMap['audit_confirmation_view']?.count || 0)} | ${pct(eventMap['audit_confirmation_view']?.count || 0, eventMap['audit_submit']?.count || 0)} | ${pct(eventMap['audit_confirmation_view']?.count || 0, auditUsers)} |
| Abandoned | \`audit_abandon_at_step\` | ${num(eventMap['audit_abandon_at_step']?.count || 0)} | — | ${pct(eventMap['audit_abandon_at_step']?.count || 0, auditUsers)} |

---

## 9 · Scroll depth distribution

${table(
  ['Depth', 'Reached'],
  ['25', '50', '75', '100'].map((d) => [`${d}%`, num(eventMap[`scroll_depth_${d}`]?.count || 0)])
)}

---

## 10 · Geography

### Countries
${table(
  ['Country', 'Users', 'Sessions'],
  countries.slice(0, 15).map((c) => [c.country || '(unknown)', num(c.users), num(c.sessions)])
)}

### Cities (top 15)
${table(
  ['City, Country', 'Users', 'Sessions'],
  cities.slice(0, 15).map((c) => [`${c.city || '(unknown)'}, ${c.country || ''}`.trim(), num(c.users), num(c.sessions)])
)}

---

## 11 · Devices, browsers, OS

### Devices
${table(['Device', 'Users', 'Sessions'], devices.map((d) => [d.device, num(d.users), num(d.sessions)]))}

### Browsers
${table(['Browser', 'Users'], browsers.map((b) => [b.browser, num(b.users)]))}

### Operating systems
${table(['OS', 'Users'], os.map((o) => [o.os, num(o.users)]))}

---

## 12 · Conversions (Postgres — audit submissions)

**Total audit submissions in past ${days} days:** ${auditRows.length} (raw) → **${auditFiltered.length} external**

${auditRows.length - auditFiltered.length > 0 ? `Internal/test submissions excluded: ${auditRows.length - auditFiltered.length}` : 'No internal/test submissions detected.'}

### External submissions

${auditFiltered.length ? table(
  ['Created (UTC)', 'Email', 'Name', 'Tier', 'Status', 'Delivered', 'Converted'],
  auditFiltered.map((a) => [
    new Date(a.created_at).toISOString().slice(0, 16).replace('T', ' '),
    a.email,
    a.name || '—',
    a.tier || '—',
    a.status || '—',
    a.delivered_at ? '✓' : '—',
    a.converted_at ? '✓' : '—',
  ])
) : '_(no external audit submissions in the past ' + days + ' days)_'}

### Conversion math

| Stage | Count |
| --- | --- |
| External audit submits | ${auditFiltered.length} |
| Delivered (admin approved) | ${auditFiltered.filter(a => a.delivered_at).length} |
| Converted to paid | ${auditFiltered.filter(a => a.converted_at).length} |
| Submit→delivery rate | ${pct(auditFiltered.filter(a => a.delivered_at).length, auditFiltered.length)} |
| Delivery→conversion rate | ${pct(auditFiltered.filter(a => a.converted_at).length, auditFiltered.filter(a => a.delivered_at).length)} |

---

## 13 · Key takeaways

- **Traffic mix:** ${externalUsers} external users vs ${internalUsers} internal — external represents ${pct(externalUsers, externalUsers + internalUsers)} of total.
${sourcesExternal[0] ? `- **Top source:** ${friendlySource(sourcesExternal[0].source, sourcesExternal[0].medium)} (${num(sourcesExternal[0].sessions)} sessions, ${num(sourcesExternal[0].users)} users).` : ''}
- **Funnel scan:** Home ${num(homeUsers)} → Calc ${num(calcUsers)} (${pct(calcUsers, homeUsers)}) → Audit ${num(auditUsers)} (${pct(auditUsers, homeUsers)}) → Bundle ${num(bundleUsers)} → Sprint ${num(sprintUsers)} → Premium ${num(premiumUsers)} → Purchase ${num(purchaseUsers)}.
- **Audit conversion:** ${auditFiltered.length} external submissions in window. ${auditFiltered.filter(a => a.converted_at).length} converted to paid.
${peakHour ? `- **Peak activity:** ${peakHour.dateHour} UTC with ${num(peakHour.users)} users.` : ''}

---

_End of report._
`;

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(md);
  } catch (err) {
    console.error('[analytics-report] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
