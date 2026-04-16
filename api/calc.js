/**
 * POST /api/calc
 * Server-side scoring for the IRONMAN Nutrition Calculator.
 *
 * Source of truth for the protocol methodology. Do NOT inline these
 * coefficients, maps, or formulas anywhere in client-side code. The
 * generic fallback in calculator.html uses intentionally coarser numbers.
 *
 * Protections:
 *  - Origin/Referer check (must be rikathletica.com)
 *  - Per-IP rate limit (20 req / 60s sliding window)
 *  - Strict input whitelist validation
 *  - No-store cache headers
 */

const ALLOWED_ORIGINS = [
  'https://www.rikathletica.com',
  'https://rikathletica.com',
];

const GI_MAP = {
  none:     { lo: 0,  hi: 0,  lbl: 'No GI impact detected' },
  mild:     { lo: 5,  hi: 10, lbl: 'Pace suppression' },
  moderate: { lo: 15, hi: 25, lbl: 'Stops + pace drop' },
  severe:   { lo: 30, hi: 50, lbl: 'Walking + multiple stops' },
};
const CARB_MAP = {
  under40:  { lo: 20, hi: 35, lbl: 'Significant bonk risk' },
  '40to60': { lo: 10, hi: 18, lbl: 'Late-race energy deficit' },
  '60to80': { lo: 4,  hi: 10, lbl: 'Moderate shortfall' },
  '80plus': { lo: 0,  hi: 4,  lbl: 'Near-optimal' },
};
const BONK_MAP = {
  yes: { lo: 8, hi: 18, lbl: 'Transition collapse' },
  no:  { lo: 0, hi: 5,  lbl: 'Manageable' },
};

const DISTANCES = new Set(['full', '70.3']);
const GI_KEYS = new Set(Object.keys(GI_MAP));
const CARB_KEYS = new Set(Object.keys(CARB_MAP));
const BONK_KEYS = new Set(Object.keys(BONK_MAP));

// In-memory sliding-window rate limiter. Module-scoped, reset on cold start.
// Good enough for the traffic profile; swap for Upstash later if needed.
const WINDOW_MS = 60_000;
const LIMIT = 20;
const hits = new Map(); // ip -> [timestamps]

function rateLimit(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= LIMIT) {
    hits.set(ip, arr);
    return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  hits.set(ip, arr);
  // GC occasionally
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] > WINDOW_MS) hits.delete(k);
    }
  }
  return { ok: true };
}

function getIP(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function originOk(req) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  if (origin && ALLOWED_ORIGINS.includes(origin)) return true;
  if (referer) {
    try {
      const u = new URL(referer);
      const o = `${u.protocol}//${u.host}`;
      if (ALLOWED_ORIGINS.includes(o)) return true;
    } catch { /* fallthrough */ }
  }
  return false;
}

function setCorsHeaders(res, origin) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : 'https://www.rikathletica.com';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function validate(body) {
  if (!body || typeof body !== 'object') return 'invalid body';
  if (!DISTANCES.has(body.distance)) return 'invalid distance';
  if (body.gi != null && !GI_KEYS.has(body.gi)) return 'invalid gi';
  if (!CARB_KEYS.has(body.carbs)) return 'invalid carbs';
  if (!BONK_KEYS.has(body.secondHalf)) return 'invalid secondHalf';
  if (body.trainingPaceKmMin != null) {
    const p = Number(body.trainingPaceKmMin);
    if (!Number.isFinite(p) || p < 2 || p > 12) return 'invalid trainingPaceKmMin';
  }
  if (body.raceSplitMin != null) {
    const r = Number(body.raceSplitMin);
    if (!Number.isFinite(r) || r < 30 || r > 720) return 'invalid raceSplitMin';
  }
  return null;
}

function score(data) {
  const isIM = data.distance === 'full';
  const sc = isIM ? 1.0 : 0.52;

  const gi   = GI_MAP[data.gi]   || GI_MAP.none;
  const carb = CARB_MAP[data.carbs] || CARB_MAP['60to80'];
  const bonk = BONK_MAP[data.secondHalf] || BONK_MAP.no;

  const giLo = Math.round(gi.lo * sc),   giHi = Math.round(gi.hi * sc);
  const cLo  = Math.round(carb.lo * sc), cHi  = Math.round(carb.hi * sc);
  const bLo  = Math.round(bonk.lo * sc), bHi  = Math.round(bonk.hi * sc);

  let pgLo = 0, pgHi = 0, pgConfirm = false;
  const tp = data.trainingPaceKmMin != null ? Number(data.trainingPaceKmMin) : null;
  const rs = data.raceSplitMin != null ? Number(data.raceSplitMin) : null;
  if (tp && rs) {
    const dist = isIM ? 42.2 : 21.1;
    const expected = tp * 1.175 * dist;
    const gap = rs - expected;
    if (gap > 5) {
      pgLo = Math.round(gap * 0.55);
      pgHi = Math.round(gap * 0.75);
      pgConfirm = true;
    }
  }

  const totalLo = Math.round(Math.max(giLo + bLo, cLo + bLo * 0.5));
  const totalHi = Math.round(Math.max(giHi + bHi, cHi + bHi * 0.5));

  return {
    totalLo, totalHi,
    giLo, giHi, giLbl: gi.lbl,
    cLo, cHi, cLbl: carb.lbl,
    bLo, bHi, bLbl: bonk.lbl,
    pgLo, pgHi, pgConfirm, isIM,
  };
}

export default async function handler(req, res) {
  setCorsHeaders(res, req.headers.origin);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!originOk(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const ip = getIP(req);
  const rl = rateLimit(ip);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Too many requests' });
  }

  // Vercel already parses JSON when content-type is application/json, but be defensive.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'invalid json' }); }
  }

  const err = validate(body);
  if (err) return res.status(400).json({ error: err });

  try {
    const result = score(body);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: 'scoring failed' });
  }
}
