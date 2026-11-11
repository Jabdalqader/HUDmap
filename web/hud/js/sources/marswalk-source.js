/** Mars walk: you walk for real (GPS + compass) and see T1.3's 3D Mars instead of the camera. */
export function createMarsWalkSource(field, sim, mission, view = 'single') {
  return {
    frame: 'field',
    async start() {
      const box = document.createElement('div');
      box.style.cssText = `position:fixed;top:0;left:0;height:100%;width:${view === 'vr' ? '50%' : '100%'};z-index:-1;pointer-events:none`;
      document.body.appendChild(box);
      await sim.start?.(mission, { container: box, assetsBase: '/mission/', stereo: false, autopilot: false, hud: true, hfovDeg: 62, lockPitch: true });
      // GPS + compass start right away; the camera (only used for Ground Control photos) must not block the walk
      field.start().catch((e) => console.warn('[marswalk] camera unavailable:', e?.message ?? e));
    },
    stop() {
      field.stop();
      sim.stop?.();
    },
    getPosition: () => field.getPosition(),
    getBackground: () => sim.getBackground(),
    capturePhoto: (...a) => field.capturePhoto(...a),          // Ground Control still sees the real camera
    get gpsError() { return field.gpsError; },
    world3d: sim,
  };
}
