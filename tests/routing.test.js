// Unit tests for the deterministic routing engine.
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runEngine, routeToTier, ROUTING_VERSION } from '../lib/routing.js';

function isoDateInWeeks(weeks) {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split('T')[0];
}

test('routing version is exported', () => {
  assert.equal(typeof ROUTING_VERSION, 'string');
  assert.match(ROUTING_VERSION, /^\d+\.\d+\.\d+$/);
});

test('race-week freeze (<2 weeks) → bundle', () => {
  const out = routeToTier({
    weeksOut: 1,
    giHistory: 'rare',
    hasCoach: 'no',
    weeklyHours: '12-16',
    carbDeficit: 30,
    raceDistance: '70.3',
  });
  assert.equal(out.tier, 'bundle');
  assert.equal(out.reason, 'race-week-freeze');
});

test('GI history "often" → premium', () => {
  const out = routeToTier({
    weeksOut: 8,
    giHistory: 'often',
    hasCoach: 'no',
    weeklyHours: '12-16',
    carbDeficit: 20,
    raceDistance: '70.3',
  });
  assert.equal(out.tier, 'premium');
  assert.equal(out.reason, 'gi-flagged');
});

test('coached + 16-20h volume → bundle_pdf', () => {
  const out = routeToTier({
    weeksOut: 10,
    giHistory: 'rare',
    hasCoach: 'yes',
    weeklyHours: '16-20',
    carbDeficit: 30,
    raceDistance: '70.3',
  });
  assert.equal(out.tier, 'bundle_pdf');
});

test('coached + tight window (<6 weeks) → bundle_pdf', () => {
  const out = routeToTier({
    weeksOut: 4,
    giHistory: 'rare',
    hasCoach: 'yes',
    weeklyHours: '12-16',
    carbDeficit: 25,
    raceDistance: '70.3',
  });
  assert.equal(out.tier, 'bundle_pdf');
  assert.equal(out.reason, 'tight-window-coached');
});

test('Sprint sweet spot (6-12 weeks, deficit ≥15) → sprint', () => {
  const out = routeToTier({
    weeksOut: 8,
    giHistory: 'rare',
    hasCoach: 'no',
    weeklyHours: '12-16',
    carbDeficit: 25,
    raceDistance: '70.3',
  });
  assert.equal(out.tier, 'sprint');
  assert.equal(out.reason, 'sweet-spot-deficit');
});

test('long window + low deficit → bundle', () => {
  const out = routeToTier({
    weeksOut: 20,
    giHistory: 'rare',
    hasCoach: 'no',
    weeklyHours: '12-16',
    carbDeficit: 10,
    raceDistance: '70.3',
  });
  assert.equal(out.tier, 'bundle');
  assert.equal(out.reason, 'long-window-low-deficit');
});

test('runEngine produces fully populated output for typical 70.3 athlete', () => {
  const answers = {
    raceDistance: '70.3',
    raceDate: isoDateInWeeks(8),
    targetTime: '5:30',
    weeklyHours: '12-16',
    brands: ['maurten', 'sis'],
    carbsPerHour: '30-45',
    giHistory: 'rare',
    bodyWeight: '170',
    weightUnit: 'lb',
    sweatRate: 'medium',
    hasCoach: 'no',
    firstName: 'Marcus',
    email: 'm@example.com',
    consent: true,
  };
  const out = runEngine(answers);

  assert.ok(out.routing_version);
  assert.ok(out.methodology_version);
  assert.equal(out.inputs_summary.race_distance, '70.3');
  assert.equal(out.inputs_summary.weeks_out, 8);
  assert.ok(out.tier_recommendation.tier);
  assert.ok(out.tier_recommendation.label);
  assert.ok(out.tier_recommendation.explanation);

  // Track A
  assert.ok(out.track_a.race_day_target_g_per_hr > 0);
  assert.ok(out.track_a.sodium_bike_mg_per_hr > 0);
  assert.ok(out.track_a.bike_fluid_ml_per_hr > 0);
  assert.equal(out.track_a.gi_flagged, false);

  // Track B
  assert.ok('athlete_carbs_per_hour_estimate' in out.track_b);
  assert.ok('carb_deficit_g_per_hour' in out.track_b);
  assert.ok('minutes_lost_estimate' in out.track_b);
  assert.ok(out.track_b.minutes_lost_estimate.lo >= 0);
  assert.ok(out.track_b.minutes_lost_estimate.hi >= out.track_b.minutes_lost_estimate.lo);

  // Top actions
  assert.equal(out.top_actions.length, 3);
  assert.ok(out.top_actions.every(a => a.title && a.detail));
});

test('runEngine handles GI-flagged athlete', () => {
  const answers = {
    raceDistance: '70.3',
    raceDate: isoDateInWeeks(8),
    weeklyHours: '12-16',
    brands: ['gu'],
    carbsPerHour: 'under-30',
    giHistory: 'often',
    bodyWeight: '160',
    weightUnit: 'lb',
    sweatRate: 'high',
    hasCoach: 'no',
    firstName: 'Priya',
    email: 'p@example.com',
    consent: true,
  };
  const out = runEngine(answers);
  assert.equal(out.track_a.gi_flagged, true);
  assert.equal(out.tier_recommendation.tier, 'premium');
  // sodium tier should reflect 'high' sweat rate
  assert.equal(out.track_a.sodium_tier, 'SR3');
});

test('runEngine — same input produces same output (determinism)', () => {
  const answers = {
    raceDistance: 'full',
    raceDate: isoDateInWeeks(10),
    weeklyHours: '16-20',
    brands: ['maurten'],
    carbsPerHour: '45-60',
    giHistory: 'rare',
    bodyWeight: '75',
    weightUnit: 'kg',
    sweatRate: 'medium',
    hasCoach: 'yes',
    firstName: 'Test',
    email: 't@example.com',
    consent: true,
  };
  const a = runEngine(answers);
  const b = runEngine(answers);
  // Strip timestamps if any (engine output should be pure)
  assert.deepEqual(a, b);
});
