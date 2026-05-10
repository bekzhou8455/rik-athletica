/**
 * Shared email-template renderer.
 * Reads HTML files from /emails/ at request-time, substitutes {{tokens}}.
 *
 * Vercel deploys the entire repo (unless excluded by .vercelignore), so
 * `process.cwd()` resolves to the deployment root and emails/* files are
 * available read-only at runtime.
 *
 * Usage:
 *   import { renderTemplate } from '../lib/email-renderer.js';
 *   const html = renderTemplate('emails/sprint/01-screening-pass.html', {
 *     first_name: 'Alex',
 *     race_date:  'Sun, June 14, 2026',
 *     ...
 *   });
 */

import fs from 'node:fs';
import path from 'node:path';

const _cache = new Map();

/**
 * Read template HTML from disk, substitute tokens, return rendered string.
 * Tokens: any `{{token_name}}` literal in the template gets replaced with
 *         the matching key from the tokens object. Missing tokens are left
 *         as-is so they're visually obvious in the rendered email if a
 *         caller forgets a value (Resend renders them literally — caller's
 *         job to QC).
 *
 * @param {string} relPath  e.g. 'emails/sprint/01-screening-pass.html'
 * @param {Record<string,string|number>} tokens
 * @returns {string} rendered HTML
 */
export function renderTemplate(relPath, tokens) {
  let raw = _cache.get(relPath);
  if (!raw) {
    const abs = path.join(process.cwd(), relPath);
    raw = fs.readFileSync(abs, 'utf8');
    _cache.set(relPath, raw);
  }
  let html = raw;
  for (const [k, v] of Object.entries(tokens)) {
    html = html.split(`{{${k}}}`).join(String(v ?? ''));
  }
  return html;
}

/**
 * Force-clear the template cache. Useful for hot-reloads in dev — Vercel
 * functions are cold-started on every deploy, so the cache is naturally
 * scoped per deployment.
 */
export function clearTemplateCache() {
  _cache.clear();
}
