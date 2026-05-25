/**
 * GET /api/refer?email=<subscriber-email>
 *
 * Looks up the Rewardful affiliate referral link for a given email and 302s
 * to it. Used by Kit email templates to embed a per-subscriber referral URL
 * via {{ subscriber.email_address }} → /refer?email=...
 *
 * See RIK_Email_Sequences_v2.md → "Referral link in emails" (Option A).
 *
 * Required env vars:
 *   REWARDFUL_API_SECRET   — from rewardful.com → Settings → API. Used to look
 *                            up affiliates by email.
 * Optional env vars:
 *   REWARDFUL_CAMPAIGN_ID  — restricts the lookup + affiliate creation to a
 *                            specific campaign. If unset, uses the account's
 *                            default campaign.
 *
 * Failure modes (all soft — always 302 somewhere useful):
 *   - No email param      → /bundle (let visitor still buy something)
 *   - API key missing     → /bundle (no via= — won't credit anyone)
 *   - Lookup fails / 5xx  → /bundle
 *   - Email not affiliate → tries to create them as an affiliate, then redirect
 *                           with via=<new token>. If creation also fails, /bundle.
 */

const BUNDLE_FALLBACK = 'https://www.rikathletica.com/bundle';

function sanitizeEmail(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  // Loose RFC-5322 enough for redirect purposes — we're not authenticating.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

async function findAffiliateByEmail(email, apiKey) {
  const url = `https://api.getrewardful.com/v1/affiliates?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const found = (data?.data ?? [])[0];
  return found ?? null;
}

async function createAffiliate(email, apiKey, campaignId) {
  const body = new URLSearchParams({
    first_name: '',
    last_name: '',
    email,
    ...(campaignId ? { campaign_id: campaignId } : {}),
  });
  const res = await fetch('https://api.getrewardful.com/v1/affiliates', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) return null;
  return res.json();
}

function affiliateLinkFor(affiliate) {
  // Rewardful surfaces a `links` array on the affiliate object; use the first one's URL.
  // Fall back to building from token if links is missing.
  const link = (affiliate?.links ?? [])[0]?.url;
  if (link) return link;
  const token = affiliate?.token;
  if (token) return `https://www.rikathletica.com/?via=${encodeURIComponent(token)}`;
  return null;
}

export default async function handler(req, res) {
  const email = sanitizeEmail(req.query?.email);
  if (!email) {
    return res.redirect(302, BUNDLE_FALLBACK);
  }

  const apiKey = process.env.REWARDFUL_API_SECRET;
  if (!apiKey) {
    console.warn('[refer] REWARDFUL_API_SECRET not set — redirecting without referral credit');
    return res.redirect(302, BUNDLE_FALLBACK);
  }

  try {
    let affiliate = await findAffiliateByEmail(email, apiKey);
    if (!affiliate) {
      affiliate = await createAffiliate(email, apiKey, process.env.REWARDFUL_CAMPAIGN_ID);
    }
    const link = affiliate ? affiliateLinkFor(affiliate) : null;
    return res.redirect(302, link ?? BUNDLE_FALLBACK);
  } catch (err) {
    console.error('[refer] lookup failed:', err.message);
    return res.redirect(302, BUNDLE_FALLBACK);
  }
}
