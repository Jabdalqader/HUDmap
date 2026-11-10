import { MARS_RADIUS_M, bearingDeg, distanceM } from '../js/core/geo.js';

const PROFILE = Array.from({ length: 360 }, (_, i) =>
  0.5 + 0.28 * Math.sin(i / 9) + 0.14 * Math.sin(i / 3.1 + 1.3) + 0.08 * Math.sin(i * 1.7));

/** Stand-in for T1.3: walks Curiosity's route at walking speed and paints a simple Mars view. */
export function createFakeSim({ mission, doc = document, clock = () => performance.now(), speedFactor = 1 }) {
  const points = mission.route.map((p) => (Array.isArray(p) ? p : p.mars));
  const speed = (mission.suit?.walk_speed_mps ?? 0.8) * speedFactor;
  const canvas = doc.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');
  let segment = 0;
  let along = 0;
  let lastMs = null;
  let heading = 0;
  let paintedHeading = null;

  function position() {
    const a = points[segment];
    const b = points[Math.min(segment + 1, points.length - 1)];
    const len = distanceM(a, b, MARS_RADIUS_M) || 1;
    const f = Math.min(1, along / len);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }

  function advance(nowMs) {
    if (lastMs == null) lastMs = nowMs;
    let step = (speed * (nowMs - lastMs)) / 1000;
    lastMs = nowMs;
    while (step > 0 && segment < points.length - 1) {
      const len = distanceM(points[segment], points[segment + 1], MARS_RADIUS_M);
      if (along + step < len) {
        along += step;
        step = 0;
      } else {
        step -= len - along;
        segment += 1;
        along = 0;
      }
    }
    const next = points[Math.min(segment + 1, points.length - 1)];
    heading = bearingDeg(position(), next) + 4 * Math.sin(nowMs / 1500);
  }

  function paint() {
    if (paintedHeading != null && Math.abs(paintedHeading - heading) < 0.5) return;
    paintedHeading = heading;
    const { width: w, height: h } = canvas;
    const horizon = h * 0.52;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#6e4a38');
    sky.addColorStop(1, '#b0805e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon);
    ctx.fillStyle = '#7a4630';
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let x = 0; x <= w; x += 4) {
      const angle = Math.round(heading - 45 + (x / w) * 90 + 720) % 360;
      ctx.lineTo(x, horizon - PROFILE[angle] * h * 0.12);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    const ground = ctx.createLinearGradient(0, horizon, 0, h);
    ground.addColorStop(0, 'rgba(120, 66, 42, 0.0)');
    ground.addColorStop(1, 'rgba(70, 36, 22, 0.85)');
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, w, h - horizon);
  }

  return {
    getPosition() {
      advance(clock());
      const [lat, lon] = position();
      return { lat, lon, heading };
    },
    getBackground() {
      paint();
      return canvas;
    },
    /** Demo: put the walker 6 m before stop number index (0-based). */
    jumpToStop(index) {
      const stop = mission.stops[Math.min(index, mission.stops.length - 1)];
      let best = 0;
      points.forEach((p, i) => {
        if (distanceM(p, stop.mars, MARS_RADIUS_M) < distanceM(points[best], stop.mars, MARS_RADIUS_M)) best = i;
      });
      segment = Math.max(0, best - 1);
      const len = distanceM(points[segment], points[best], MARS_RADIUS_M);
      along = Math.max(0, len - 6);
      lastMs = clock();
    },
  };
}
