// GET /api/audit/render?slug=XXXXXX
// Public personalized page renderer.
// vercel.json rewrites /a/:slug → /api/audit/render?slug=:slug
// Returns rendered HTML; 404 if slug not found or not delivered.

import { getAuditBySlug } from '../../lib/db.js';
import { renderAuditPage } from '../../lib/render.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('method not allowed');

  const slug = String(req.query?.slug ?? '').trim();
  if (!slug || !/^[A-Za-z0-9_-]{4,16}$/.test(slug)) {
    return res.status(404).end('not found');
  }

  let row;
  try {
    row = await getAuditBySlug(slug);
  } catch (err) {
    console.error('[render] db error:', err);
    return res.status(500).end('server error');
  }

  if (!row) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).end(notFoundHtml());
  }

  // Optional: 90-day expiry
  if (row.delivered_at) {
    const ageDays = (Date.now() - new Date(row.delivered_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 90) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(410).end(expiredHtml());
    }
  }

  const html = renderAuditPage(row);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return res.status(200).end(html);
}

function notFoundHtml() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Audit not found — RIK</title><meta name="robots" content="noindex,nofollow">
<style>body{font-family:system-ui;max-width:520px;margin:80px auto;padding:24px;color:#0a0a0a;line-height:1.6}a{color:#2D5A3D}</style></head>
<body><h1>Audit not found</h1><p>This audit link is invalid or has been removed. If you submitted an audit recently and lost your email, reply to your last message from Bek.</p>
<p><a href="https://rikathletica.com">← rikathletica.com</a></p></body></html>`;
}

function expiredHtml() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Audit expired — RIK</title><meta name="robots" content="noindex,nofollow">
<style>body{font-family:system-ui;max-width:520px;margin:80px auto;padding:24px;color:#0a0a0a;line-height:1.6}a{color:#2D5A3D}</style></head>
<body><h1>This audit has expired</h1><p>Audit links live for 90 days. For a fresh personalized audit, fill out the form again — it's free.</p>
<p><a href="https://rikathletica.com/audit">← Get a fresh audit</a></p></body></html>`;
}
