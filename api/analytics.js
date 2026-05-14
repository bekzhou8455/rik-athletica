// GET /api/analytics?t=<ADMIN_TOKEN>
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
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // refresh 60s before expiry
  return cachedToken;
}

/* ── GA4 Data API helpers ──────────────────────────────────────────────── */

const GA4_BASE = 'https://analyticsdata.googleapis.com/v1beta';

async function ga4Report(propertyId, token, body) {
  const res = await fetch(`${GA4_BASE}/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GA4 report error (${res.status}): ${err}`);
  }
  return res.json();
}

async function ga4Realtime(propertyId, token, body) {
  const res = await fetch(`${GA4_BASE}/properties/${propertyId}:runRealtimeReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GA4 realtime error (${res.status}): ${err}`);
  }
  return res.json();
}

/* ── Extract rows helper ───────────────────────────────────────────────── */

function extractRows(report, dimNames, metricNames) {
  if (!report.rows) return [];
  return report.rows.map((row) => {
    const obj = {};
    (row.dimensionValues || []).forEach((v, i) => {
      obj[dimNames[i]] = v.value;
    });
    (row.metricValues || []).forEach((v, i) => {
      obj[metricNames[i]] = Number(v.value);
    });
    return obj;
  });
}

function extractTotal(report, index = 0) {
  if (!report.rows || !report.rows[0]) return 0;
  return Number(report.rows[0].metricValues?.[index]?.value ?? 0);
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

  try {
    const token = await getAccessToken();

    // Run all queries in parallel
    const [
      realtimeRes,
      todayRes,
      weekRes,
      monthRes,
      topPagesRes,
      sourcesRes,
      countriesRes,
      devicesRes,
      eventsRes,
      trendRes,
      funnelRes,
    ] = await Promise.all([
      // 1. Realtime active users
      ga4Realtime(propertyId, token, {
        metrics: [{ name: 'activeUsers' }],
      }),

      // 2. Today KPIs
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: 'today', endDate: 'today' }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'screenPageViews' },
          { name: 'sessions' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
        ],
      }),

      // 3. 7-day KPIs
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'screenPageViews' },
        ],
      }),

      // 4. 30-day KPIs
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'screenPageViews' },
        ],
      }),

      // 5. Top pages (7d)
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'totalUsers' },
          { name: 'averageSessionDuration' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 15,
      }),

      // 6. Traffic sources (7d)
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [
          { name: 'sessionSource' },
          { name: 'sessionMedium' },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 15,
      }),

      // 7. Countries (7d)
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'country' }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'sessions' },
        ],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 15,
      }),

      // 8. Devices (7d)
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'sessions' },
        ],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      }),

      // 9. Custom events (7d) — calc, audit, CTA
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          orGroup: {
            expressions: [
              'calc_submit', 'calc_result_view', 'calc_field_focus',
              'audit_submit', 'audit_step_view', 'audit_abandon_at_step',
              'cta_click', 'scroll_depth_25', 'scroll_depth_50',
              'scroll_depth_75', 'scroll_depth_100', 'page_exit',
            ].map((name) => ({
              filter: {
                fieldName: 'eventName',
                stringFilter: { value: name, matchType: 'EXACT' },
              },
            })),
          },
        },
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      }),

      // 10. Daily trend (30d)
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'screenPageViews' },
          { name: 'sessions' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      }),

      // 11. Funnel: page_view per key page (7d)
      ga4Report(propertyId, token, {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'totalUsers' }],
        dimensionFilter: {
          orGroup: {
            expressions: [
              '/', '/calculator', '/audit', '/bundle', '/sprint', '/premium', '/thank-you',
            ].map((path) => ({
              filter: {
                fieldName: 'pagePath',
                stringFilter: { value: path, matchType: 'EXACT' },
              },
            })),
          },
        },
      }),
    ]);

    // Shape response
    const result = {
      ts: new Date().toISOString(),

      realtime: {
        activeUsers: extractTotal(realtimeRes),
      },

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
      },

      month: {
        visitors: extractTotal(monthRes, 0),
        pageViews: extractTotal(monthRes, 1),
      },

      topPages: extractRows(topPagesRes, ['path'], ['views', 'users', 'avgDuration']),

      sources: extractRows(sourcesRes, ['source', 'medium'], ['sessions', 'users']),

      countries: extractRows(countriesRes, ['country'], ['users', 'sessions']),

      devices: extractRows(devicesRes, ['device'], ['users', 'sessions']),

      events: extractRows(eventsRes, ['event'], ['count']),

      trend: extractRows(trendRes, ['date'], ['users', 'pageViews', 'sessions']),

      funnel: extractRows(funnelRes, ['path'], ['users']),
    };

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(result);
  } catch (err) {
    console.error('[analytics] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
