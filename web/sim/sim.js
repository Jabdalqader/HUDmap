// sim.js — 3D VR simulation: walk on Mars at the Mount Sharp boxwork site.
//
// Real ground: NASA HiRISE satellite photo draped on heights from Curiosity's measurements.
// Walk where you look, reach glowing stop beacons, look at the highlighted rock to scan it.
//
// Page needs an import map for "three", e.g.
//   <script type="importmap">{ "imports": { "three": "../sim/vendor/three.module.min.js" } }</script>
//
// HUD usage:
//   import { sim } from "../sim/sim.js";
//   await sim.start(mission, { container: document.getElementById("world"), assetsBase: "../mission/", stereo: true });
//   await sim.enableSensors();                 // from a tap
//   sim.getPosition() -> { mars: [lat, lon], heading, pitch, stop, nextStop, dist_next_m, walking }
//   sim.on("arrive", ({ stop }) => ...)        // reached a stop beacon
//   sim.on("scan",   ({ stop }) => ...)        // finished scanning that stop's rock
//   sim.event("dust")                          // dust storm for 20 s
//   sim.setAutopilot(true)                     // walk by yourself along the route; just look around
//   sim.setWalking(true/false), sim.setStereo(true/false), sim.stop()
//
// Controls: hold the Bluetooth clicker (Space, Enter, ArrowUp, ArrowRight, PageDown, W) or gamepad A to walk.
// Laptop: hold Space to walk; drag the mouse (or A / D) to look around.

import * as THREE from "three";

const DEG = Math.PI / 180;
const EYE_H = 1.7;                 // astronaut eye height (m)
const ARRIVE_M = 6;                // reach a beacon within this distance
const SCAN_SECONDS = 2;            // look at the rock this long to scan it
const SCAN_RANGE_M = 12;
const WALK_KEYS = new Set([" ", "Enter", "ArrowUp", "ArrowRight", "PageDown", "w", "W"]);
const SKY_TOP = new THREE.Color("#b98a66"), SKY_LOW = new THREE.Color("#e9c8a3");
const FOG = new THREE.Color("#d8b48e"), DUST = new THREE.Color("#b8743f");

const S = {
  listeners: [], handlers: {}, raf: 0,
  heading: 0, pitch: 0, sensorHeading: null, sensorPitch: null,
  walking: false, keyWalking: false, pos: new THREE.Vector3(), bob: 0,
  visited: [], scanned: [], scanT: 0, dustUntil: 0, stereo: true,
  autopilot: false, rIdx: 1, pauseUntil: 0, lastManualLook: -1e9,
};
const PAUSE_AT_STOP_MS = 8000;     // autopilot waits this long at each beacon (time to look and scan)

// ---------- helpers ----------
const wrap360 = (a) => ((a % 360) + 360) % 360;
const angleDiff = (a, b) => ((a - b + 540) % 360) - 180;
function listen(t, type, fn, o) { t.addEventListener(type, fn, o); S.listeners.push(() => t.removeEventListener(type, fn, o)); }
function emit(name, data) { (S.handlers[name] || []).forEach((f) => f(data)); }
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

function makeLabel(text, color = "#7dfcff") {
  const c = document.createElement("canvas"); c.width = 512; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(0,0,0,0.55)"; g.beginPath(); g.roundRect(4, 14, 504, 100, 30); g.fill();
  g.font = "bold 54px system-ui, sans-serif"; g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, 256, 66);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, sizeAttenuation: false }));
  sp.scale.set(0.24, 0.06, 1);
  sp.renderOrder = 10;
  return sp;
}

