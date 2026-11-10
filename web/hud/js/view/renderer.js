import { drawBackground, drawHud } from './draw-hud.js';

/** Draws the background + HUD once (hand-held) or twice side by side (VR box) every frame. */
export function createRenderer({ canvas, getFrame, view = 'vr', maxPixelRatio = 1.5, win = window }) {
  const ctx = canvas.getContext('2d');
  const images = new Map();
  let running = false;
  let currentView = view;

  function photo(url) {
    if (url && !images.has(url)) {
      const img = new Image();
      img.src = url;
      images.set(url, img);
    }
  }

  function resize() {
    const ratio = Math.min(win.devicePixelRatio || 1, maxPixelRatio);
    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(canvas.clientHeight * ratio);
  }

  function frame() {
    if (!running) return;
    if (canvas.width !== Math.round(canvas.clientWidth * Math.min(win.devicePixelRatio || 1, maxPixelRatio))) resize();
    const { background, hud } = getFrame();
    hud.view = currentView;
    if (hud.card) photo(hud.card.photo);
    const eyes = currentView === 'vr' ? 2 : 1;
    const eyeW = canvas.width / eyes;
    for (let i = 0; i < eyes; i++) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(i * eyeW, 0, eyeW, canvas.height);
      ctx.clip();
      ctx.translate(i * eyeW, 0);
      drawBackground(ctx, eyeW, canvas.height, background);
      drawHud(ctx, eyeW, canvas.height, hud, images);
      ctx.restore();
    }
    if (eyes === 2) {
      ctx.fillStyle = '#000';
      ctx.fillRect(eyeW - 1, 0, 2, canvas.height);
    }
    win.requestAnimationFrame(frame);
  }

  return {
    start() {
      running = true;
      resize();
      win.addEventListener('resize', resize);
      win.requestAnimationFrame(frame);
    },
    stop() {
      running = false;
    },
    setView(next) {
      currentView = next;
    },
    get view() {
      return currentView;
    },
  };
}
