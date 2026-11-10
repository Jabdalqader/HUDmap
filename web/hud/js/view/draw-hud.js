import { drawVisorHud } from './visor/visor.js';

/** Background fills the eye, cropped to keep its aspect. */
export function drawBackground(ctx, w, h, source) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  if (!source) return;
  const sw = source.videoWidth || source.width;
  const sh = source.videoHeight || source.height;
  if (!sw || !sh) return;
  const scale = Math.max(w / sw, h / sh);
  ctx.drawImage(source, (w - sw * scale) / 2, (h - sh * scale) / 2, sw * scale, sh * scale);
}

export const drawHud = drawVisorHud;
