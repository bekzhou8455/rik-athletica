/**
 * POST /api/create-sign-request
 * Creates a Dropbox Sign signature request from a template and returns the signing URL.
 * Called by sprint.html when the Typeform screening PASS redirect lands with URL params.
 *
 * Required env vars (set in Vercel dashboard + .env.local):
 *   DROPBOX_SIGN_API_KEY          — from app.hellosign.com → API → API Keys
 *   DROPBOX_SIGN_TEMPLATE_FULL    — template ID for Full Ironman service contract
 *   DROPBOX_SIGN_TEMPLATE_703     — template ID for 70.3 service contract
 *   STRIPE_LINK_FULL              — Stripe Payment Link URL for $649 Full Ironman
 *   STRIPE_LINK_703               — Stripe Payment Link URL for $549 70.3
 *
 * Flow:
 *   sprint.html detects ?screen=pass params → auto-calls this endpoint
 *   → Dropbox Sign creates sign request → returns {signingUrl}
 *   → athlete signs → Dropbox Sign redirects to Stripe (per signing_redirect_url)
 *   → athlete pays → Typeform Full Intake → /api/intake
 */

export const config = { maxDuration: 30 };

// Validate race_date string (YYYY-MM-DD) is within 28–56 days of today.
// Compares date strings to avoid timezone issues (both in local YYYY-MM-DD format).
function validateRaceDays(raceDateStr) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const raceDate = new Date(raceDateStr + 'T00:00:00Z');
  const todayDate = new Date(todayStr + 'T00:00:00Z');
  const diffMs = raceDate - todayDate;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, distance, race_date, referral } = req.body || {};

  // --- Input validation ---
  const cleanName = (name || '').trim().slice(0, 100);
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanDist = (distance || '').trim().toLowerCase();
  const cleanDate = (race_date || '').trim();

  if (!cleanName) {
    return res.status(400).json({ error: 'Name is required.' });
  }
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Valid email is required.' });
  }
  if (!['full', '703'].includes(cleanDist)) {
    return res.status(400).json({ error: 'Distance must be "full" or "703".' });
  }
  if (!cleanDate || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    return res.status(400).json({ error: 'Race date must be in YYYY-MM-DD format.' });
  }

  const diffDays = validateRaceDays(cleanDate);
  if (diffDays < 28) {
    return res.status(400).json({ error: 'We need at least 4 weeks to build your program. Email hello@rikathletica.com if you have questions.' });
  }
  if (diffDays > 56) {
    return res.status(400).json({ error: 'We build programs for races 4–8 weeks out. Come back when you\'re closer to your race!' });
  }

  // --- Select template and Stripe URL by distance ---
  const apiKey = process.env.DROPBOX_SIGN_API_KEY;
  const templateId = cleanDist === 'full'
    ? process.env.DROPBOX_SIGN_TEMPLATE_FULL
    : process.env.DROPBOX_SIGN_TEMPLATE_703;
  const stripeBase = cleanDist === 'full'
    ? process.env.STRIPE_LINK_FULL
    : process.env.STRIPE_LINK_703;

  if (!apiKey || !templateId || !stripeBase) {
    console.error('[create-sign-request] Missing env vars:', { apiKey: !!apiKey, templateId: !!templateId, stripeBase: !!stripeBase });
    return res.status(500).json({ error: 'Service configuration error. Email hello@rikathletica.com.' });
  }

  // Append Rewardful referral to Stripe URL if present
  const cleanReferral = (referral || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
  const stripeUrl = cleanReferral ? `${stripeBase}?via=${cleanReferral}` : stripeBase;

  const ts = new Date().toISOString();
  console.log(`[create-sign-request] name=${cleanName} email=${cleanEmail} dist=${cleanDist} race=${cleanDate} referral=${cleanReferral || 'none'} ts=${ts}`);

  // --- Call Dropbox Sign REST API ---
  const auth = Buffer.from(`${apiKey}:`).toString('base64');

  try {
    const signRes = await fetch('https://api.hellosign.com/v3/signature_request/send_with_template', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: templateId,
        subject: 'RIK Athletica — Sprint Service Agreement',
        signers: [
          {
            role: 'Signer',
            name: cleanName,
            email_address: cleanEmail,
          },
        ],
        signing_redirect_url: stripeUrl,
        metadata: {
          race_date: cleanDate,
          distance: cleanDist,
          referral: cleanReferral || '',
        },
      }),
    });

    const body = await signRes.json();

    if (!signRes.ok) {
      console.error('[create-sign-request] Dropbox Sign error:', signRes.status, JSON.stringify(body));
      return res.status(500).json({ error: 'Could not set up your contract. Email hello@rikathletica.com and we\'ll sort it out.' });
    }

    const signingUrl = body?.signature_request?.signatures?.[0]?.sign_url;
    if (!signingUrl) {
      console.error('[create-sign-request] No sign_url in response:', JSON.stringify(body));
      return res.status(500).json({ error: 'Could not retrieve signing link. Email hello@rikathletica.com.' });
    }

    console.log(`[create-sign-request] sign request created: ${body?.signature_request?.signature_request_id}`);
    return res.status(201).json({ signingUrl });

  } catch (err) {
    console.error('[create-sign-request] Unexpected error:', err);
    return res.status(500).json({ error: 'Something went wrong. Email hello@rikathletica.com.' });
  }
}
