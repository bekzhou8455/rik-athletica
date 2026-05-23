// scripts/generate-audit-preview.mjs
// Generates 6 anonymized audit-preview PNGs for the /audit "what you'll get" gallery.
// Run with: ~/.bun/bin/bun scripts/generate-audit-preview.mjs
//
// Uses puppeteer-core + the user's existing Chrome install (no Chromium download).
// Re-run this whenever the audit render changes meaningfully.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'assets', 'audit-preview');
mkdirSync(OUT_DIR, { recursive: true });

// Resolve Chrome on macOS / Linux / Windows (in that order)
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const CHROME = CHROME_CANDIDATES.find(p => { try { return existsSync(p); } catch { return false; } });
if (!CHROME) {
  console.error('Could not find Chrome. Edit CHROME_CANDIDATES in this script.');
  process.exit(1);
}

// === Lazy-import puppeteer-core (must be installed first) ===
let puppeteer;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  console.error('puppeteer-core not installed. Run: ~/.bun/bin/bun add -d puppeteer-core');
  process.exit(1);
}

// === Import the actual renderer + engine so previews always match production ===
const { renderAuditPage } = await import('../lib/render.js');
const { runEngine } = await import('../lib/routing.js');

// === Anonymized mock athlete: "Alex Morgan" ===
// Profile: 35-year-old age-grouper, IM 70.3 in 8 weeks, mid-volume, no coach,
// has a real fueling gap (50 g/hr vs ~80 g/hr target). Realistic and showcases
// every page (timeline gap, risk window, race card, RD note, share).
const mockAnswers = {
  raceDistance: '70.3',
  raceDate: new Date(Date.now() + 56 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  targetTime: '5:15',
  weeklyHours: '12-16',
  brands: ['SiS', 'Maurten'],
  carbsPerHour: '45-60',
  giHistory: 'rarely',
  giNotes: '',
  bodyWeight: '75',
  weightUnit: 'kg',
  sweatRate: 'medium',
  hasCoach: 'no',
  coachName: null,
  specificConcern: 'I bonk around mile 8 of the run every single race.',
  firstName: 'Alex',
  email: 'preview@rikathletica.com',
  consent: true,
};

const engine = runEngine(mockAnswers);
const drafts = {
  what_i_noticed:
    "You're at ~52 g/hr with a 70.3 in 8 weeks — exactly the gap most age-groupers don't realize they have. Your gut tolerates moderate intake but isn't trained for race-day load. With 8 weeks, you have the full Sprint window to ramp safely.",
  why_this_tier:
    "Sprint is built for your exact situation: real deficit, enough runway for the 4-week gut ramp, no coach managing the math. The structured weekly progression removes the guesswork on how fast to push intake.",
  specific_question_answer:
    "Bonk at mile 8 of the run is almost always a bike-leg shortfall catching up. Your bike at 70.3 pace runs ~2:45 — at 52 g/hr that's a ~75 g deficit by T2. The fix isn't more on the run — it's getting bike intake to 75-85 g/hr so you arrive at the run with reserves.",
  _meta: { model: 'preview-mock' },
};

const mockRow = {
  id: 0,
  email: mockAnswers.email,
  first_name: mockAnswers.firstName,
  status: 'delivered',
  slug: 'preview',
  delivered_at: new Date().toISOString(),
  pdf_url: null,
  answers: mockAnswers,
  engine,
  drafts: drafts,
  drafts_final: drafts,
};

const html = renderAuditPage(mockRow);
const sourcePath = join(OUT_DIR, '_preview-source.html');
writeFileSync(sourcePath, html);
console.log('[preview] wrote source HTML:', sourcePath);

// === Launch Chrome headless ===
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  defaultViewport: { width: 1080, height: 800, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
await page.goto('file://' + sourcePath, { waitUntil: 'networkidle0', timeout: 30000 });
// Wait for fonts so screenshots aren't FOIT
await page.evaluateHandle('document.fonts.ready');
await new Promise(r => setTimeout(r, 800));

// Hide sticky CTA + share builder before screenshots (they look noisy as previews)
await page.addStyleTag({
  content: `
    .sticky-cta, .copy-toast { display: none !important; }
  `,
});

// === Sections to capture (new 4-section template + dark hero) ===
const sections = [
  { selector: '.hero',                       name: '01-hero.png',     label: 'Dark hero (athlete + big number)' },
  { selector: '.page .section:nth-of-type(1)', name: '02-gap.png',     label: 'Section 1 — Primary Gap' },
  { selector: '.page .section:nth-of-type(2)', name: '03-impact.png',  label: 'Section 2 — Estimated Impact' },
  { selector: '.page .section:nth-of-type(3)', name: '04-tactics.png', label: 'Section 3 — The Fix (tactic cards)' },
  { selector: '.page .section:nth-of-type(4)', name: '05-next.png',    label: 'Section 4 — Next Step (routing)' },
];

for (const s of sections) {
  const el = await page.$(s.selector);
  if (!el) { console.warn('[preview] selector not found:', s.selector); continue; }
  await el.scrollIntoView();
  await new Promise(r => setTimeout(r, 200));
  const box = await el.boundingBox();
  await el.screenshot({ path: join(OUT_DIR, s.name), type: 'png' });
  console.log(`[preview] saved ${s.name} (${Math.round(box.width)}×${Math.round(box.height)}) — ${s.label}`);
}

await browser.close();
console.log('[preview] done. Six PNGs in assets/audit-preview/');
