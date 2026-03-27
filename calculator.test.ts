import { expect, test, describe } from "bun:test";

// ── Calculator logic extracted for testing ──────────────────────────────────
// Source: Pfeiffer et al. 2012, Jeukendrup et al. 2000, de Oliveira et al. 2014
//
// GI distress penalty:
//   70.3:  moderate GI → 5–10 min | severe → 10–22 min
//   140.6: moderate GI → 10–20 min | severe → 20–45 min
//
// Carb deficit penalty (based on r=−0.55 correlation, Pfeiffer 2012):
//   Typical under-fueling (40–60g/hr vs optimal 70–90g/hr) =
//   70.3: 5–12 min | 140.6: 12–25 min
//
// getMinutesRange returns [min, max] total estimated minutes lost

type Distance = "70.3" | "140.6";
type GIFlag = "yes" | "no";

function getMinutesRange(
  distance: Distance,
  hasGIIssues: GIFlag
): [number, number] {
  const isFullIron = distance === "140.6";

  // Base carb-deficit penalty (applies to all athletes by default)
  const carbMin = isFullIron ? 12 : 5;
  const carbMax = isFullIron ? 25 : 12;

  // GI distress penalty (moderate scenario)
  const giMin = hasGIIssues === "yes" ? (isFullIron ? 10 : 5) : 0;
  const giMax = hasGIIssues === "yes" ? (isFullIron ? 20 : 10) : 0;

  return [carbMin + giMin, carbMax + giMax];
}

// ── Race date validation logic (mirrors /api/create-sign-request.js) ─────────
// Returns days between today (UTC) and the given YYYY-MM-DD race date.
// Valid range: 28–56 days (4–8 weeks out).

function validateRaceDays(raceDateStr: string, todayStr: string): number {
  const raceDate = new Date(raceDateStr + 'T00:00:00Z');
  const todayDate = new Date(todayStr + 'T00:00:00Z');
  const diffMs = raceDate.getTime() - todayDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("validateRaceDays — race gate boundary conditions", () => {
  test("exactly 28 days out: valid (lower boundary)", () => {
    const days = validateRaceDays("2026-04-24", "2026-03-27");
    expect(days).toBe(28);
    expect(days).toBeGreaterThanOrEqual(28);
    expect(days).toBeLessThanOrEqual(56);
  });

  test("exactly 56 days out: valid (upper boundary)", () => {
    const days = validateRaceDays("2026-05-22", "2026-03-27");
    expect(days).toBe(56);
    expect(days).toBeGreaterThanOrEqual(28);
    expect(days).toBeLessThanOrEqual(56);
  });

  test("27 days out: too soon (below lower boundary)", () => {
    const days = validateRaceDays("2026-04-23", "2026-03-27");
    expect(days).toBe(27);
    expect(days).toBeLessThan(28);
  });

  test("57 days out: too far (above upper boundary)", () => {
    const days = validateRaceDays("2026-05-23", "2026-03-27");
    expect(days).toBe(57);
    expect(days).toBeGreaterThan(56);
  });

  test("race date is today: 0 days, rejected", () => {
    const days = validateRaceDays("2026-03-27", "2026-03-27");
    expect(days).toBe(0);
    expect(days).toBeLessThan(28);
  });

  test("race date in the past: negative, rejected", () => {
    const days = validateRaceDays("2026-03-20", "2026-03-27");
    expect(days).toBeLessThan(0);
  });

  test("29 days out: valid (inside window)", () => {
    const days = validateRaceDays("2026-04-25", "2026-03-27");
    expect(days).toBe(29);
    expect(days).toBeGreaterThanOrEqual(28);
    expect(days).toBeLessThanOrEqual(56);
  });

  test("55 days out: valid (inside window)", () => {
    const days = validateRaceDays("2026-05-21", "2026-03-27");
    expect(days).toBe(55);
    expect(days).toBeGreaterThanOrEqual(28);
    expect(days).toBeLessThanOrEqual(56);
  });
});

describe("getMinutesRange — calculator output logic", () => {
  test("70.3 with GI issues: range is 10–22 min", () => {
    const [min, max] = getMinutesRange("70.3", "yes");
    expect(min).toBeGreaterThanOrEqual(10);
    expect(max).toBeLessThanOrEqual(22);
    expect(min).toBeLessThan(max);
  });

  test("70.3 without GI issues: range is 5–12 min", () => {
    const [min, max] = getMinutesRange("70.3", "no");
    expect(min).toBeGreaterThanOrEqual(5);
    expect(max).toBeLessThanOrEqual(12);
    expect(min).toBeLessThan(max);
  });

  test("140.6 with GI issues: range is 22–45 min", () => {
    const [min, max] = getMinutesRange("140.6", "yes");
    expect(min).toBeGreaterThanOrEqual(22);
    expect(max).toBeLessThanOrEqual(45);
    expect(min).toBeLessThan(max);
  });

  test("140.6 without GI issues: range is 12–25 min", () => {
    const [min, max] = getMinutesRange("140.6", "no");
    expect(min).toBeGreaterThanOrEqual(12);
    expect(max).toBeLessThanOrEqual(25);
    expect(min).toBeLessThan(max);
  });
});
