import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EARTH_RADIUS_M, MARS_RADIUS_M, bearingDeg, fromOffset } from '../js/core/geo.js';
import { arrowAngle, createNavigator, etaMinutes } from '../js/core/nav.js';
import { createTwin } from '../js/core/twin.js';

const near = (actual, expected, tolerance) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

const BASE = [0, 0];
const at = (east, north) => fromOffset(BASE, { east, north }, EARTH_RADIUS_M);
const stops = [
  { id: 1, name: 'One', at: at(0, 100) },
  { id: 2, name: 'Two', at: at(100, 100) },
];
const navigator = () => createNavigator({ stops, base: { at: BASE }, r: EARTH_RADIUS_M });

test('a stop is reached only after 3 seconds inside 20 m', () => {
  const nav = navigator();
  assert.equal(nav.update(at(0, 90), 0).arrived, null);
  assert.equal(nav.update(at(0, 90), 2900).arrived, null);
  assert.equal(nav.update(at(0, 90), 3000).arrived.name, 'One');
  assert.equal(nav.nextIndex, 1);
});

test('stepping out of the circle restarts the 3 seconds', () => {
  const nav = navigator();
  nav.update(at(0, 90), 0);
  nav.update(at(0, 50), 2000);
  assert.equal(nav.update(at(0, 90), 4000).arrived, null);
  assert.equal(nav.update(at(0, 90), 7000).arrived.name, 'One');
});

test('after the last stop, and after goHome, the target is base', () => {
  const nav = navigator();
  nav.update(at(0, 100), 0);
  nav.update(at(0, 100), 3000);
  nav.update(at(100, 100), 4000);
  const last = nav.update(at(100, 100), 7000);
  assert.ok(last.done && last.target.isBase);

  const early = navigator();
  early.goHome();
  assert.ok(early.update(at(0, 10), 0).target.isBase);
});

test('arrow angle is the turn needed, across the 0/360 seam', () => {
  assert.equal(arrowAngle(10, 350), 20);
  assert.equal(arrowAngle(350, 10), -20);
  assert.equal(arrowAngle(180, 0), -180);
});

test('ETA at 0.8 m/s', () => {
  near(etaMinutes(48, 0.8), 1, 1e-9);
});

test('with a rotated twin map, the arrow is right when navigating in the desert frame', () => {
  const marsBase = [-4.8, 137.38];
  const marsStopSouth = [-4.801, 137.38];
  const twin = createTwin({ mars: marsBase, field: [31.95, 35.91], rotation_deg: 90, scale: 1 });
  const nav = createNavigator({
    stops: [{ id: 1, name: 'South on Mars', at: twin.marsToField(marsStopSouth) }],
    base: { at: twin.marsToField(marsBase) },
    r: EARTH_RADIUS_M,
  });
  const facingWest = 270; // Mars south turned 90 degrees clockwise lands west in the desert
  const step = nav.update(twin.marsToField(marsBase), 0);
  near(arrowAngle(step.bearingDeg, facingWest), 0, 0.1);

  const marsBearing = bearingDeg(marsBase, marsStopSouth);
  assert.ok(Math.abs(arrowAngle(marsBearing, facingWest)) > 80, 'the Mars-frame bearing would point the wrong way');
  near(MARS_RADIUS_M, 3396190, 0);
});
