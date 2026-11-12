import { bearingDeg, distanceM } from './geo.js';

/**
 * Walks the stops in order. Positions are in one frame (desert or Mars) with sphere radius r.
 * A stop counts as reached after staying within arrivalM for dwellMs.
 */
export function createNavigator({ stops, base, r, arrivalM = 20, dwellMs = 3000 }) {
  let next = 0;
  let insideSince = null;
  let homeward = false;

  function target() {
    return homeward || next >= stops.length ? { ...base, isBase: true } : stops[next];
  }

  return {
    goHome() {
      homeward = true;
      insideSince = null;
    },
    get nextIndex() {
      return next;
    },
    update(position, nowMs) {
      const goal = target();
      const dist = distanceM(position, goal.at, r);
      let arrived = null;
      if (!goal.isBase && dist <= arrivalM) {
        insideSince ??= nowMs;
        if (nowMs - insideSince >= dwellMs) {
          arrived = goal;
          next += 1;
          insideSince = null;
        }
      } else {
        insideSince = null;
      }
      const now = target();
      return {
        target: now,
        distanceM: distanceM(position, now.at, r),
        bearingDeg: bearingDeg(position, now.at),
        baseDistanceM: distanceM(position, base.at, r),
        arrived,
        done: next >= stops.length,
      };
    },
  };
}

/** Arrow angle on screen: where to turn, degrees clockwise from straight ahead. */
export const arrowAngle = (bearing, heading) => ((bearing - heading + 540) % 360) - 180;

export const etaMinutes = (distance, walkSpeedMps) => distance / walkSpeedMps / 60;
