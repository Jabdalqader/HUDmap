import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focalForFov, projectGround, relativeTo } from '../js/core/ar.js';
import { createBiosigns } from '../js/core/biosigns.js';
import { EARTH_RADIUS_M, fromOffset } from '../js/core/geo.js';
import { lightMinutes } from '../js/core/light-time.js';
import { curiositySol, formatHours, localSolarHours } from '../js/core/mars-time.js';

const near = (actual, expected, tolerance) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
const GALE_LON = 137.38;

test('Curiosity sol numbers match the real mission dates', () => {
  assert.equal(curiositySol(Date.parse('2012-08-06T12:00:00Z'), GALE_LON), 0);
  assert.equal(curiositySol(Date.parse('2025-07-11T12:00:00Z'), GALE_LON), 4596);
  assert.equal(curiositySol(Date.parse('2025-08-24T12:00:00Z'), GALE_LON), 4639);
  assert.equal(curiositySol(Date.parse('2025-09-19T12:00:00Z'), GALE_LON), 4664);
});

test('Mars local time falls about 38.5 Mars-clock minutes behind each Earth day', () => {
  const day1 = localSolarHours(Date.parse('2026-11-09T00:00:00Z'), GALE_LON);
  const day2 = localSolarHours(Date.parse('2026-11-10T00:00:00Z'), GALE_LON);
  const shift = (((day1 - day2) % 24) + 24) % 24;
  near(shift * 60, 38.5, 0.2); // a sol is 24 h 39.6 min of Earth time
  assert.equal(formatHours(13.5), '13:30');
});

test('Earth-Mars light time matches JPL Horizons within 3%', () => {
  const horizons = [
    ['2025-01-16', 5.35254888],
    ['2025-08-24', 18.54728839],
    ['2026-01-09', 19.9923372],
    ['2026-11-09', 11.36516322],
    ['2027-02-19', 5.63902947],
  ];
  for (const [date, minutes] of horizons) near(lightMinutes(Date.parse(`${date}T00:00:00Z`)), minutes, minutes * 0.03);
});

test('heart rate rises with effort and settles back', () => {
  const body = createBiosigns({ smoothing: 1 });
  const rest = body.update({ speedMps: 0 });
  const walking = body.update({ speedMps: 1.2, slopeDeg: 15 });
  assert.ok(walking.heartBpm > rest.heartBpm + 30);
  assert.ok(walking.breathsPerMin > rest.breathsPerMin);
  assert.equal(body.update({ speedMps: 0 }).heartBpm, rest.heartBpm);
});

test('relative position: a point north of a walker facing east is on the left', () => {
  const walker = [0, 0];
  const north = fromOffset(walker, { east: 0, north: 10 }, EARTH_RADIUS_M);
  const rel = relativeTo(walker, 90, north, EARTH_RADIUS_M);
  near(rel.forward, 0, 1e-6);
  near(rel.right, -10, 1e-6);
});

test('ground points get closer to the horizon and smaller with distance', () => {
  const view = { centerX: 500, horizonY: 400, focalPx: focalForFov(1000, 60) };
  const close = projectGround({ forward: 4, right: 0 }, view);
  const far = projectGround({ forward: 20, right: 0 }, view);
  assert.ok(close.y > far.y && far.y > 400);
  assert.ok(close.scale > far.scale);
  assert.equal(projectGround({ forward: -3, right: 0 }, view), null);
  near(projectGround({ forward: 10, right: 10 }, view).x, 500 + view.focalPx, 1e-6);
});
