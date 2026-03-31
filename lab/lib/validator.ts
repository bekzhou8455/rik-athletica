// lib/validator.ts
// Deterministic validator — runs BETWEEN Architect AI and Auditor AI.
// Catches hallucinated numbers and unapproved products before the LLM auditor sees them.
// If this returns FAIL, the pipeline stops — no LLM call wasted on a broken protocol.

import { join } from 'path';
import type { AthleteProfile } from './types.ts';

// ── Public API ─────────────────────────────────────────────────────────────────

export interface ValidatorResult {
  outcome: 'PASS' | 'FAIL';
  reasons: string[];    // FAIL reasons (empty on PASS)
  warnings: string[];   // non-blocking operator flags
  supplyList: SupplyItem[];
}

export interface SupplyItem {
  productName: string;
  servingsNeeded: number;
  unitsToOrder: number;         // whole boxes/bottles to purchase
  unitDescription: string;      // e.g. "Box of 12 gels"
  estimatedCostUsd: number;
}

// ── Hard limits — only catch clearly hallucinated numbers ────────────────────
// Nuanced bracket checking is the Auditor AI's job (it has athlete tier context).
// Validator only blocks values that are physically impossible for ANY athlete tier.

const CARB_CEILING = 120;        // g/hr absolute max — Sub-10 ceiling is 110, add 10g buffer

// ── Internal types ─────────────────────────────────────────────────────────────

interface Product {
  name: string;
  caffeineMg: number;
  servingsPerUnit: number;
  pricePerUnit: number;
  purchaseUnitDesc: string;
}

// ── CSV parser (handles quoted fields) ───────────────────────────────────────

function parseProductsCsv(csv: string): Product[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const fields: string[] = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { fields.push(cur); cur = ''; }
      else { cur += ch; }
    }
    fields.push(cur);
    const get = (col: string) => (fields[headers.indexOf(col)] ?? '').trim();
    return {
      name: get('product_name'),
      caffeineMg: parseInt(get('caffeine_mg')) || 0,
      servingsPerUnit: parseInt(get('servings_per_unit')) || 1,
      pricePerUnit: parseFloat(get('price_per_unit_usd')) || 0,
      purchaseUnitDesc: get('purchase_unit_desc'),
    };
  });
}

// ── Section classifier (bike vs run vs other) ─────────────────────────────────

type Leg = 'bike' | 'run' | 'other';

function classifySection(header: string): Leg {
  const h = header.toLowerCase();
  if (/\bbike\b|\bcycl/.test(h) && !/transition|t1|t2/.test(h)) return 'bike';
  if (/\brun\b|\bmarathon\b/.test(h)) return 'run';
  return 'other';
}

interface Section { header: string; leg: Leg; body: string; }

function splitSections(markdown: string): Section[] {
  const sections: Section[] = [];
  let header = '', leg: Leg = 'other';
  const bodyLines: string[] = [];

  for (const line of markdown.split('\n')) {
    if (/^#{1,4} /.test(line)) {
      if (bodyLines.length) sections.push({ header, leg, body: bodyLines.join('\n') });
      header = line.replace(/^#{1,4} /, '');
      leg = classifySection(header);
      bodyLines.length = 0;
    } else {
      bodyLines.push(line);
    }
  }
  if (bodyLines.length) sections.push({ header, leg, body: bodyLines.join('\n') });
  return sections;
}

// ── g/hr extractor ────────────────────────────────────────────────────────────

function maxGhr(text: string): number {
  const vals = [...text.matchAll(/(\d{1,3})\s*g\/hr/gi)].map(m => parseInt(m[1]));
  return vals.length ? Math.max(...vals) : 0;
}

// ── Serving counter ────────────────────────────────────────────────────────────

function countServings(markdown: string, products: Product[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of products) {
    const escaped = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // "Product Name × N" or "Product Name x N" (case-insensitive multiplier)
    const quantRe = new RegExp(`${escaped}[^\\n]{0,30}[×x](?: *)(\\d+)`, 'gi');
    const quantMatches = [...markdown.matchAll(quantRe)];
    if (quantMatches.length > 0) {
      counts.set(p.name, quantMatches.reduce((sum, m) => sum + (parseInt(m[1]) || 1), 0));
    } else {
      // No explicit "× N" — count mentions as 1 serving each
      const mentions = [...markdown.matchAll(new RegExp(escaped, 'gi'))].length;
      if (mentions > 0) counts.set(p.name, mentions);
    }
  }
  return counts;
}

// ── Main validator ─────────────────────────────────────────────────────────────

export async function validateProtocol(
  markdown: string,
  _profile: AthleteProfile,
  labDir: string,
): Promise<ValidatorResult> {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const csv = await Bun.file(join(labDir, 'products.csv')).text();
  const products = parseProductsCsv(csv);

  const sections = splitSections(markdown);

  // Track highest g/hr per leg
  let bikeGhr = 0;
  let runGhr = 0;

  for (const s of sections) {
    const top = maxGhr(s.body);
    if (!top) continue;

    // Check 1: Absolute ceiling
    if (top > CARB_CEILING) {
      reasons.push(`g/hr ceiling exceeded in "${s.header}": ${top}g/hr > ${CARB_CEILING}g/hr max`);
    }

    if (s.leg === 'bike' && top > bikeGhr) bikeGhr = top;
    if (s.leg === 'run' && top > runGhr) runGhr = top;

    // Check 2: Caffeinated gel never on bike
    if (s.leg === 'bike' && /CAF[\s-]?100|caffeinated\s+gel/i.test(s.body)) {
      reasons.push(`CAF 100 found in bike section "${s.header}" — caffeinated gel is run-only`);
    }
  }

  // Run vs bike: the Auditor handles nuanced bracket-aware run/bike ratio checking.
  // Validator only flags if run significantly exceeds bike (>90% of bike — clear hallucination).
  if (bikeGhr > 0 && runGhr > 0 && runGhr > bikeGhr * 0.90) {
    reasons.push(`Run:Bike ratio anomaly — ${runGhr}g/hr run > ${bikeGhr}g/hr bike × 0.90 (likely hallucination; run should be ~65% of bike)`);
  }

  // Check 5: Competitor brands (not in our 7-SKU list)
  const competitorBrands = [/\bClif\b/i, /\bGU\b/i, /\bHammer\b/i, /\bGatorade\b/i, /\bPowerBar\b/i, /\bSkratch\b/i, /\bNuun\b/i, /\bHuma\b/i];
  for (const re of competitorBrands) {
    const m = markdown.match(re);
    if (m) warnings.push(`Competitor brand detected: "${m[0]}" — only approved 7-SKU products permitted`);
  }

  // Build supply list
  const servingCounts = countServings(markdown, products);
  const supplyList: SupplyItem[] = [];
  for (const [name, servings] of servingCounts) {
    const p = products.find(pr => pr.name === name);
    if (!p) continue;
    const unitsToOrder = Math.ceil(servings / p.servingsPerUnit);
    supplyList.push({
      productName: p.name,
      servingsNeeded: servings,
      unitsToOrder,
      unitDescription: p.purchaseUnitDesc,
      estimatedCostUsd: Math.round(unitsToOrder * p.pricePerUnit * 100) / 100,
    });
  }

  return { outcome: reasons.length === 0 ? 'PASS' : 'FAIL', reasons, warnings, supplyList };
}
