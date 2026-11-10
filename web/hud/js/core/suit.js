/** Pretend oxygen tank and battery. speed > 1 makes them drain faster for demos. */
export function createSuit({ o2StartPct = 100, o2PctPerMin = 0.25, powerPctPerMin = 0.2, startMs = 0 }) {
  let o2 = o2StartPct;
  let power = 100;
  let lastMs = startMs;
  let speed = 1;

  return {
    update(nowMs) {
      const minutes = (nowMs - lastMs) / 60000;
      lastMs = nowMs;
      o2 = Math.max(0, o2 - o2PctPerMin * speed * minutes);
      power = Math.max(0, power - powerPctPerMin * speed * minutes);
      return o2;
    },
    get o2Pct() {
      return o2;
    },
    get powerPct() {
      return power;
    },
    get minutesLeft() {
      return o2 / (o2PctPerMin * speed);
    },
    setSpeed(value) {
      speed = value;
    },
    setO2(pct) {
      o2 = pct;
    },
  };
}
