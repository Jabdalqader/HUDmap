/** Stand-in for T1.5 live.js: keeps the last telemetry and photo, and lets the demo panel send messages. */
export function createFakeLive({ log = console } = {}) {
  const listeners = [];
  const live = {
    lastTelemetry: null,
    lastPhoto: null,
    sendTelemetry(telemetry) {
      live.lastTelemetry = telemetry;
    },
    sendPhoto(blob) {
      live.lastPhoto = blob;
      log.debug?.(`[fake live] photo ${blob?.size ?? 0} bytes`);
    },
    onMessage(callback) {
      listeners.push(callback);
    },
    pushMessage(text) {
      listeners.forEach((cb) => cb({ text }));
    },
  };
  return live;
}
