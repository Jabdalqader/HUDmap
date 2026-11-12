/** The shape the voice agent reads through hud.getStatus(). Distances are Mars metres. */
export function buildStatus({ nav, stopCount, marsPerFrameMetre, o2Pct, o2MinutesLeft, mustReturn, conditions }) {
  const round = (n) => (n == null ? null : Math.round(n));
  return {
    stop: nav.target.isBase ? null : Math.min(nav.target.id, stopCount),
    stop_name: nav.target.isBase ? 'Base' : nav.target.name,
    dist_next_m: round(nav.distanceM * marsPerFrameMetre),
    dist_base_m: round(nav.baseDistanceM * marsPerFrameMetre),
    o2_pct: Math.round(o2Pct * 10) / 10,
    o2_minutes_left: round(o2MinutesLeft),
    must_return: mustReturn,
    rad_uSv_h: conditions?.rad_uSv_h ?? null,
    temp_c: conditions?.temp_c ?? null,
  };
}
