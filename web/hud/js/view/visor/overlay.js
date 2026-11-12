import { AMBER, AMBER_SOFT, PANEL, RED, brackets, say, wrap } from './style.js';

const ALERTS = {
  RETURN_TO_BASE: ['RETURN TO BASE', RED],
  LOW_O2: ['OXYGEN LOW', RED],
  SLOPE_AHEAD: ['STEEP GROUND AHEAD', '#ffd27a'],
};

export function drawAlerts(ctx, cx, y, u, s) {
  const items = s.alerts.map((a) => ALERTS[a]).filter(Boolean);
  items.forEach(([text, color], i) => {
    const flash = 0.65 + 0.35 * Math.sin(s.timeMs / 180);
    ctx.globalAlpha = flash;
    say(ctx, `▲  ${text}  ▲`, cx, y + i * 3.6 * u, 2.9 * u, { align: 'center', color, weight: 700 });
    ctx.globalAlpha = 1;
  });
  return items.length;
}

export function drawMessage(ctx, cx, y, u, w, text) {
  if (!text) return;
  ctx.font = `600 ${2.5 * u}px Rajdhani, system-ui, sans-serif`;
  const lines = wrap(ctx, text, w * 0.42, 2);
  lines.forEach((line, i) => say(ctx, line, cx, y + i * 3 * u, 2.5 * u, { align: 'center', color: '#ffe2a8' }));
}

/** Next stop readout under the view centre. */
export function drawNextStop(ctx, cx, y, u, s) {
  if (!s.targetName) return;
  const color = s.mustReturn ? RED : AMBER;
  say(ctx, s.mustReturn ? 'HEAD BACK TO' : `NEXT  ${s.stopLabel.toUpperCase()}`, cx, y, 2 * u, { align: 'center', color: AMBER_SOFT, weight: 700 });
  say(ctx, `${s.targetName.toUpperCase()}   ${s.distanceLabel}`, cx, y + 3.4 * u, 3.4 * u, { align: 'center', color, weight: 700 });
}

export function drawVoice(ctx, cx, y, u, w, s) {
  if (s.listening) {
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(cx, y - 4 * u, 0.9 * u, 0, Math.PI * 2);
    ctx.fill();
    say(ctx, 'LISTENING', cx + 1.8 * u, y - 4 * u, 1.9 * u, { color: AMBER_SOFT });
  }
  if (!s.aiText) return;
  ctx.font = `600 ${2.4 * u}px Rajdhani, system-ui, sans-serif`;
  const lines = wrap(ctx, s.aiText, w * 0.46, 2);
  const boxW = w * 0.5;
  const boxH = lines.length * 3 * u + 2 * u;
  ctx.fillStyle = PANEL;
  ctx.fillRect(cx - boxW / 2, y - boxH / 2, boxW, boxH);
  brackets(ctx, cx - boxW / 2, y - boxH / 2, boxW, boxH, 1.4 * u);
  lines.forEach((line, i) => say(ctx, line, cx, y - boxH / 2 + 2.5 * u + i * 3 * u, 2.4 * u, { align: 'center' }));
}

export function drawWaiting(ctx, cx, cy, u, text) {
  say(ctx, text, cx, cy, 3 * u, { align: 'center', weight: 700 });
}
