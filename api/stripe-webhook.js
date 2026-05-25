/**
 * POST /api/stripe-webhook
 * Stripe webhook handler for checkout.session.completed events.
 * Sends:
 *   1. Payment confirmation + next-steps email to the athlete (payer)
 *   2. Internal payment alert to the founder
 *
 * Required env vars:
 *   STRIPE_WEBHOOK_SECRET  — whsec_... from Stripe dashboard → Webhooks
 *   INTERNAL_ALERT_EMAIL   — founder email for payment alerts
 *   GMAIL_USER / GMAIL_APP_PASSWORD — set via mailer.js
 *
 * Stripe webhook setup:
 *   URL: https://www.rikathletica.com/api/stripe-webhook
 *   Events: checkout.session.completed
 */

import crypto from 'crypto';
import { sendMail, mailerReady } from './mailer.js';
import { markScreeningPaidByEmail } from '../lib/db.js';
import { addNurtureTag, removeNurtureTags } from '../lib/kit.js';

// Disable Vercel's automatic body parsing — Stripe signature verification
// requires the exact raw bytes, not a re-serialised JSON object.
export const config = { api: { bodyParser: false } };

// Read raw request body from stream
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ─── Stripe signature verification ───
function verifyStripeSignature(rawBody, sig, secret) {
  try {
    const parts = Object.fromEntries(sig.split(',').map(p => p.split('=')));
    const timestamp = parts.t;
    const expected  = parts.v1;
    if (!timestamp || !expected) return false;
    const payload  = `${timestamp}.${rawBody}`;
    const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── Map Stripe amount to tier label + key ───
function getTierLabel(amountCents) {
  const dollars = Math.round(amountCents / 100);
  if (dollars < 200)  return 'Bundle';
  if (dollars < 700)  return dollars <= 610 ? '70.3 Sprint' : 'Full Ironman Sprint';
  if (dollars < 1000) return 'Sprint Pro';
  return 'Founding Cohort Premium';
}

// bundle | sprint | premium — used for cart-recovery tag name
function getTierKey(amountCents) {
  const dollars = Math.round(amountCents / 100);
  if (dollars < 200)  return 'bundle';
  if (dollars < 1000) return 'sprint';
  return 'premium';
}

// Kill-switch: tags removed on any successful purchase.
// Includes retired sequences (post-audit-nurture, bundle-to-sprint-upsell) so
// existing subscribers with those tags get cleaned up on their next purchase.
const ALL_NURTURE_TAGS = [
  'cart-recovery-bundle',
  'cart-recovery-sprint',
  'cart-recovery-premium',
  'post-audit-nurture',
  'bundle-to-sprint-upsell',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── Read raw body + verify Stripe signature ───
  const rawBody = (await getRawBody(req)).toString('utf8');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers['stripe-signature'] || '';

  if (webhookSecret && sig) {
    if (!verifyStripeSignature(rawBody, sig, webhookSecret)) {
      console.warn('[stripe-webhook] Invalid signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  }

  const event = JSON.parse(rawBody);
  const type  = event?.type;
  console.log(`[stripe-webhook] Event: ${type}`);

  // ─── checkout.session.expired → cart-abandonment tag ───
  // Fires ~24h after the session was opened without payment.
  // Requires "checkout.session.expired" added to the Stripe webhook events list.
  if (type === 'checkout.session.expired') {
    const session = event.data?.object || {};
    const email   = session.customer_details?.email || session.customer_email || '';
    const name    = session.customer_details?.name  || '';
    if (email) {
      const amountCents = session.amount_total || 0;
      const tierKey  = getTierKey(amountCents);
      const tierLabel = getTierLabel(amountCents);
      const tagName  = `cart-recovery-${tierKey}`;
      addNurtureTag(email, name.split(' ')[0] || '', tagName, {
        tier_in_cart:       tierLabel,
        tier_in_cart_price: String(Math.round(amountCents / 100)),
      }).catch(err => console.error(`[stripe-webhook] cart-recovery tag failed: ${err.message}`));
    }
    return res.status(200).json({ ok: true });
  }

  if (type !== 'checkout.session.completed') {
    return res.status(200).json({ ok: true, skipped: true });
  }

  if (!mailerReady()) {
    console.warn('[stripe-webhook] Gmail credentials not set — skipping emails');
    return res.status(200).json({ ok: true, sent: false });
  }

  const session      = event.data?.object || {};
  const customerEmail = session.customer_details?.email || session.customer_email || '';
  const customerName  = session.customer_details?.name  || '';
  const amountCents   = session.amount_total || 0;
  const amountDollars = (amountCents / 100).toFixed(0);
  const tier          = getTierLabel(amountCents);
  const raceDate      = session.metadata?.race_date || '';
  const ts            = new Date().toISOString();

  console.log(`[stripe-webhook] Payment: ${customerEmail} | ${tier} | $${amountDollars}`);

  const alertEmail = process.env.INTERNAL_ALERT_EMAIL;
  const results    = { confirmation: false, alert: false };

  // ─── 1. Athlete confirmation ───
  if (customerEmail) {
    try {
      await sendMail({
        to: customerEmail,
        subject: `Payment confirmed — your ${tier} is in`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F5F1;font-family:Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">

  <div style="margin-bottom:32px;">
    <img src="https://cdn.jsdelivr.net/gh/bekzhou8455/rik-athletica@main/assets/media/rik-logo-cropped.png" alt="RIK Athletica" style="height:36px;width:auto;">
  </div>

  <h1 style="font-size:24px;font-weight:600;color:#111410;letter-spacing:-0.03em;margin:0 0 12px;">
    Payment confirmed.
  </h1>
  <p style="font-size:15px;color:#6B6860;line-height:1.65;margin:0 0 28px;">
    Hi ${customerName || 'there'} — your ${tier} ($${amountDollars}) is confirmed. Here's what happens next.
  </p>

  <div style="border-top:1px solid #E4E1DA;padding-top:24px;margin-bottom:8px;">
    <div style="display:flex;gap:16px;padding:12px 0;border-bottom:1px solid #E4E1DA;">
      <span style="font-size:18px;font-weight:700;color:#2D5A3D;min-width:28px;">1</span>
      <div>
        <p style="font-size:14px;font-weight:600;color:#111410;margin:0 0 2px;">Complete your intake form</p>
        <p style="font-size:13px;color:#6B6860;margin:0;">~10 min. Your physiology, training history, and race details.</p>
      </div>
    </div>
    <div style="display:flex;gap:16px;padding:12px 0;border-bottom:1px solid #E4E1DA;">
      <span style="font-size:18px;font-weight:700;color:#2D5A3D;min-width:28px;">2</span>
      <div>
        <p style="font-size:14px;font-weight:600;color:#111410;margin:0 0 2px;">We build your protocol</p>
        <p style="font-size:13px;color:#6B6860;margin:0;">Personalised to your data. Training box ships within 5 days.</p>
      </div>
    </div>
    <div style="display:flex;gap:16px;padding:12px 0;border-bottom:1px solid #E4E1DA;">
      <span style="font-size:18px;font-weight:700;color:#2D5A3D;min-width:28px;">3</span>
      <div>
        <p style="font-size:14px;font-weight:600;color:#111410;margin:0 0 2px;">Weekly revisions</p>
        <p style="font-size:13px;color:#6B6860;margin:0;">Check in each week. We refine until race day.</p>
      </div>
    </div>
    <div style="display:flex;gap:16px;padding:12px 0;">
      <span style="font-size:18px;font-weight:700;color:#2D5A3D;min-width:28px;">4</span>
      <div>
        <p style="font-size:14px;font-weight:600;color:#111410;margin:0 0 2px;">Race Pack (add-on)</p>
        <p style="font-size:13px;color:#6B6860;margin:0;">Optional. Add before Week 4 and it ships ~10 days before race day.</p>
      </div>
    </div>
  </div>

  <div style="margin:28px 0;">
    <a href="https://form.typeform.com/to/L8eKXcks"
       style="display:inline-block;background:#2D5A3D;color:#fff;text-decoration:none;font-size:14px;font-weight:500;padding:13px 28px;border-radius:36px;">
      Complete Your Intake Form →
    </a>
  </div>

  <div style="height:1px;background:#E4E1DA;margin:0 0 20px;"></div>
  <p style="font-size:11px;color:#9C9890;line-height:1.6;margin:0;">
    Questions? Reply to this email.
    &nbsp;·&nbsp; <a href="https://www.rikathletica.com/privacy" style="color:#9C9890;">Privacy</a>
    &nbsp;·&nbsp; RIK Athletic Nutrition Inc.
  </p>

</div>
</body>
</html>`,
      });
      results.confirmation = true;
    } catch (err) {
      console.error('[stripe-webhook] Confirmation email failed:', err.message);
    }
  }

  // ─── 2. Internal founder alert ───
  if (alertEmail) {
    try {
      await sendMail({
        to: alertEmail,
        subject: `New payment: $${amountDollars} — ${customerName || customerEmail} (${tier})`,
        html: `<div style="font-family:sans-serif;padding:24px;max-width:520px;">
  <h2 style="margin:0 0 4px;color:#2D5A3D;">New Sprint Payment</h2>
  <p style="font-size:13px;color:#aaa;margin:0 0 20px;">${ts.replace('T',' ').slice(0,16)} UTC</p>
  <table style="font-size:14px;border-collapse:collapse;width:100%;">
    <tr><td style="padding:8px 16px 8px 0;color:#888;width:120px;">Athlete</td><td style="padding:8px 0;font-weight:600;">${customerName || '—'}</td></tr>
    <tr><td style="padding:8px 16px 8px 0;color:#888;">Email</td><td style="padding:8px 0;">${customerEmail || '—'}</td></tr>
    <tr><td style="padding:8px 16px 8px 0;color:#888;">Tier</td><td style="padding:8px 0;">${tier}</td></tr>
    <tr><td style="padding:8px 16px 8px 0;color:#888;">Amount</td><td style="padding:8px 0;font-weight:700;color:#2D5A3D;">$${amountDollars}</td></tr>
    ${raceDate ? `<tr><td style="padding:8px 16px 8px 0;color:#888;">Race Date</td><td style="padding:8px 0;">${raceDate}</td></tr>` : ''}
  </table>
  <div style="background:#f0f7f3;border:1px solid #c8e0d0;border-radius:8px;padding:14px;margin-top:20px;">
    <p style="margin:0;font-size:13px;color:#2D5A3D;font-weight:600;">Next step: wait for intake form submission.</p>
    <p style="margin:6px 0 0;font-size:12px;color:#888;">Athlete has been sent confirmation + intake link. Build protocol once intake arrives.</p>
  </div>
</div>`,
      });
      results.alert = true;
    } catch (err) {
      console.error('[stripe-webhook] Alert email failed:', err.message);
    }
  }

  // ─── 3. Kit kill switch — remove all nurture tags on purchase ───
  // Exits the subscriber from any running nurture sequence (post-audit, cart-recovery, upsell).
  if (customerEmail) {
    removeNurtureTags(customerEmail, ALL_NURTURE_TAGS)
      .catch(err => console.error('[stripe-webhook] nurture tag removal failed:', err.message));
  }

  // ─── 4. Conversion tag — drives RIK_Email_Sequences_v2.md ───
  // Bundle purchase → STRIPE_CONVERSION_BUNDLE → triggers Sequence 1 (B1/B2/B3).
  // Sprint/Premium → STRIPE_CONVERSION_SPRINT → exit signal for Sequence 1
  // (and entry hook for future Sprint-side nurture if added).
  if (customerEmail) {
    const tierKey = getTierKey(amountCents);
    const conversionTag = tierKey === 'bundle'
      ? 'STRIPE_CONVERSION_BUNDLE'
      : 'STRIPE_CONVERSION_SPRINT';
    addNurtureTag(customerEmail, customerName.split(' ')[0] || '', conversionTag, {
      purchase_date_short: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }).catch(err => console.error(`[stripe-webhook] ${conversionTag} tag failed:`, err.message));
  }

  // ─── 5. Mark Sprint screening as paid → suppresses S1 cart-abandonment ───
  // Best-effort: failures here must NOT 500 the webhook (Stripe will retry).
  if (customerEmail) {
    try {
      const matched = await markScreeningPaidByEmail(customerEmail);
      if (matched > 0) {
        console.log(`[stripe-webhook] Marked ${matched} sprint_screenings as paid for ${customerEmail}`);
      }
    } catch (err) {
      console.error('[stripe-webhook] markScreeningPaidByEmail failed:', err.message);
    }
  }

  console.log('[stripe-webhook] Results:', JSON.stringify(results));
  return res.status(200).json({ ok: true, ...results });
}
