/**
 * POST /api/create-checkout
 * Creates a Stripe Checkout Session with multi-product line items + UTM metadata.
 * Replaces client-side Payment Link redirects for Sprint tiers.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY — sk_live_... from Stripe dashboard
 */

import Stripe from 'stripe';

export const config = { api: { bodyParser: true } };

const TIER_LINE_ITEMS = {
  low: {
    name: '70.3 Sprint',
    items: [
      { price: 'price_1TMQkJQwwrfrAsaG8aUehb2u', quantity: 1 },
      { price: 'price_1TE1FwQwwrfrAsaGp123IZ1u', quantity: 1 },
      { price: 'price_1TMR2mQwwrfrAsaGdtPdZBS3', quantity: 1 },
    ],
    racePackPrice: 'price_1TMR6rQwwrfrAsaGUYq5WctB',
  },
  mid: {
    name: 'Ironman Sprint',
    items: [
      { price: 'price_1TMQonQwwrfrAsaGebamnbjV', quantity: 1 },
      { price: 'price_1TMQuIQwwrfrAsaGLyzCPwVH', quantity: 1 },
      { price: 'price_1TMR4mQwwrfrAsaGF1wQwKOt', quantity: 1 },
    ],
    racePackPrice: 'price_1TMR7YQwwrfrAsaGZk5kcvyP',
  },
  high: {
    name: 'Pro Sprint',
    items: [
      { price: 'price_1TMQq8QwwrfrAsaGXONLWrJd', quantity: 1 },
      { price: 'price_1TMQvdQwwrfrAsaGBKq8boEY', quantity: 1 },
      { price: 'price_1TMR5fQwwrfrAsaG4q1Tqq9t', quantity: 1 },
    ],
    racePackPrice: 'price_1TMR8PQwwrfrAsaGM470Y95j',
  },
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('[create-checkout] STRIPE_SECRET_KEY not set');
    return res.status(500).json({ error: 'Payment configuration error' });
  }

  const stripe = new Stripe(secretKey);

  const { tier, email, name, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referral } = req.body || {};

  if (!tier || !TIER_LINE_ITEMS[tier]) {
    return res.status(400).json({ error: 'Invalid tier. Must be low, mid, or high.' });
  }

  const tierConfig = TIER_LINE_ITEMS[tier];

  const lineItems = tierConfig.items.map(item => ({
    price: item.price,
    quantity: item.quantity,
  }));

  const metadata = {
    tier: tierConfig.name,
    tier_key: tier,
    ...(utm_source   && { utm_source }),
    ...(utm_medium   && { utm_medium }),
    ...(utm_campaign && { utm_campaign }),
    ...(utm_content  && { utm_content }),
    ...(utm_term     && { utm_term }),
    ...(referral     && { referral }),
  };

  try {
    const sessionParams = {
      mode: 'payment',
      line_items: lineItems,
      metadata,
      success_url: `https://www.rikathletica.com/thank-you?tier=sprint&plan=${tier === 'low' ? '703' : tier === 'mid' ? 'full' : 'pro'}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: 'https://www.rikathletica.com/sprint#eligibility',
      shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'AU', 'NZ', 'TH', 'SG', 'HK', 'JP', 'DE', 'FR', 'NL', 'ES', 'IT', 'IE', 'AT', 'CH', 'SE', 'DK', 'NO', 'FI', 'BE', 'PT'] },
    };

    if (email) {
      sessionParams.customer_email = email;
    }

    // Race Pack as optional add-on (cross-sell)
    if (tierConfig.racePackPrice) {
      sessionParams.line_items.push({
        price: tierConfig.racePackPrice,
        quantity: 1,
        adjustable_quantity: { enabled: true, minimum: 0, maximum: 1 },
      });
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[create-checkout] Stripe error:', err.message);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
