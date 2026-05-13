// RIK Audit — Kit (formerly ConvertKit) tagging client.
// Kit v4 API: https://developers.kit.com/v4
//
// Auth: API keys (format kit_...) use the X-Kit-Api-Key header.
// Bearer auth is only for OAuth tokens (format eyJ...). Mixing these up
// silently 401s every call — see commit 0d64e5d for the history of that bug.

const KIT_V4_BASE = 'https://api.kit.com/v4';

// === Subscribe + tag (2-step v4 pattern) ===
// Kit v4 doesn't expose a single-call "tag-by-email" endpoint — that pattern
// returns 404. Always 2 steps:
//   1. POST /v4/subscribers (idempotent — 200 if exists by email, 201 if new)
//   2. POST /v4/tags/{tag_id}/subscribers/{subscriber_id}
export async function tagSubscriber({ email, firstName, tagId, fields = {} }) {
  if (!tagId) {
    console.warn('[kit] tagSubscriber called with empty tagId — skipping');
    return null;
  }
  const subscriberId = await findOrCreateSubscriber({ email, firstName, fields });
  return applyTag({ subscriberId, tagId });
}

// Idempotent: 200 if subscriber exists by email, 201 if just created.
// Fail-soft on custom field errors — if Kit rejects unknown field keys (422),
// retry without fields so the subscription + tag still goes through.
async function findOrCreateSubscriber({ email, firstName, fields = {} }) {
  const body = { email_address: email };
  if (firstName) body.first_name = firstName;
  if (fields && Object.keys(fields).length) body.fields = fields;

  let res = await fetch(`${KIT_V4_BASE}/subscribers`, {
    method: 'POST',
    headers: v4Headers(),
    body: JSON.stringify(body),
  });

  // Custom-field retry: Kit returns 422 + "Unknown custom field key" when fields
  // aren't defined in the account UI. Strip fields and try again — the
  // subscription is more important than the metadata.
  if (res.status === 422 && body.fields) {
    const text = await res.text();
    if (text.includes('Unknown custom field key')) {
      console.warn('[kit] custom fields not defined in Kit account, retrying without:', text);
      delete body.fields;
      res = await fetch(`${KIT_V4_BASE}/subscribers`, {
        method: 'POST',
        headers: v4Headers(),
        body: JSON.stringify(body),
      });
    }
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kit findOrCreate subscriber failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  const id = data.subscriber?.id;
  if (!id) throw new Error('Kit findOrCreate returned no subscriber id');
  return id;
}

async function applyTag({ subscriberId, tagId }) {
  const res = await fetch(`${KIT_V4_BASE}/tags/${tagId}/subscribers/${subscriberId}`, {
    method: 'POST',
    headers: v4Headers(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kit apply tag ${tagId} → subscriber ${subscriberId} failed: ${res.status} ${text}`);
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
// Auth header chosen by token format:
//   - API key (kit_...)  → X-Kit-Api-Key
//   - OAuth JWT (eyJ...) → Authorization: Bearer
// These functions work with tag names (not IDs) — IDs are fetched + cached.

const _tagIdCache = new Map(); // tagName → tagId

function v4Headers() {
  const token = process.env.KIT_API_SECRET;
  if (!token) throw new Error('Missing KIT_API_SECRET');
  const headers = { 'Content-Type': 'application/json' };
  if (token.startsWith('eyJ')) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    headers['X-Kit-Api-Key'] = token;
  }
  return headers;
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
  const subscriberId = await findOrCreateSubscriber({ email, firstName, fields });
  return applyTag({ subscriberId, tagId });
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
    // URL order mirrors the apply: tags/{tag_id}/subscribers/{sub_id}.
    // The reverse order (subscribers/{id}/tags/{id}) returns 404 in v4.
    await fetch(`${KIT_V4_BASE}/tags/${tagId}/subscribers/${subscriberId}`, {
      method: 'DELETE',
      headers,
    });
  }));
}
