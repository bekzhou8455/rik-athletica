/**
 * POST /api/stripe-webhook
 * Stripe webhook handler for payment events.
 * Sends payment confirmation to athlete + internal alert to founder.
 * Optionally removes athlete from marketing sequence (E1-E3) after payment.
 *
 * Required env vars:
 *   RESEND_API_KEY       — re_... from resend.com
 *   STRIPE_WEBHOOK_SECRET — whsec_... from Stripe dashboard → Webhooks
 *   INTERNAL_ALERT_EMAIL — founder email for payment alerts
 *
 * Stripe webhook setup:
 *   URL: https://www.rikathletica.com/api/stripe-webhook
 *   Events: checkout.session.completed
 *
 * TODO (wire later):
 *   - Cancel scheduled E1-E3 emails for this customer (opt out of marketing after payment)
 *   - Schedule intake incomplete reminder at +48 hours
 */

import { paymentConfirmation, internalPaymentAlert } from './onboarding-templates.js';

const FROM = 'RIK Athletica <hello@rikathletica.com>';

// ─── Stripe signature verification ───
async function verifyStripeSignature(req) {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) return null;

  // For now, trust the payload if secret is not set (dev mode)
  // In production, use Stripe SDK to verify: stripe.webhooks.constructEvent(body, sig, secret)
  // TODO: add proper Stripe signature verification with stripe npm package
  return req.body;
}

// ─── Map Stripe amount to tier ───
function getTier(amountCents) {
  if (amountCents <= 57000) return { tier: '70.3 Sprint', amount: '569' };
  if (amountCents <= 66000) return { tier: 'Ironman Sprint', amount: '659' };
  return { tier: 'Pro Sprint', amount: '799' };
}

async function resendFetch(apiKey, body) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, data: r.ok ? await r.json() : await r.text() };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const alertEmail = process.env.INTERNAL_ALERT_EMAIL;

  if (!apiKey) {
    console.log('[stripe-webhook] No RESEND_API_KEY, skipping emails');
    return res.status(200).json({ ok: true, sent: false });
  }

  try {
    const event = req.body;
    const type = event?.type;

    console.log(`[stripe-webhook] Event: ${type}`);

    if (type !== 'checkout.session.completed') {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const session = event.data?.object;
    const customerEmail = session?.customer_details?.email || session?.customer_email;
    const customerName = session?.customer_details?.name || '';
    const amountTotal = session?.amount_total || 0;
    const { tier, amount } = getTier(amountTotal);

    console.log(`[stripe-webhook] Payment: ${customerEmail}, ${tier}, $${amount}`);

    const results = { confirmation: false, alert: false };

    // ─── 1. Send payment confirmation to athlete ───
    if (customerEmail) {
      const template = paymentConfirmation({
        name: customerName,
        email: customerEmail,
        tier,
        amount,
      });
      const r = await resendFetch(apiKey, {
        from: FROM,
        to: [customerEmail],
        subject: template.subject,
        html: template.html,
      });
      results.confirmation = r.ok;
      if (!r.ok) console.error('[stripe-webhook] Confirmation failed:', r.data);
    }

    // ─── 2. Internal alert to founder ───
    if (alertEmail) {
      const alert = internalPaymentAlert({
        name: customerName,
        email: customerEmail,
        tier,
        amount,
        raceDate: session?.metadata?.race_date || null,
      });
      const r = await resendFetch(apiKey, {
        from: FROM,
        to: [alertEmail],
        subject: alert.subject,
        html: alert.html,
      });
      results.alert = r.ok;
      if (!r.ok) console.error('[stripe-webhook] Alert failed:', r.data);
    }

    // TODO: Cancel scheduled marketing emails (E1-E3) for this customer
    // Requires storing Resend email IDs from the leads endpoint and calling
    // DELETE https://api.resend.com/emails/{id} for each scheduled email.
    // Wire this after Resend email ID tracking is implemented.

    // TODO: Schedule intake incomplete reminder at +48 hours
    // Uses internalIntakeReminder template from onboarding-templates.js
    // Wire after intake form completion tracking is in place.

    console.log('[stripe-webhook] Results:', JSON.stringify(results));
    return res.status(200).json({ ok: true, ...results });

  } catch (err) {
    console.error('[stripe-webhook] Error:', err);
    return res.status(200).json({ ok: true, error: err.message });
  }
}
