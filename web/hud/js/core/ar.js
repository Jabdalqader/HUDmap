import { offsetM } from './geo.js';

const rad = (d) => (d * Math.PI) / 180;

/** A point's position relative to the walker: metres forward and to the right, given the walker's heading. */
export function relativeTo(walker, headingDeg, point, r) {
  const { east, north } = offsetM(walker, point, r);
  const h = rad(headingDeg);
  return { forward: east * Math.sin(h) + north * Math.cos(h), right: east * Math.cos(h) - north * Math.sin(h) };
}

/**
 * Where a spot on the ground appears in the camera view (camera level, eyeHeightM above the ground).
 * Returns null if it is behind the walker or too close to see.
 */
export function projectGround({ forward, right }, { centerX, horizonY, focalPx, eyeHeightM = 1.6, nearM = 1.5 }) {
  if (forward < nearM) return null;
  return { x: centerX + (focalPx * right) / forward, y: horizonY + (focalPx * eyeHeightM) / forward, scale: focalPx / forward };
}

export const focalForFov = (widthPx, fovDeg) => widthPx / 2 / Math.tan(rad(fovDeg) / 2);
