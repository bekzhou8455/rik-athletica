/**
 * GET /api/dashboard/data
 * Unified data endpoint for the RIK tracking dashboard.
 * Pulls from Stripe API + GA4 Data API, returns JSON.
 *
 * Auth: cookie-based password (RIK8455)
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   GA4_OAUTH_CLIENT_ID
 *   GA4_OAUTH_CLIENT_SECRET
 *   GA4_OAUTH_REFRESH_TOKEN
 *   GA4_PROPERTY_ID
 */

import Stripe from 'stripe';

export const config = { api: { bodyParser: true } };

const DASHBOARD_PASSWORD = 'RIK8455';
const COOKIE_NAME = 'rik_dash_auth';

function isAuthed(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match && match[1] === DASHBOARD_PASSWORD;
}

// ─── GA4 OAuth token refresh ───
async function getGa4AccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GA4_OAUTH_CLIENT_ID,
      client_secret: process.env.GA4_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GA4_OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 token refresh failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

// ─── GA4 Data API query ───
async function queryGa4(accessToken, propertyId, { startDate, endDate }) {
  const body = {
    requests: [
      {
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'eventCount' },
        ],
        dimensions: [
          { name: 'eventName' },
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: {
              values: [
                'sprint_page_view',
                'sprint_cta_click',
                'eligibility_started',
                'eligibility_submitted',
                'sprint_checkout_redirect',
                'sprint_screen_pass',
                'page_view',
              ],
            },
          },
        },
      },
      {
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
        ],
        dimensions: [
          { name: 'sessionSource' },
          { name: 'sessionMedium' },
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: {
              matchType: 'BEGINS_WITH',
              value: '/sprint',
            },
          },
        },
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20,
      },
      {
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
        ],
        dimensions: [
          { name: 'date' },
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: {
              matchType: 'BEGINS_WITH',
              value: '/sprint',
            },
          },
        },
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      },
      {
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
        ],
        dimensions: [
          { name: 'sessionCampaignName' },
          { name: 'sessionManualAdContent' },
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: {
              matchType: 'BEGINS_WITH',
              value: '/sprint',
            },
          },
        },
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 30,
      },
    ],
  };

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 query failed: ${res.status} ${text}`);
  }

  return res.json();
}

function parseGa4Response(batchResponse) {
  const reports = batchResponse.reports || [];

  // Report 0: funnel events (users + event counts)
  const funnel = {};
  const funnelEvents = {};
  if (reports[0]?.rows) {
    for (const row of reports[0].rows) {
      const eventName = row.dimensionValues[0].value;
      funnel[eventName] = parseInt(row.metricValues[1]?.value || '0', 10);
      funnelEvents[eventName] = parseInt(row.metricValues[2]?.value || '0', 10);
    }
  }

  // Report 1: traffic sources
  const sources = [];
  if (reports[1]?.rows) {
    for (const row of reports[1].rows) {
      sources.push({
        source: row.dimensionValues[0].value,
        medium: row.dimensionValues[1].value,
        sessions: parseInt(row.metricValues[0].value, 10),
        users: parseInt(row.metricValues[1].value, 10),
      });
    }
  }

  // Report 2: daily traffic
  const daily = [];
  if (reports[2]?.rows) {
    for (const row of reports[2].rows) {
      daily.push({
        date: row.dimensionValues[0].value,
        sessions: parseInt(row.metricValues[0].value, 10),
        users: parseInt(row.metricValues[1].value, 10),
      });
    }
  }

  // Report 3: campaign/content breakdown (ad creative attribution)
  const creatives = [];
  if (reports[3]?.rows) {
    for (const row of reports[3].rows) {
      const campaign = row.dimensionValues[0].value;
      const content = row.dimensionValues[1].value;
      if (campaign === '(not set)' && content === '(not set)') continue;
      creatives.push({
        campaign,
        content,
        sessions: parseInt(row.metricValues[0].value, 10),
        users: parseInt(row.metricValues[1].value, 10),
      });
    }
  }

  return { funnel, funnelEvents, sources, daily, creatives };
}

// ─── Stripe data ───
async function getStripeData(stripe, { startDate, endDate }) {
  const startTs = Math.floor(new Date(startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000);

  const sessions = [];
  let hasMore = true;
  let startingAfter;

  while (hasMore) {
    const params = {
      limit: 100,
      created: { gte: startTs, lte: endTs },
      expand: ['data.line_items'],
    };
    if (startingAfter) params.starting_after = startingAfter;

    const page = await stripe.checkout.sessions.list(params);
    sessions.push(...page.data);
    hasMore = page.has_more;
    if (page.data.length > 0) {
      startingAfter = page.data[page.data.length - 1].id;
    }
  }

  const completed = sessions.filter(s => s.payment_status === 'paid');
  const expired = sessions.filter(s => s.status === 'expired');

  const revenue = completed.reduce((sum, s) => sum + (s.amount_total || 0), 0);

  const byTier = {};
  for (const s of completed) {
    const tier = s.metadata?.tier || classifyTier(s.amount_total);
    byTier[tier] = byTier[tier] || { count: 0, revenue: 0 };
    byTier[tier].count++;
    byTier[tier].revenue += s.amount_total || 0;
  }

  const bySource = {};
  for (const s of completed) {
    const src = s.metadata?.utm_source || 'direct';
    bySource[src] = bySource[src] || { count: 0, revenue: 0 };
    bySource[src].count++;
    bySource[src].revenue += s.amount_total || 0;
  }

  const byCreative = {};
  for (const s of [...completed, ...expired]) {
    const content = s.metadata?.utm_content;
    if (!content) continue;
    const campaign = s.metadata?.utm_campaign || '(none)';
    const key = campaign + '||' + content;
    byCreative[key] = byCreative[key] || { campaign, content, purchases: 0, revenue: 0, checkouts: 0, abandoned: 0 };
    byCreative[key].checkouts++;
    if (s.payment_status === 'paid') {
      byCreative[key].purchases++;
      byCreative[key].revenue += s.amount_total || 0;
    } else {
      byCreative[key].abandoned++;
    }
  }

  const byDay = {};
  for (const s of completed) {
    const day = new Date(s.created * 1000).toISOString().slice(0, 10);
    byDay[day] = byDay[day] || { count: 0, revenue: 0 };
    byDay[day].count++;
    byDay[day].revenue += s.amount_total || 0;
  }

  return {
    total_sessions: sessions.length,
    completed: completed.length,
    expired: expired.length,
    revenue_cents: revenue,
    by_tier: byTier,
    by_source: bySource,
    by_creative: Object.values(byCreative),
    by_day: byDay,
    recent: completed.slice(0, 10).map(s => ({
      id: s.id,
      email: s.customer_details?.email || '',
      name: s.customer_details?.name || '',
      tier: s.metadata?.tier || classifyTier(s.amount_total),
      amount: s.amount_total,
      utm_source: s.metadata?.utm_source || '',
      utm_medium: s.metadata?.utm_medium || '',
      utm_campaign: s.metadata?.utm_campaign || '',
      utm_content: s.metadata?.utm_content || '',
      created: new Date(s.created * 1000).toISOString(),
    })),
  };
}

function classifyTier(amountCents) {
  const d = Math.round((amountCents || 0) / 100);
  if (d < 200) return 'Bundle';
  if (d <= 610) return '70.3 Sprint';
  if (d < 700) return 'Ironman Sprint';
  if (d < 1000) return 'Pro Sprint';
  return 'Premium';
}

// ─── Auth endpoint (POST /api/dashboard/data with { action: 'login' }) ───
function handleLogin(req, res, body) {
  if (body.password === DASHBOARD_PASSWORD) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${DASHBOARD_PASSWORD}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
    return res.status(200).json({ ok: true });
  }
  return res.status(401).json({ error: 'Wrong password' });
}

export default async function handler(req, res) {
  // Handle login
  if (req.method === 'POST') {
    return handleLogin(req, res, req.body || {});
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthed(req)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const startDate = req.query.start || new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const endDate = req.query.end || new Date().toISOString().slice(0, 10);

  const result = { stripe: null, ga4: null, errors: [] };

  // Stripe
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      result.stripe = await getStripeData(stripe, { startDate, endDate });
    } catch (err) {
      console.error('[dashboard] Stripe error:', err.message);
      result.errors.push(`Stripe: ${err.message}`);
    }
  } else {
    result.errors.push('STRIPE_SECRET_KEY not configured');
  }

  // GA4
  const ga4Ready = process.env.GA4_OAUTH_CLIENT_ID && process.env.GA4_OAUTH_CLIENT_SECRET && process.env.GA4_OAUTH_REFRESH_TOKEN && process.env.GA4_PROPERTY_ID;
  if (ga4Ready) {
    try {
      const accessToken = await getGa4AccessToken();
      const batchResponse = await queryGa4(accessToken, process.env.GA4_PROPERTY_ID, { startDate, endDate });
      result.ga4 = parseGa4Response(batchResponse);
    } catch (err) {
      console.error('[dashboard] GA4 error:', err.message);
      result.errors.push(`GA4: ${err.message}`);
    }
  } else {
    result.errors.push('GA4 OAuth credentials not fully configured');
  }

  return res.status(200).json(result);
}
