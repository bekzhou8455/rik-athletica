// RIK Athletica — Klaviyo (replaces Kit as of 2026-05-28).
// Klaviyo v2024-10-15 API. Auth: Authorization: Klaviyo-API-Key pk_...
// Docs: https://developers.klaviyo.com/en/reference/api_overview
//
// Pattern: each lifecycle event becomes a Klaviyo Metric. Flows trigger off Metrics.
// We do NOT use "tags" in Klaviyo — events + segments replace Kit's tag model.

const KLAVIYO_BASE   = 'https://a.klaviyo.com/api';
const KLAVIYO_REV    = '2024-10-15';

function klaviyoHeaders() {
  const key = process.env.KLAVIYO_API_KEY;
  if (!key) throw new Error('Missing KLAVIYO_API_KEY');
  return {
    'Authorization': `Klaviyo-API-Key ${key}`,
    'revision':      KLAVIYO_REV,
    'accept':        'application/json',
    'Content-Type':  'application/json',
  };
}

/**
 * Track a custom event on a profile. Creates the profile if it doesn't exist,
 * and creates the metric (event type) on first use.
 *
 * @param {string} email        — required
 * @param {string} firstName    — optional
 * @param {string} metricName   — e.g. "Bundle Purchase", "Audit Submitted"
 * @param {object} properties   — event-specific data (will appear on the event in Klaviyo)
 */
export async function trackEvent({ email, firstName, metricName, properties = {} }) {
  if (!email) throw new Error('trackEvent: email is required');
  if (!metricName) throw new Error('trackEvent: metricName is required');

  const body = {
    data: {
      type: 'event',
      attributes: {
        properties,
        metric: {
          data: {
            type: 'metric',
            attributes: { name: metricName },
          },
        },
        profile: {
          data: {
            type: 'profile',
            attributes: {
              email,
              ...(firstName ? { first_name: firstName } : {}),
            },
          },
        },
      },
    },
  };

  const res = await fetch(`${KLAVIYO_BASE}/events/`, {
    method: 'POST',
    headers: klaviyoHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Klaviyo trackEvent("${metricName}") failed: ${res.status} ${text}`);
  }
  // 202 Accepted (Klaviyo processes async). No body returned.
  return { ok: true };
}

/**
 * Add a profile to the main subscriber list (subscribe to email marketing).
 * Uses subscription-bulk-create-jobs endpoint for proper opt-in handling.
 *
 * @param {string} email      — required
 * @param {string} firstName  — optional
 * @param {string} listId     — Klaviyo list ID (defaults to KLAVIYO_LIST_ID env)
 */
export async function subscribeToList({ email, firstName, listId }) {
  if (!email) throw new Error('subscribeToList: email is required');
  const targetList = listId || process.env.KLAVIYO_LIST_ID;
  if (!targetList) throw new Error('subscribeToList: missing list ID (provide listId arg or KLAVIYO_LIST_ID env)');

  const body = {
    data: {
      type: 'profile-subscription-bulk-create-job',
      attributes: {
        profiles: {
          data: [{
            type: 'profile',
            attributes: {
              email,
              ...(firstName ? { first_name: firstName } : {}),
              subscriptions: {
                email: {
                  marketing: { consent: 'SUBSCRIBED' },
                },
              },
            },
          }],
        },
        historical_import: false,
      },
      relationships: {
        list: { data: { type: 'list', id: targetList } },
      },
    },
  };

  const res = await fetch(`${KLAVIYO_BASE}/profile-subscription-bulk-create-jobs/`, {
    method: 'POST',
    headers: klaviyoHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Klaviyo subscribeToList failed: ${res.status} ${text}`);
  }
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Convenience wrappers — one per lifecycle event, mirrors the lib/kit.js shape.
// Replace Kit calls 1:1 by importing from this file instead of lib/kit.js.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Bundle purchased via Stripe.
 * Replaces: Kit `addNurtureTag(email, firstName, 'STRIPE_CONVERSION_BUNDLE', ...)`.
 * In Klaviyo: tracks "Bundle Purchase" event + subscribes to main list.
 */
export async function trackBundlePurchase(email, firstName, properties = {}) {
  await subscribeToList({ email, firstName }).catch(err => {
    console.warn('[klaviyo] subscribeToList soft-failed:', err.message);
  });
  return trackEvent({
    email, firstName,
    metricName: 'Bundle Purchase',
    properties,
  });
}

/**
 * Sprint purchased via Stripe.
 * Replaces: Kit `addNurtureTag(email, firstName, 'STRIPE_CONVERSION_SPRINT', ...)`.
 */
export async function trackSprintPurchase(email, firstName, properties = {}) {
  await subscribeToList({ email, firstName }).catch(err => {
    console.warn('[klaviyo] subscribeToList soft-failed:', err.message);
  });
  return trackEvent({
    email, firstName,
    metricName: 'Sprint Purchase',
    properties,
  });
}

/**
 * Premium purchased via Stripe.
 */
export async function trackPremiumPurchase(email, firstName, properties = {}) {
  await subscribeToList({ email, firstName }).catch(err => {
    console.warn('[klaviyo] subscribeToList soft-failed:', err.message);
  });
  return trackEvent({
    email, firstName,
    metricName: 'Premium Purchase',
    properties,
  });
}

/**
 * Audit submitted (level-0 audit form).
 * Replaces: Kit `tagAuditSubmitted(email, firstName, fields)`.
 */
export async function trackAuditSubmitted(email, firstName, properties = {}) {
  await subscribeToList({ email, firstName }).catch(err => {
    console.warn('[klaviyo] subscribeToList soft-failed:', err.message);
  });
  return trackEvent({
    email, firstName,
    metricName: 'Audit Submitted',
    properties,
  });
}

/**
 * Audit deliverable approved + emailed.
 * Replaces: Kit `tagAuditDelivered(email, firstName, ...)`.
 */
export async function trackAuditDelivered(email, firstName, properties = {}) {
  return trackEvent({
    email, firstName,
    metricName: 'Audit Delivered',
    properties,
  });
}

/**
 * Audit subscriber didn't convert in 14 days — flagged by cron sweep.
 * Replaces: Kit `tagAuditNoConvert(email)`.
 */
export async function trackAuditNoConvert(email, firstName = '') {
  return trackEvent({
    email, firstName,
    metricName: 'Audit No Convert',
    properties: { days_elapsed: 14 },
  });
}

/**
 * Audit subscriber converted (any tier).
 * Replaces: Kit `tagAuditConverted(email, firstName, tierKey)`.
 */
export async function trackAuditConverted(email, firstName, tierKey) {
  return trackEvent({
    email, firstName,
    metricName: 'Audit Converted',
    properties: { tier: tierKey },
  });
}