// tiling "gravel" texture, multiplied on top of the satellite photo for close-up detail
function makeDetailTexture() {
  const N = 512, c = document.createElement("canvas"); c.width = c.height = N;
  const g = c.getContext("2d"), r = rng(5);
  g.fillStyle = "rgb(150,150,150)"; g.fillRect(0, 0, N, N);
  const blob = (x, y, rx, ry, a, v) => {
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {   // wrap so it tiles seamlessly
      g.beginPath(); g.ellipse(x + dx, y + dy, rx, ry, a, 0, Math.PI * 2);
      g.fillStyle = `rgba(${v},${v},${v},0.55)`; g.fill();
    }
  };
  for (let i = 0; i < 9000; i++) blob(r() * N, r() * N, 0.6 + r() * 1.6, 0.5 + r() * 1.2, r() * 3, 90 + r() * 130);
  for (let i = 0; i < 700; i++) blob(r() * N, r() * N, 2 + r() * 6, 1.5 + r() * 4, r() * 3, 70 + r() * 150);
  for (let i = 0; i < 60; i++) blob(r() * N, r() * N, 8 + r() * 22, 5 + r() * 14, r() * 3, 120 + r() * 60);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// ---------- world building ----------
async function loadTerrain(base) {
  const meta = await (await fetch(base + "terrain/terrain.json")).json();
  const buf = await (await fetch(base + "terrain/heights.bin")).arrayBuffer();
  const heights = new Float32Array(buf);
  const tex = await new THREE.TextureLoader().loadAsync(base + "terrain/ortho.jpg");
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { meta, heights, tex };
}

function setupWorld(T) {
  const { meta, heights } = T;
  const [gw, gh] = meta.grid;
  const W = meta.width_m, H = meta.height_m;
  const [bx, bz] = meta.base_offset_m;
  S.T = { meta, heights, gw, gh, W, H, bx, bz };
  const mLat = meta.mars_radius_m * DEG, mLon = mLat * Math.cos(meta.base.lat * DEG);
  S.toLocal = (lat, lon) => new THREE.Vector3((lon - meta.base.lon) * mLon, 0, -(lat - meta.base.lat) * mLat);
  S.toLatLon = (x, z) => [meta.base.lat - z / mLat, meta.base.lon + x / mLon];

  // terrain mesh
  const geo = new THREE.PlaneGeometry(W, H, gw - 1, gh - 1);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, heights[i]);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ map: T.tex, color: new THREE.Color("#f2b98c") });
  const detail = makeDetailTexture();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.detailMap = { value: detail };
    sh.uniforms.detailRepeat = { value: new THREE.Vector2(W / 2.5, H / 2.5) };   // one tile every 2.5 m
    sh.fragmentShader = "uniform sampler2D detailMap; uniform vec2 detailRepeat;\n" + sh.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
       vec3 d1 = texture2D(detailMap, vMapUv * detailRepeat).rgb;
       vec3 d2 = texture2D(detailMap, vMapUv * detailRepeat * 0.137 + 0.31).rgb;
       diffuseColor.rgb *= d1 * d2 * 2.9;`);
  };
  const ground = new THREE.Mesh(geo, mat);
  ground.position.set(-bx, 0, -bz);
  S.scene.add(ground);
  // flat ground beyond the photo, hidden in the haze
  const far = new THREE.Mesh(new THREE.CircleGeometry(4000, 64).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: "#8a6446" }));
  far.position.y = meta.height_range_m[0] - 0.6;
  S.scene.add(far);
}

function heightAt(x, z) {
  const t = S.T;
  const u = (x + t.bx + t.W / 2) / t.W * (t.gw - 1), v = (z + t.bz + t.H / 2) / t.H * (t.gh - 1);
  const i = Math.max(0, Math.min(t.gw - 2, Math.floor(u))), j = Math.max(0, Math.min(t.gh - 2, Math.floor(v)));
  const fu = Math.min(1, Math.max(0, u - i)), fv = Math.min(1, Math.max(0, v - j));
  const h = t.heights, k = j * t.gw + i;
  return (h[k] * (1 - fu) + h[k + 1] * fu) * (1 - fv) + (h[k + t.gw] * (1 - fu) + h[k + t.gw + 1] * fu) * fv;
}

function addSky() {
  const geo = new THREE.SphereGeometry(3000, 32, 16);
  const col = [];
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, Math.min(1, p.getY(i) / 1200));
    const c = SKY_LOW.clone().lerp(SKY_TOP, t);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  S.sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  S.scene.add(S.sky);
  // distant mountains: Mount Sharp rises to the south, Gale crater rim far to the north
  const N = 256, R = 2200, pos = [], idx = [], r = rng(7);
  const noise = Array.from({ length: 16 }, () => r());
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;                       // 0 = north, clockwise
    let h = 0;
    for (let k = 1; k <= 6; k++) h += Math.sin(a * k * 2 + noise[k] * 6) * (40 / k);
    const south = Math.max(0, -Math.cos(a));               // higher towards the south
    h = 60 + h + south * 380;
    const x = Math.sin(a) * R, z = -Math.cos(a) * R;
    pos.push(x, -50, z, x, h, z);
    if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  mg.setIndex(idx);
  S.mountains = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ color: "#c79a74", side: THREE.DoubleSide, fog: false }));
  S.scene.add(S.mountains);
}

function rockGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position, r = rng(seed);
  const bumps = Array.from({ length: 6 }, () => [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1, r() * 0.35]);
  const nrm = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    nrm.setXYZ(i, v.x, v.y / 0.6, v.z);          // smooth, rounded shading (not faceted)
    let s = 1;
    for (const [x, y, z, a] of bumps) s += a * Math.max(0, v.x * x + v.y * y + v.z * z);
    v.multiplyScalar(s); v.y *= 0.6;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  for (let i = 0; i < nrm.count; i++) {
    const n = new THREE.Vector3().fromBufferAttribute(nrm, i).normalize();
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  nrm.needsUpdate = true;
  return g;
}

function addRocks(route) {
  const count = 900, r = rng(42);
  const mesh = new THREE.InstancedMesh(rockGeometry(3), new THREE.MeshLambertMaterial({ color: "#8b6a52" }), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let n = 0;
  for (let tries = 0; n < count && tries < count * 10; tries++) {
    const a = route[Math.floor(r() * route.length)];
    const x = a.x + (r() - 0.5) * 160, z = a.z + (r() - 0.5) * 160;
    // keep a clear walking lane along the route
    if (route.some((p) => Math.hypot(p.x - x, p.z - z) < 2.5)) continue;
    const s = 0.08 + Math.pow(r(), 3) * 0.9;
    e.set(r() * 6, r() * 6, r() * 6); q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, heightAt(x, z) + s * 0.2, z), q, new THREE.Vector3(s, s, s));
    mesh.setMatrixAt(n++, m);
  }
  mesh.count = n;
  S.scene.add(mesh);
}

function addRover(at) {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: "#d9d4cc" }), dark = new THREE.MeshLambertMaterial({ color: "#3a3633" });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 2.2), white); body.position.y = 1.0; g.add(body);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 2.3), dark); deck.position.y = 1.3; g.add(deck);
  for (const sx of [-0.85, 0.85]) for (const sz of [-0.9, 0, 0.9]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.4, 20), dark);
    w.rotation.z = Math.PI / 2; w.position.set(sx, 0.26, sz); g.add(w);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), white); leg.position.set(sx * 0.9, 0.6, sz); g.add(leg);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 10), white); mast.position.set(0.45, 1.85, -0.85); g.add(mast);
  const head = new THREE.Group(); head.position.set(0.45, 2.4, -0.85); g.add(head);
  head.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.3), white));
  const rtg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 12), dark); rtg.rotation.x = 1.1; rtg.position.set(0, 1.3, 1.35); g.add(rtg);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), white); arm.position.set(-0.3, 1.0, -1.6); g.add(arm);
  g.position.set(at.x, heightAt(at.x, at.z), at.z);
  g.rotation.y = 0.6;
  S.rover = { group: g, head };
  S.scene.add(g);
  const label = makeLabel("Curiosity rover", "#ffffff"); label.position.set(0, 3.4, 0); label.visible = !S.opts.hud; g.add(label);
}

function addStops(mission) {
  S.stops = mission.stops.map((st, i) => {
    const p = S.toLocal(st.mars[0], st.mars[1]);
    p.y = heightAt(p.x, p.z);
    const grp = new THREE.Group(); grp.position.copy(p);
    const beamMat = new THREE.MeshBasicMaterial({ color: "#22d3ee", transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 40, 16, 1, true), beamMat); beam.position.y = 20; grp.add(beam);
    const ringMat = new THREE.MeshBasicMaterial({ color: "#22d3ee", transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(ARRIVE_M - 0.4, ARRIVE_M, 64).rotateX(-Math.PI / 2), ringMat); ring.position.y = 0.15; grp.add(ring);
    const label = makeLabel(`${st.id} · ${st.name}`); label.position.y = 4; label.visible = !S.opts.hud; grp.add(label);
    S.scene.add(grp);
    // the science rock to scan, a few metres from the beacon
    const ang = i * 1.7 + 0.5, rx = p.x + Math.cos(ang) * 3.2, rz = p.z + Math.sin(ang) * 3.2;
    const rock = new THREE.Mesh(rockGeometry(100 + i), new THREE.MeshLambertMaterial({ color: "#a07a5c", emissive: "#000000" }));
    rock.scale.setScalar(0.55); rock.position.set(rx, heightAt(rx, rz) + 0.15, rz);
    const glow = new THREE.Mesh(rockGeometry(100 + i), new THREE.MeshBasicMaterial({ color: "#22d3ee", wireframe: true, transparent: true, opacity: 0.5 }));
    glow.scale.setScalar(1.12); rock.add(glow);
    S.scene.add(rock);
    return { st, pos: p, beamMat, ringMat, ring, rock, glow, label };
  });
  S.visited = S.stops.map((_, i) => i === 0);
  S.scanned = S.stops.map(() => false);
}

function addReticle() {
  const g = new THREE.Group(); g.position.set(0, 0, -2);
  const dot = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.02, 24), new THREE.MeshBasicMaterial({ color: "#ffffff", depthTest: false, transparent: true, opacity: 0.8 }));
  dot.renderOrder = 20; g.add(dot);
  const progMat = new THREE.MeshBasicMaterial({ color: "#4ade80", depthTest: false, side: THREE.DoubleSide });
  S.progress = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.045, 48, 1, Math.PI / 2, 0.001), progMat);
  S.progress.renderOrder = 21; g.add(S.progress);
  S.camera.add(g);
}

function addDust() {
  const n = 1500, pos = new Float32Array(n * 3), r = rng(9);
  for (let i = 0; i < n * 3; i++) pos[i] = (r() - 0.5) * 60;
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  S.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: "#d39a66", size: 0.12, transparent: true, opacity: 0, depthWrite: false }));
  S.scene.add(S.dust);
}

// ---------- sensors & input ----------
function onOrientation(ev) {
  if (ev.alpha == null) return;
  const a = ev.alpha * DEG, b = ev.beta * DEG, g = ev.gamma * DEG;
  // direction the back of the phone points (phone upright in the VR box)
  const vx = -(Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g));
  const vy = Math.cos(a) * Math.sin(b) * Math.cos(g) - Math.sin(a) * Math.sin(g);
  const vz = -Math.cos(b) * Math.cos(g);
  let h = Math.atan2(vx, vy) / DEG;
  if (typeof ev.webkitCompassHeading === "number") h += ev.webkitCompassHeading - wrap360(360 - ev.alpha); // iOS
  S.sensorHeading = wrap360(h);
  S.sensorPitch = Math.asin(Math.max(-1, Math.min(1, vz))) / DEG;
}
function addInput() {
  listen(window, "keydown", (e) => {
    if (WALK_KEYS.has(e.key)) { S.keyWalking = true; e.preventDefault(); }
    if (S.sensorHeading == null && (e.key === "a" || e.key === "A" || e.key === "ArrowLeft")) S.heading = wrap360(S.heading - 4);
    if (S.sensorHeading == null && (e.key === "d" || e.key === "D")) S.heading = wrap360(S.heading + 4);
  });
  listen(window, "keyup", (e) => { if (WALK_KEYS.has(e.key)) S.keyWalking = false; });
  let drag = null;
  listen(window, "pointerdown", (e) => { if (e.pointerType === "mouse") drag = [e.clientX, e.clientY]; });
  listen(window, "pointermove", (e) => {
    if (!drag || S.sensorHeading != null) return;
    S.heading = wrap360(S.heading - (e.clientX - drag[0]) * 0.25);
    S.lastManualLook = performance.now();
    S.pitch = Math.max(-60, Math.min(60, S.pitch + (e.clientY - drag[1]) * 0.2));
    drag = [e.clientX, e.clientY];
  });
  listen(window, "pointerup", () => { drag = null; });
  listen(window, "resize", resize);
}
function resize() {
  const el = S.container, w = el.clientWidth, h = el.clientHeight;
  S.renderer.setSize(w, h, false);
  S.camera.aspect = (S.stereo ? w / 2 : w) / h;
  // HUD mode: match the HUD's horizontal field of view so its pins sit on our beacons
  if (S.opts.hfovDeg) S.camera.fov = 2 * Math.atan(Math.tan(S.opts.hfovDeg * DEG / 2) / S.camera.aspect) / DEG;
  S.camera.updateProjectionMatrix();
}

// ---------- per frame ----------
function nextStopIndex() { const i = S.visited.indexOf(false); return i < 0 ? S.stops.length - 1 : i; }
function nearestRouteIndex() {
  let best = 0, bd = Infinity;
  S.routePts.forEach((p, i) => { const d = Math.hypot(p.x - S.pos.x, p.z - S.pos.z); if (d < bd) { bd = d; best = i; } });
  return Math.min(best + 1, S.routePts.length - 1);
}
// autopilot: follow Curiosity's route point by point; head straight for the beacon when it is close
function autopilotDirection(now) {
  if (!S.autopilot || now < S.pauseUntil || S.visited.every(Boolean)) return null;
  const beacon = S.stops[nextStopIndex()].pos;
  let target = S.routePts[S.rIdx];
  if (Math.hypot(target.x - S.pos.x, target.z - S.pos.z) < 1.5 && S.rIdx < S.routePts.length - 1) target = S.routePts[++S.rIdx];
  if (Math.hypot(beacon.x - S.pos.x, beacon.z - S.pos.z) < 15) target = beacon;
  return wrap360(Math.atan2(target.x - S.pos.x, -(target.z - S.pos.z)) / DEG);
}

function tick(now) {
  const dt = Math.min(0.1, (now - (S.last || now)) / 1000); S.last = now;
  update(dt, now);
  render();
  S.raf = requestAnimationFrame(tick);
}

function update(dt, now) {
  const t = now / 1000;
  // look direction
  if (S.sensorHeading != null) {
    S.heading = wrap360(S.heading + angleDiff(S.sensorHeading, S.heading) * Math.min(1, dt * 10));
    S.pitch += (S.sensorPitch - S.pitch) * Math.min(1, dt * 10);
  }
  // walking
  const pad = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  const manual = S.walking || S.keyWalking || !!(pad && pad.buttons[0] && pad.buttons[0].pressed);
  const autoDir = manual ? null : autopilotDirection(now);
  const walking = manual || autoDir != null;
  // laptop without motion sensors: the view turns gently towards where you walk
  if (autoDir != null && S.sensorHeading == null && now - S.lastManualLook > 3000) {
    S.heading = wrap360(S.heading + angleDiff(autoDir, S.heading) * Math.min(1, dt * 1.5));
    S.pitch += (-8 - S.pitch) * Math.min(1, dt * 1.5);
  }
  S.moveHeading = autoDir ?? S.heading;
  if (walking) {
    const sp = (S.mission.suit?.walk_speed_mps || 0.8) * S.opts.speed;
    const h = S.moveHeading * DEG;
    const nx = S.pos.x + Math.sin(h) * sp * dt, nz = S.pos.z - Math.cos(h) * sp * dt;
    const T = S.T, lim = (v, half, off) => Math.max(-half - off + 5, Math.min(half - off - 5, v));
    S.pos.x = lim(nx, T.W / 2, T.bx); S.pos.z = lim(nz, T.H / 2, T.bz);
    S.bob += dt * sp * 6;
  }
  S.pos.y = heightAt(S.pos.x, S.pos.z) + EYE_H + (walking ? Math.sin(S.bob) * 0.03 : 0);
  S.camera.position.copy(S.pos);
  if (S.opts.lockPitch) S.pitch = 0;          // HUD mode: the HUD draws its horizon at mid-screen
  S.camera.rotation.set(S.pitch * DEG, -S.heading * DEG, 0, "YXZ");
  S.sky.position.set(S.pos.x, 0, S.pos.z);
  S.mountains.position.set(S.pos.x, 0, S.pos.z);

  // stops: pulse, arrive
  const next = nextStopIndex();
  S.stops.forEach((s, i) => {
    const isNext = i === next && !S.visited[i];
    const col = S.visited[i] ? "#4ade80" : isNext ? "#22d3ee" : "#7c8aa0";
    s.beamMat.color.set(col); s.ringMat.color.set(col);
    s.beamMat.opacity = isNext ? 0.3 + Math.sin(t * 3) * 0.15 : 0.18;
    s.ring.scale.setScalar(isNext ? 1 + Math.sin(t * 3) * 0.04 : 1);
    s.ringMat.opacity = S.visited[i] ? 0.15 : 0.8;
    s.glow.material.opacity = S.scanned[i] ? 0 : 0.35 + Math.sin(t * 4) * 0.25;
    if (!S.visited[i] && i === next && Math.hypot(S.pos.x - s.pos.x, S.pos.z - s.pos.z) < ARRIVE_M) {
      S.visited[i] = true;
      if (S.autopilot) S.pauseUntil = now + PAUSE_AT_STOP_MS;
      emit("arrive", { stop: i, name: s.st.name });
    }
  });

  // gaze scanning
  S.ray.setFromCamera(new THREE.Vector2(0, 0), S.camera);
  const targets = S.stops.filter((s, i) => !S.scanned[i]).map((s) => s.rock);
  const hit = S.ray.intersectObjects(targets, false)[0];
  if (hit && hit.distance < SCAN_RANGE_M) {
    S.scanT += dt;
    const i = S.stops.findIndex((s) => s.rock === hit.object);
    if (S.scanT >= SCAN_SECONDS) {
      S.scanned[i] = true; S.scanT = 0;
      S.stops[i].rock.material.emissive.set("#1f5f3a");
      emit("scan", { stop: i, name: S.stops[i].st.name });
    }
  } else S.scanT = Math.max(0, S.scanT - dt * 2);
  S.progress.geometry.dispose();
  S.progress.geometry = new THREE.RingGeometry(0.03, 0.045, 48, 1, Math.PI / 2, Math.max(0.001, (S.scanT / SCAN_SECONDS) * Math.PI * 2));

  // rover idles: mast head looks around
  if (S.rover) S.rover.head.rotation.y = Math.sin(t * 0.4) * 0.8;

  // dust storm
  const dusty = now < S.dustUntil ? 1 : 0;
  S.dustLevel = (S.dustLevel || 0) + (dusty - (S.dustLevel || 0)) * Math.min(1, dt * 0.8);
  const d = S.dustLevel;
  S.scene.fog.color.copy(FOG).lerp(DUST, d);
  S.scene.fog.near = 40 * (1 - d) + 2 * d; S.scene.fog.far = 500 * (1 - d) + 35 * d;
  S.sky.material.color.setScalar(1 - d * 0.5);
  S.dust.material.opacity = d * 0.8;
  S.dust.position.set(S.pos.x + Math.sin(t) * 2, S.pos.y, S.pos.z + t * 1.5 % 30);
}

function render() {
  const r = S.renderer, w = S.container.clientWidth, h = S.container.clientHeight;
  if (!S.stereo) { r.setScissorTest(false); r.setViewport(0, 0, w, h); r.render(S.scene, S.camera); return; }
  S.camera.updateMatrixWorld();
  S.stereoCam.update(S.camera);
  r.setScissorTest(true);
  r.setScissor(0, 0, w / 2, h); r.setViewport(0, 0, w / 2, h); r.render(S.scene, S.stereoCam.cameraL);
  r.setScissor(w / 2, 0, w / 2, h); r.setViewport(w / 2, 0, w / 2, h); r.render(S.scene, S.stereoCam.cameraR);
  r.setScissorTest(false);
}

// ---------- public API ----------
export const sim = {
  async start(mission, opts = {}) {
    this.stop();
    S.mission = mission;
    S.opts = { assetsBase: "../mission/", speed: 1, stereo: true, ...opts };
    S.stereo = S.opts.stereo;
    S.container = S.opts.container || document.body;
    S.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });  // HUD copies the picture
    S.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    S.renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    S.container.appendChild(S.renderer.domElement);
    S.scene = new THREE.Scene();
    S.scene.fog = new THREE.Fog(FOG.clone(), 40, 500);
    S.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 6000);
    S.scene.add(S.camera);
    S.stereoCam = new THREE.StereoCamera(); S.stereoCam.eyeSep = 0.064;
    S.ray = new THREE.Raycaster();
    S.scene.add(new THREE.HemisphereLight("#f3d9bd", "#6a4a35", 2.2));
    const sun = new THREE.DirectionalLight("#fff1dc", 2.6); sun.position.set(-300, 220, -120); S.scene.add(sun);

    const T = await loadTerrain(S.opts.assetsBase);
    setupWorld(T);
    addSky();
    const route = mission.route.map((p) => S.toLocal(p.lat ?? p[0], p.lon ?? p[1]));
    S.routePts = route;
    addRocks(route);
    addStops(mission);
    const mainStop = S.stops[Math.min(4, S.stops.length - 1)].pos;
    addRover({ x: mainStop.x + 7, z: mainStop.z - 4 });
    addReticle();
    addDust();

    // start at the base, facing the first stop
    S.pos.copy(S.stops[0].pos);
    const f = S.stops[1].pos;
    S.heading = wrap360(Math.atan2(f.x - S.pos.x, -(f.z - S.pos.z)) / DEG);
    S.rIdx = nearestRouteIndex();
    S.autopilot = !!S.opts.autopilot;
    resize();
    addInput();
    S.raf = requestAnimationFrame(tick);
  },

  async enableSensors() {
    try {
      if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) await DeviceOrientationEvent.requestPermission();
    } catch (_) { /* keep mouse / keys */ }
    if ("ondeviceorientationabsolute" in window) listen(window, "deviceorientationabsolute", onOrientation);
    else listen(window, "deviceorientation", onOrientation);
  },

  getPosition() {
    const next = nextStopIndex(), s = S.stops[next];
    const last = S.visited.lastIndexOf(true);
    const mars = S.toLatLon(S.pos.x, S.pos.z);
    return {
      mars, lat: mars[0], lon: mars[1],
      heading: S.heading, pitch: S.pitch,
      stop: last, nextStop: next,
      dist_next_m: Math.hypot(S.pos.x - s.pos.x, S.pos.z - s.pos.z),
      visited: [...S.visited], scanned: [...S.scanned],
      walking: S.walking || S.keyWalking,
    };
  },

  on(name, fn) { (S.handlers[name] ||= []).push(fn); },
  /** The 3D picture (a canvas) for the HUD to draw behind its overlay. */
  getBackground() { return S.renderer?.domElement ?? null; },
  /** Demo panel: jump next to a stop. */
  jumpToStop(i) { this.teleport(Math.max(0, Math.min(S.stops.length - 1, i))); },
  event(type) { if (type === "dust") S.dustUntil = performance.now() + 20000; },
  setWalking(on) { S.walking = !!on; },
  /** Walk by yourself along the route, pausing at each beacon. You only look around. */
  setAutopilot(on) { S.autopilot = !!on; S.pauseUntil = 0; if (on) S.rIdx = nearestRouteIndex(); },
  isAutopilot() { return S.autopilot; },
  setStereo(on) { S.stereo = !!on; if (S.renderer) resize(); },
  /** Jump next to a stop (testing). */
  teleport(i) {
    const p = S.stops[i].pos; S.pos.set(p.x - 8, 0, p.z + 8);
    S.stops.forEach((_, k) => { S.visited[k] = k < i; });
    S.rIdx = nearestRouteIndex();
  },
  /** Fast-forward the simulation by `seconds` (testing). */
  fastForward(seconds, step = 0.05) {
    S.clock = S.clock ?? performance.now();
    for (let k = 0; k < seconds / step; k++) { S.clock += step * 1000; update(step, S.clock); }
    S.pauseUntil = Math.min(S.pauseUntil, performance.now());
  },
  /** Look at a compass heading / pitch (testing, laptop). */
  look(heading, pitch = 0) { S.heading = wrap360(heading); S.pitch = pitch; },
  stop() {
    cancelAnimationFrame(S.raf);
    S.listeners.forEach((off) => off()); S.listeners = [];
    if (S.renderer) { S.renderer.dispose(); S.renderer.domElement.remove(); S.renderer = null; }
  },
};
