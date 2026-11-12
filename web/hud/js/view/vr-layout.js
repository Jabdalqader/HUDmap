/**
 * Where each eye is drawn in VR-box view. On big phones the two halves are much larger than the lenses,
 * so each eye gets a smaller window centred under its lens; the rest is black.
 *   size    = eye width as a share of the screen width   (?eyesize=0.40, or the demo panel)
 *   spacing = distance between the two eye centres as a share of the screen width (?eyespacing=0.44)
 * Settings are saved on the phone.
 */
const KEY = 'marswalk.vr';
const params = new URLSearchParams(globalThis.location?.search ?? '');
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } })();

export const vrSettings = {
  size: Number(params.get('eyesize') ?? saved.size ?? 0.40),
  spacing: Number(params.get('eyespacing') ?? saved.spacing ?? 0.44),
};

export function saveVrSettings() {
  vrSettings.size = Math.min(0.5, Math.max(0.2, vrSettings.size));
  vrSettings.spacing = Math.min(0.6, Math.max(0.25, vrSettings.spacing));
  try { localStorage.setItem(KEY, JSON.stringify(vrSettings)); } catch { /* private mode */ }
}

/** Eye rectangles in pixels for a W×H screen: VR = two lens-sized windows; hand-held = the whole screen. */
export function eyeRects(W, H, view) {
  if (view !== 'vr') return [{ x: 0, y: 0, w: W, h: H }];
  const w = Math.min(W / 2, W * vrSettings.size);
  const h = Math.min(H, w * 1.15);
  const y = (H - h) / 2;
  const c = W * vrSettings.spacing / 2;
  return [
    { x: Math.round(W / 2 - c - w / 2), y: Math.round(y), w: Math.round(w), h: Math.round(h) },
    { x: Math.round(W / 2 + c - w / 2), y: Math.round(y), w: Math.round(w), h: Math.round(h) },
  ];
}
