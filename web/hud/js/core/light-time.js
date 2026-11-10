// One-way Earth–Mars light time from JPL's approximate planet elements (valid 1800–2050).
const ELEMENTS = {
  earth: { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], i: [-0.00001531, -0.01294668],
    L: [100.46457166, 35999.37244981], peri: [102.93768193, 0.32327364], node: [0, 0] },
  mars: { a: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882], i: [1.84969142, -0.00813131],
    L: [-4.55343205, 19140.30268499], peri: [-23.94362959, 0.44441088], node: [49.55953891, -0.29257343] },
};
const LIGHT_MINUTES_PER_AU = 149597870.7 / 299792.458 / 60;
const rad = (d) => (d * Math.PI) / 180;

function position(el, T) {
  const at = ([base, rate]) => base + rate * T;
  const a = at(el.a);
  const e = at(el.e);
  const inc = rad(at(el.i));
  const node = rad(at(el.node));
  const argPeri = rad(at(el.peri)) - node;
  let M = rad(((at(el.L) - at(el.peri)) % 360 + 540) % 360 - 180);
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const [cw, sw, cn, sn, ci, si] = [Math.cos(argPeri), Math.sin(argPeri), Math.cos(node), Math.sin(node), Math.cos(inc), Math.sin(inc)];
  return [
    (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp,
    (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp,
    sw * si * xp + cw * si * yp,
  ];
}

export function earthMarsAu(unixMs) {
  const T = (unixMs / 86400000 + 2440587.5 - 2451545) / 36525;
  const earth = position(ELEMENTS.earth, T);
  const mars = position(ELEMENTS.mars, T);
  return Math.hypot(mars[0] - earth[0], mars[1] - earth[1], mars[2] - earth[2]);
}

export const lightMinutes = (unixMs) => earthMarsAu(unixMs) * LIGHT_MINUTES_PER_AU;
