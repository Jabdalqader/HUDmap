// Test only (?fakegps=1): pretends to be a phone walking outdoors, so Mars walk can be tried at a desk.
// Walks from a start point towards the first stop at 1.2 m/s, with ±4 m GPS noise. ?lat=&lon= sets the start.
export function installFakeGps({ lat = 31.95, lon = 35.91, headingDeg = 194, speed = 1.2 } = {}) {
  const R = 6371000, t0 = Date.now();
  const at = () => {
    const d = ((Date.now() - t0) / 1000) * speed, h = (headingDeg * Math.PI) / 180;
    const n = Math.cos(h) * d + (Math.random() - 0.5) * 4, e = Math.sin(h) * d + (Math.random() - 0.5) * 4;
    return { latitude: lat + (n / R) * 180 / Math.PI, longitude: lon + (e / (R * Math.cos((lat * Math.PI) / 180))) * 180 / Math.PI };
  };
  const watchers = new Map();
  let id = 0;
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    watchPosition(ok) {
      const tick = () => ok({ coords: { ...at(), accuracy: 6, heading: headingDeg, speed }, timestamp: Date.now() });
      watchers.set(++id, setInterval(tick, 1000)); tick();
      return id;
    },
    clearWatch(i) { clearInterval(watchers.get(i)); watchers.delete(i); },
    getCurrentPosition(ok) { ok({ coords: { ...at(), accuracy: 6, heading: headingDeg, speed }, timestamp: Date.now() }); },
  } });
}
