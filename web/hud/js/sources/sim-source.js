/** Wraps T1.3's sim.js (or the stand-in) so the HUD sees the same shape as the field source, in Mars coordinates. */
export function createSimSource(sim, mission, view = 'single') {
  return {
    frame: 'mars',
    async start() {
      // T1.3's 3D sim renders into its own canvas (behind the HUD); the HUD draws it via getBackground().
      const box = document.createElement('div');
      box.style.cssText = `position:fixed;top:0;left:0;height:100%;width:${view === 'vr' ? '50%' : '100%'};z-index:-1;pointer-events:none`;  // one eye's shape
      document.body.appendChild(box);
      await sim.start?.(mission, { container: box, assetsBase: '/mission/', stereo: false, autopilot: false, hud: true, hfovDeg: 62, lockPitch: true });
      await sim.enableSensors?.();
    },
    stop() {
      sim.stop?.();
    },
    getPosition() {
      const p = sim.getPosition();
      if (!p) return null;
      const at = Array.isArray(p) ? p : p.at ?? [p.lat, p.lon];
      return { at, heading: p.heading ?? 0, accuracy: 0, hasHeading: true };
    },
    getBackground() {
      return sim.getBackground();
    },
    capturePhoto() {
      return Promise.resolve(null);
    },
    sim,
  };
}
