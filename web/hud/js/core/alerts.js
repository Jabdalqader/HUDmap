export const LIMITS = { slopeDeg: 12, lowO2Pct: 30, reserveMinutes: 10 };

/** Return-to-base stays on once triggered (alreadyReturning), so the HUD doesn't flicker. */
export function evaluateAlerts({ slopeAheadDeg, o2Pct, o2MinutesLeft, walkBackMinutes, alreadyReturning }, limits = LIMITS) {
  const mustReturn = alreadyReturning || o2MinutesLeft < walkBackMinutes + limits.reserveMinutes;
  const alerts = [];
  if (mustReturn) alerts.push('RETURN_TO_BASE');
  if (o2Pct < limits.lowO2Pct) alerts.push('LOW_O2');
  if (slopeAheadDeg > limits.slopeDeg) alerts.push('SLOPE_AHEAD');
  return { alerts, mustReturn };
}
