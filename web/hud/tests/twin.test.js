import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EARTH_RADIUS_M, MARS_RADIUS_M, bearingDeg, distanceM } from '../js/core/geo.js';
import { createTwin } from '../js/core/twin.js';

const near = (actual, expected, tolerance) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

const P1 = [-4.803606, 137.380074]; // Curiosity, sol 4596
const P2 = [-4.806553, 137.379317]; // Curiosity, sol 4639
const DESERT = [31.95, 35.91];

test('the two real stops are about 180 m apart on Mars and in the desert at scale 1', () => {
  const twin = createTwin({ mars: P1, field: DESERT, rotation_deg: 0, scale: 1 });
  const marsDistance = distanceM(P1, P2, MARS_RADIUS_M);
  near(marsDistance, 180, 2);
  near(distanceM(DESERT, twin.marsToField(P2), EARTH_RADIUS_M), marsDistance, 0.5);
});

test('mars -> desert -> mars comes back to the same point with rotation and scale', () => {
  const twin = createTwin({ mars: P1, field: DESERT, rotation_deg: 37, scale: 0.5 });
  const back = twin.fieldToMars(twin.marsToField(P2));
  near(distanceM(back, P2, MARS_RADIUS_M), 0, 0.01);
});

test('rotation turns the walk clockwise and scale shrinks it', () => {
  const south = [P1[0] - 0.001, P1[1]];
  const twin = createTwin({ mars: P1, field: DESERT, rotation_deg: 90, scale: 0.5 });
  const field = twin.marsToField(south);
  near(bearingDeg(DESERT, field), 270, 0.01); // south turned 90 clockwise = west
  near(distanceM(DESERT, field, EARTH_RADIUS_M), distanceM(P1, south, MARS_RADIUS_M) * 0.5, 0.05);
});

test('a missing desert anchor is a clear error', () => {
  assert.throws(() => createTwin({ mars: P1, field: null }), /anchor.field/);
});
