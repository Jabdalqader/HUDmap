export const AMBER = '#ffb547';
export const AMBER_SOFT = 'rgba(255, 181, 71, 0.62)';
export const AMBER_FAINT = 'rgba(255, 181, 71, 0.22)';
export const RED = '#ff5a3c';
export const PANEL = 'rgba(24, 12, 4, 0.42)';
export const FONT = "'Rajdhani', 'Saira Condensed', 'Arial Narrow', system-ui, sans-serif";

export function say(ctx, text, x, y, size, { color = AMBER, weight = 600, align = 'left', baseline = 'middle', blur } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = 'rgba(18, 7, 0, 0.6)';
  ctx.strokeText(text, x, y);
  ctx.shadowColor = color;
  ctx.shadowBlur = blur ?? size * 0.45;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

/** Thin L-shaped corners around a box, the HUD's main framing device. */
export function brackets(ctx, x, y, w, h, len, color = AMBER_SOFT, lineWidth = 1.5) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    ctx.moveTo(cx + dx * len, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * len);
  }
  ctx.stroke();
}

/** Segmented bar, like the suit gauges. */
export function bar(ctx, x, y, w, h, fraction, { segments = 22, color = AMBER } = {}) {
  const gap = Math.max(1, w / segments / 5);
  const sw = (w - gap * (segments - 1)) / segments;
  const lit = Math.round(Math.max(0, Math.min(1, fraction)) * segments);
  for (let i = 0; i < segments; i++) {
    ctx.fillStyle = i < lit ? color : AMBER_FAINT;
    ctx.shadowColor = color;
    ctx.shadowBlur = i < lit ? h : 0;
    ctx.fillRect(x + i * (sw + gap), y, sw, h);
  }
  ctx.shadowBlur = 0;
}

export function wrap(ctx, text, maxWidth, maxLines) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) return lines;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}
