import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraHeading, smoothHeading } from '../js/core/compass.js';
import { buildStatus } from '../js/core/status.js';

const near = (actual, expected, tolerance) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

test('upright phone: camera heading follows the compass', () => {
  near(cameraHeading(0, 90, 0), 0, 1e-6); // portrait, camera facing north
  near(cameraHeading(90, 90, 0), 270, 1e-6); // turned 90 degrees left
});

test('landscape phone in the VR box: camera heading still right', () => {
  near(cameraHeading(0, 0, -90), 90, 1e-6);
  near(cameraHeading(90, 0, -90), 0, 1e-6);
});

test('camera pointing at the ground gives no heading', () => {
  assert.equal(cameraHeading(0, 0, 0), null);
  assert.equal(cameraHeading(null, 90, 0), null);
});

test('smoothing crosses 0/360 the short way', () => {
  near(smoothHeading(350, 10, 0.5), 0, 1e-9);
  assert.equal(smoothHeading(null, 42), 42);
});

test('status has the fields the voice agent expects, in Mars metres', () => {
  const status = buildStatus({
    nav: { target: { id: 2, name: 'Ridge top' }, distanceM: 40.4, baseDistanceM: 200 },
    stopCount: 5,
    marsPerFrameMetre: 2,
    o2Pct: 81.27,
    o2MinutesLeft: 325.1,
    mustReturn: false,
    conditions: { rad_uSv_h: 27.9, temp_c: -48 },
  });
  assert.deepEqual(status, {
    stop: 2, stop_name: 'Ridge top', dist_next_m: 81, dist_base_m: 400, o2_pct: 81.3,
    o2_minutes_left: 325, must_return: false, rad_uSv_h: 27.9, temp_c: -48,
  });
});
