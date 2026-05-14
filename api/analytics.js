// GET /api/analytics?t=<ADMIN_TOKEN>&range=7d|30d
// Returns GA4 analytics data for the admin dashboard.
//
// Auth: OAuth2 refresh token flow (no service account key needed).
// Requires env vars:
//   GA4_PROPERTY_ID, GA4_OAUTH_CLIENT_ID, GA4_OAUTH_CLIENT_SECRET,
//   GA4_OAUTH_REFRESH_TOKEN, ADMIN_TOKEN

/* ── Auth ──────────────────────────────────────────────────────────────── */

function checkAdmin(req) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const provided = req.headers['x-admin-token'] ?? req.query?.t;
  return provided === token;
}

/* ── OAuth2 Refresh Token → Access Token ──────────────────────────────── */

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

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
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

/* ── GA4 Data API helpers ──────────────────────────────────────────────── */

const GA4_BASE = 'https://analyticsdata.googleapis.com/v1beta';

async function ga4Report(propertyId, token, body) {
  const res = await fetch(`${GA4_BASE}/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GA4 report error (${res.status}): ${await res.text()}`);
  return res.json();
}

async function ga4Realtime(propertyId, token, body) {
  const res = await fetch(`${GA4_BASE}/properties/${propertyId}:runRealtimeReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GA4 realtime error (${res.status}): ${await res.text()}`);
  return res.json();
}

function extractRows(report, dimNames, metricNames) {
  if (!report.rows) return [];
  return report.rows.map((row) => {
    const obj = {};
    (row.dimensionValues || []).forEach((v, i) => { obj[dimNames[i]] = v.value; });
    (row.metricValues || []).forEach((v, i) => { obj[metricNames[i]] = Number(v.value); });
    return obj;
  });
}

function extractTotal(report, index = 0) {
  if (!report.rows || !report.rows[0]) return 0;
  return Number(report.rows[0].metricValues?.[index]?.value ?? 0);
}

/* ── Event-name filter builder (prefix match) ──────────────────────────── */

function eventPrefixFilter(prefixes) {
  return {
    orGroup: {
      expressions: prefixes.map((p) => ({
        filter: {
          fieldName: 'eventName',
          stringFilter: { value: p, matchType: 'BEGINS_WITH' },
        },
      })),
    },
  };
}

