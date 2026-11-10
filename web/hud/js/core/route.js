import { distanceM } from './geo.js';

/** Steepest slope in the next lookAheadM metres of route, starting from the route point nearest to position. */
export function slopeAhead(route, position, r, lookAheadM = 30) {
  if (!route.length) return 0;
  let nearest = 0;
  let best = Infinity;
  route.forEach((p, i) => {
    const d = distanceM(position, p.at, r);
    if (d < best) {
      best = d;
      nearest = i;
    }
  });
  let steepest = route[nearest].slope_deg || 0;
  let walked = 0;
  for (let i = nearest + 1; i < route.length; i++) {
    walked += distanceM(route[i - 1].at, route[i].at, r);
    if (walked > lookAheadM) break;
    steepest = Math.max(steepest, route[i].slope_deg || 0);
  }
  return steepest;
}
