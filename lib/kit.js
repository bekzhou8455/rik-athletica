// RIK Audit — Kit (formerly ConvertKit) tagging client.
// Kit v3 API: https://developers.kit.com/

const KIT_BASE = 'https://api.kit.com/v3';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// === Subscribe + tag in one call ===
// Kit pattern: POST /tags/{id}/subscribe with email → adds-or-creates subscriber + tags them.
export async function tagSubscriber({ email, firstName, tagId, fields = {} }) {
  if (!tagId) {
    console.warn('[kit] tagSubscriber called with empty tagId — skipping');
    return null;
  }
  const apiSecret = requireEnv('KIT_API_SECRET');
  const body = {
    api_secret: apiSecret,
    email,
    first_name: firstName,
    fields,
  };
  const res = await fetch(`${KIT_BASE}/tags/${tagId}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kit tag ${tagId} failed: ${res.status} ${text}`);
  }
  return res.json();
}

// === Convenience wrappers (one per lifecycle event) ===
export async function tagAuditSubmitted(email, firstName, fields = {}) {
  return tagSubscriber({
    email, firstName,
    tagId: process.env.KIT_TAG_AUDIT_SUBMITTED,
    fields,
  });
}

export async function tagAuditDelivered(email, firstName, { tierTagId, fields = {} } = {}) {
  // Two writes: the generic 'delivered' tag (triggers A16 nurture) + tier-specific tag (routes branch).
  await tagSubscriber({
    email, firstName,
    tagId: process.env.KIT_TAG_AUDIT_DELIVERED,
    fields,
  });
  if (tierTagId) {
    await tagSubscriber({ email, firstName, tagId: tierTagId, fields });
  }
}

export async function tagAuditNoConvert(email) {
  return tagSubscriber({
    email,
    tagId: process.env.KIT_TAG_AUDIT_NO_CONVERT,
  });
}

export async function tagAuditConverted(email, firstName, tierKey) {
  // Generic 'converted' tag + tier-specific conversion tag
  await tagSubscriber({
    email, firstName,
    tagId: process.env.KIT_TAG_AUDIT_CONVERTED,
  });
  const map = {
    bundle:  process.env.KIT_TAG_CONVERTED_BUNDLE,
    sprint:  process.env.KIT_TAG_CONVERTED_SPRINT,
    premium: process.env.KIT_TAG_CONVERTED_PREMIUM,
  };
  const tierTagId = map[tierKey];
  if (tierTagId) {
    await tagSubscriber({ email, firstName, tagId: tierTagId });
  }
}

// === Tier → Kit tag id resolver (used at delivery) ===
export function tierTagIdFor(tierKey) {
  const map = {
    bundle:      process.env.KIT_TAG_TIER_BUNDLE,
    bundle_pdf:  process.env.KIT_TAG_TIER_BUNDLE_PDF,
    sprint:      process.env.KIT_TAG_TIER_SPRINT,
    premium:     process.env.KIT_TAG_TIER_PREMIUM,
  };
  return map[tierKey] ?? null;
}

// ─── Kit v4 API — nurture tag operations ────────────────────────────────────
// Used by: api/audit/approve.js, api/stripe-webhook.js
// Auth: Bearer token via KIT_API_SECRET (v4 key, format: kit_...)
// These functions work with tag names (not IDs) — IDs are fetched + cached.

const KIT_V4_BASE = 'https://api.kit.com/v4';
const _tagIdCache = new Map(); // tagName → tagId

function v4Headers() {
  const token = process.env.KIT_API_SECRET;
  if (!token) throw new Error('Missing KIT_API_SECRET');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// Fetch all tags and cache name→id. Returns tagId or null if not found.
async function resolveTagId(tagName) {
  if (_tagIdCache.has(tagName)) return _tagIdCache.get(tagName);
  const res = await fetch(`${KIT_V4_BASE}/tags?per_page=500`, { headers: v4Headers() });
  if (!res.ok) throw new Error(`Kit GET /v4/tags failed: ${res.status}`);
  const data = await res.json();
  for (const t of (data.tags || [])) _tagIdCache.set(t.name, String(t.id));
  return _tagIdCache.get(tagName) ?? null;
}

// Find Kit subscriber ID by email. Returns null if not a subscriber yet.
async function resolveSubscriberId(email) {
  const url = `${KIT_V4_BASE}/subscribers?email_address=${encodeURIComponent(email)}`;
  const res = await fetch(url, { headers: v4Headers() });
  if (!res.ok) throw new Error(`Kit GET /v4/subscribers failed: ${res.status}`);
  const data = await res.json();
  return data.subscribers?.[0]?.id ? String(data.subscribers[0].id) : null;
}

/**
 * Add a nurture tag to a subscriber by tag name.
 * Creates the subscriber in Kit if not present.
 * @param {string} email
 * @param {string} firstName
 * @param {string} tagName  — exact tag name as it appears in Kit
 * @param {object} fields   — custom fields to set on the subscriber (optional)
 */
export async function addNurtureTag(email, firstName, tagName, fields = {}) {
  const tagId = await resolveTagId(tagName);
  if (!tagId) throw new Error(`Kit tag not found: "${tagName}" — create it in Kit dashboard first`);
  const body = { email_address: email, first_name: firstName || undefined };
  if (Object.keys(fields).length) body.fields = fields;
  const res = await fetch(`${KIT_V4_BASE}/tags/${tagId}/subscribers`, {
    method: 'POST',
    headers: v4Headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Kit addNurtureTag(${tagName}) failed: ${res.status} ${txt}`);
  }
  return res.json();
}

/**
 * Remove a list of nurture tags from a subscriber.
 * Fail-soft per tag — one missing tag won't block the others.
 * No-ops silently if the subscriber doesn't exist in Kit.
 * @param {string} email
 * @param {string[]} tagNames
 */
export async function removeNurtureTags(email, tagNames) {
  const subscriberId = await resolveSubscriberId(email).catch(() => null);
  if (!subscriberId) return; // not a Kit subscriber — nothing to remove
  const headers = v4Headers();
  await Promise.allSettled(tagNames.map(async tagName => {
    const tagId = await resolveTagId(tagName).catch(() => null);
    if (!tagId) return;
    await fetch(`${KIT_V4_BASE}/subscribers/${subscriberId}/tags/${tagId}`, {
      method: 'DELETE',
      headers,
    });
  }));
}
