export const EARTH_RADIUS_M = 6371000;
export const MARS_RADIUS_M = 3396190;

const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export const wrap360 = (a) => ((a % 360) + 360) % 360;
export const wrap180 = (a) => wrap360(a + 180) - 180;

/** Great-circle distance in metres between [lat, lon] points on a sphere of radius r. */
export function distanceM(a, b, r) {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees clockwise from north. */
export function bearingDeg(a, b) {
  const la1 = rad(a[0]);
  const la2 = rad(b[0]);
  const dLon = rad(b[1] - a[1]);
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return wrap360(deg(Math.atan2(y, x)));
}

/** Metres east and north of origin (flat approximation, fine for a few km). */
export function offsetM(origin, point, r) {
  return {
    east: r * Math.cos(rad(origin[0])) * rad(point[1] - origin[1]),
    north: r * rad(point[0] - origin[0]),
  };
}

export function fromOffset(origin, { east, north }, r) {
  return [origin[0] + deg(north / r), origin[1] + deg(east / (r * Math.cos(rad(origin[0]))))];
}

/** Turns an east/north vector clockwise by degrees (compass sense). */
export function rotateClockwise({ east, north }, degrees) {
  const t = rad(degrees);
  return {
    east: east * Math.cos(t) + north * Math.sin(t),
    north: north * Math.cos(t) - east * Math.sin(t),
  };
}
