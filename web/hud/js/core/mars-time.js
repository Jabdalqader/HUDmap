// Mars Sol Date and local time (Allison & McEwen 2000, as used by NASA's Mars24).
const TT_MINUS_UTC_S = 69.184;
const CURIOSITY_SOL_OFFSET = 49269; // checked against sols 0, 4596, 4639 and 4664

export function marsSolDate(unixMs) {
  const jdTt = unixMs / 86400000 + 2440587.5 + TT_MINUS_UTC_S / 86400;
  return (jdTt - 2405522.0028779) / 1.0274912517;
}

/** Local mean solar time in hours, for an east-positive longitude. */
export function localSolarHours(unixMs, lonEast) {
  const mtc = (24 * marsSolDate(unixMs)) % 24;
  return (((mtc + lonEast / 15) % 24) + 24) % 24;
}

export function curiositySol(unixMs, lonEast) {
  return Math.floor(marsSolDate(unixMs) + lonEast / 360) - CURIOSITY_SOL_OFFSET;
}

export function formatHours(hours) {
  const total = Math.floor(hours * 60);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}