/* ── Main handler ──────────────────────────────────────────────────────── */

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  if (!checkAdmin(req)) return res.status(401).json({ error: 'unauthorized' });

  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId || !process.env.GA4_OAUTH_REFRESH_TOKEN) {
    return res.status(500).json({
      error: 'Missing env vars. Need: GA4_PROPERTY_ID, GA4_OAUTH_CLIENT_ID, GA4_OAUTH_CLIENT_SECRET, GA4_OAUTH_REFRESH_TOKEN',
    });
  }

  // Range param
  const range = (req.query?.range === '30d') ? '30d' : '7d';
  const rangeStart = range === '30d' ? '30daysAgo' : '7daysAgo';

  try {
    const token = await getAccessToken();

    const [
      realtimeRes,
      todayRes,
      weekRes,
      monthRes,
      rangeRes,
      topPagesRes,
      sourcesRes,
      countriesRes,
      devicesRes,
      eventsRes,
      trendRes,
      funnelRes,
      browserRes,
    ] = await Promise.all([
      // Realtime active users
      ga4Realtime(propertyId, token, { metrics: [{ name: 'activeUsers' }] }),

      // Today KPIs
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: 'today', endDate: 'today' }],
        metrics: [
          { name: 'totalUsers' }, { name: 'screenPageViews' }, { name: 'sessions' },
          { name: 'averageSessionDuration' }, { name: 'bounceRate' },
        ],
      }),

      // 7d KPIs
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        metrics: [{ name: 'totalUsers' }, { name: 'screenPageViews' }, { name: 'sessions' }],
      }),

      // 30d KPIs
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        metrics: [{ name: 'totalUsers' }, { name: 'screenPageViews' }, { name: 'sessions' }],
      }),

      // Range KPIs (used for cards that respond to toggle)
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: rangeStart, endDate: 'today' }],
        metrics: [
          { name: 'totalUsers' }, { name: 'screenPageViews' }, { name: 'sessions' },
          { name: 'averageSessionDuration' }, { name: 'bounceRate' },
        ],
      }),

      // Top pages (range)
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: rangeStart, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'averageSessionDuration' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 20,
      }),

      // Traffic sources (range)
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: rangeStart, endDate: 'today' }],
        dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 25,
      }),

      // Countries (range)
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: rangeStart, endDate: 'today' }],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'totalUsers' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 15,
      }),

      // Devices (range)
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: rangeStart, endDate: 'today' }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'totalUsers' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      }),

      // Custom events (range) — all events tracked by rik-analytics.js
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: rangeStart, endDate: 'today' }],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: eventPrefixFilter([
          'calc_', 'audit_', 'cta_', 'scroll_depth_', 'page_exit',
        ]),
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 100,
      }),

      // Daily trend (30d, regardless of range — chart is always 30d)
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'totalUsers' }, { name: 'screenPageViews' }, { name: 'sessions' }],
        orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      }),

      // Funnel (range): page users per key page
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: rangeStart, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'totalUsers' }],
        dimensionFilter: {
          orGroup: {
            expressions: ['/', '/calculator', '/audit', '/bundle', '/sprint', '/premium', '/thank-you'].map((path) => ({
              filter: { fieldName: 'pagePath', stringFilter: { value: path, matchType: 'EXACT' } },
            })),
          },
        },
      }),

      // Browsers (range)
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: rangeStart, endDate: 'today' }],
        dimensions: [{ name: 'browser' }],
        metrics: [{ name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 8,
      }),
    ]);

    // Build event lookup
    const events = extractRows(eventsRes, ['event'], ['count']);
    const eventMap = {};
    events.forEach((e) => { eventMap[e.event] = e.count; });

    // Pre-compute aggregates for behavior metrics
    const sumByPrefix = (prefix) =>
      events.filter((e) => e.event.startsWith(prefix)).reduce((s, e) => s + e.count, 0);

    const result = {
      ts: new Date().toISOString(),
      range,

      realtime: { activeUsers: extractTotal(realtimeRes) },

      today: {
        visitors: extractTotal(todayRes, 0),
        pageViews: extractTotal(todayRes, 1),
        sessions: extractTotal(todayRes, 2),
        avgDuration: Math.round(extractTotal(todayRes, 3)),
        bounceRate: Math.round(extractTotal(todayRes, 4) * 100),
      },

      week: {
        visitors: extractTotal(weekRes, 0),
        pageViews: extractTotal(weekRes, 1),
        sessions: extractTotal(weekRes, 2),
      },

      month: {
        visitors: extractTotal(monthRes, 0),
        pageViews: extractTotal(monthRes, 1),
        sessions: extractTotal(monthRes, 2),
      },

      // Range-scoped (responds to 7d/30d toggle)
      rangeStats: {
        visitors: extractTotal(rangeRes, 0),
        pageViews: extractTotal(rangeRes, 1),
        sessions: extractTotal(rangeRes, 2),
        avgDuration: Math.round(extractTotal(rangeRes, 3)),
        bounceRate: Math.round(extractTotal(rangeRes, 4) * 100),
      },

      topPages: extractRows(topPagesRes, ['path'], ['views', 'users', 'avgDuration']),
      sources: extractRows(sourcesRes, ['source', 'medium'], ['sessions', 'users']),
      countries: extractRows(countriesRes, ['country'], ['users', 'sessions']),
      devices: extractRows(devicesRes, ['device'], ['users', 'sessions']),
      browsers: extractRows(browserRes, ['browser'], ['users']),
      events,
      trend: extractRows(trendRes, ['date'], ['users', 'pageViews', 'sessions']),
      funnel: extractRows(funnelRes, ['path'], ['users']),

      // Pre-built behavior aggregates
      behavior: {
        // Calculator funnel
        calc: {
          fieldFocus: eventMap['calc_field_focus'] || 0,
          submit: eventMap['calc_submit'] || 0,
          resultView: eventMap['calc_result_view'] || 0,
          ctaClicks: sumByPrefix('calc_cta_'),
        },

        // Audit funnel
        audit: {
          fieldFocus: eventMap['audit_field_focus'] || 0,
          stepView: eventMap['audit_step_view'] || 0,
          stepAdvance: eventMap['audit_step_advance'] || 0,
          stepBack: eventMap['audit_step_back'] || 0,
          abandon: eventMap['audit_abandon_at_step'] || 0,
          submit: eventMap['audit_submit'] || 0,
          confirmation: eventMap['audit_confirmation_view'] || 0,
        },

        // CTA + scroll
        ctaClicks: eventMap['cta_click'] || 0,
        scroll: {
          d25: eventMap['scroll_depth_25'] || 0,
          d50: eventMap['scroll_depth_50'] || 0,
          d75: eventMap['scroll_depth_75'] || 0,
          d100: eventMap['scroll_depth_100'] || 0,
        },
        pageExits: eventMap['page_exit'] || 0,
      },
    };

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(result);
  } catch (err) {
    console.error('[analytics] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
