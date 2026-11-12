import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EARTH_RADIUS_M, bearingDeg, distanceM, fromOffset, offsetM, rotateClockwise, wrap180 } from '../js/core/geo.js';

const near = (actual, expected, tolerance) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

test('one degree of latitude on Earth is about 111.2 km', () => {
  near(distanceM([0, 0], [1, 0], EARTH_RADIUS_M), 111195, 1);
});

test('bearing points north, east, south and west', () => {
  near(bearingDeg([0, 0], [1, 0]), 0, 1e-9);
  near(bearingDeg([0, 0], [0, 1]), 90, 1e-9);
  near(bearingDeg([1, 0], [0, 0]), 180, 1e-9);
  near(bearingDeg([0, 1], [0, 0]), 270, 1e-9);
});

test('offset and fromOffset undo each other', () => {
  const origin = [31.95, 35.91];
  const point = [31.951, 35.912];
  const back = fromOffset(origin, offsetM(origin, point, EARTH_RADIUS_M), EARTH_RADIUS_M);
  near(back[0], point[0], 1e-9);
  near(back[1], point[1], 1e-9);
});

test('turning north 90 degrees clockwise gives east', () => {
  const turned = rotateClockwise({ east: 0, north: 10 }, 90);
  near(turned.east, 10, 1e-9);
  near(turned.north, 0, 1e-9);
});

test('wrap180 keeps angles between -180 and 180', () => {
  assert.equal(wrap180(190), -170);
  assert.equal(wrap180(-190), 170);
});
