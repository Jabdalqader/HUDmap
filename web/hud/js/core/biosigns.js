/**
 * Simulated heart and breathing rates (the suit has no real sensors).
 * They rise with walking speed, steep ground and low oxygen, and change smoothly.
 */
export function createBiosigns({ restHeart = 72, restBreaths = 14, smoothing = 0.08 } = {}) {
  let heart = restHeart;
  let breaths = restBreaths;
  return {
    update({ speedMps = 0, slopeDeg = 0, lowOxygen = false }) {
      const effort = Math.min(speedMps, 2) * 22 + Math.min(slopeDeg, 30) * 0.9 + (lowOxygen ? 14 : 0);
      heart += smoothing * (restHeart + effort - heart);
      breaths += smoothing * (restBreaths + effort * 0.22 - breaths);
      return { heartBpm: Math.round(heart), breathsPerMin: Math.round(breaths) };
    },
  };
}
