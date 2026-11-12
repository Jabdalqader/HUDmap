// live.js (T1.5): live link from the astronaut's phone to Ground Control.
//
// The HUD loads this module and calls sendTelemetry() every second, sendPhoto() every 2 s (field mode)
// and onMessage() for Ground Control messages. Ground Control (web/gc/) connects with the same room code.
//
// How: WebRTC through the free PeerJS service (no account). The phone streams its HUD screen
// (camera or 3D Mars + HUD) as live video, plus data. Backup: a small screenshot every 2 s.
// Who can watch: anyone who knows the room code. Tip: put the Ground Control laptop on the phone's
// hotspot so phone and laptop can always reach each other.

import { PEER_PREFIX, ICE } from "./live-config.js";
export { PEER_PREFIX, ICE };
const SNAP_MS = 2000, VIDEO_FPS = 15, PING_MS = 2000;

const state = { peer: null, conns: new Set(), calls: new Set(), stream: null, onMessage: [], room: null, status: "starting" };

function loadPeerJs() {
  if (window.Peer) return Promise.resolve(window.Peer);
  return new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = new URL("./vendor/peerjs.min.js", import.meta.url).href;
    s.onload = () => ok(window.Peer); s.onerror = () => fail(new Error("PeerJS failed to load"));
    document.head.appendChild(s);
  });
}

/** Room code: ?room= in the URL, else the last one used on this phone, else a new random one. */
export function getRoom() {
  if (state.room) return state.room;
  const fromUrl = new URLSearchParams(location.search).get("room");
  let room = (fromUrl || localStorage.getItem("marswalk.room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (room.length < 4) {
    const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    room = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => abc[b % abc.length]).join("");
  }
  localStorage.setItem("marswalk.room", room);
  return (state.room = room);
}
export const getStatus = () => state.status;
export const viewerCount = () => state.conns.size;

function hudStream() {
  if (state.stream) return state.stream;
  // one-eye copy made by the HUD renderer (falls back to the full screen)
  const canvas = document.getElementById("hud-stream") || document.getElementById("hud");
  if (canvas?.captureStream) state.stream = canvas.captureStream(VIDEO_FPS);
  return state.stream;
}

function send(msg) {
  for (const c of state.conns) if (c.open) { try { c.send(msg); } catch (_) { /* closed */ } }
}

function onData(msg) {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "message") state.onMessage.forEach((cb) => cb({ text: msg.text }));
  if (msg.type === "want-video") callViewer(this);
  if (msg.type === "demo") window.hud?.demo?.[msg.name]?.();
  if (msg.type === "event") {
    if (msg.name === "dust") window.hud?.sim?.event?.("dust");
    const text = { dust: "DUST STORM: visibility dropping", solar: "SOLAR STORM: return to base", o2leak: "O2 LEAK: return to base now" }[msg.name];
    if (msg.name === "o2leak") window.hud?.demo?.oxygenLow?.();
    if (text) state.onMessage.forEach((cb) => cb({ text }));
  }
}

/** Send the live video to one Ground Control viewer (again if they ask). */
function callViewer(conn) {
  const stream = hudStream();
  if (!stream || !state.peer) return;
  const call = state.peer.call(conn.peer, stream);
  state.calls.add(call);
  call.on("close", () => state.calls.delete(call));
}

async function connect() {
  const Peer = await loadPeerJs();
  const peer = new Peer(PEER_PREFIX + getRoom(), { config: ICE });
  state.peer = peer;
  peer.on("open", () => { state.status = "waiting for Ground Control"; });
  peer.on("connection", (conn) => {
    conn.on("open", () => {
      state.conns.add(conn);
      state.status = "Ground Control connected";
      callViewer(conn);
      conn.send({ type: "hello", room: getRoom() });
    });
    conn.on("data", onData.bind(conn));
    conn.on("close", () => { state.conns.delete(conn); if (!state.conns.size) state.status = "waiting for Ground Control"; });
  });
  peer.on("disconnected", () => { state.status = "reconnecting"; setTimeout(() => peer.reconnect(), 2000); });
  peer.on("error", (err) => {
    state.status = `link error: ${err.type}`;
    if (err.type === "unavailable-id") {            // an old tab still holds the code: retry in a moment
      peer.destroy(); setTimeout(connect, 2000);
    } else if (["network", "server-error", "socket-error", "socket-closed"].includes(err.type)) {
      peer.destroy(); setTimeout(connect, 2000);    // lost the internet for a moment: start over
    }
  });
  // free the room code at once when the page closes, so a reload reconnects fast
  addEventListener("pagehide", () => peer.destroy(), { once: true });
  // heartbeat: Ground Control notices a dead link within seconds and reconnects
  setInterval(() => send({ type: "ping", t: Date.now() }), PING_MS);
  // backup picture for Ground Control if the video can't play
  setInterval(() => {
    if (!state.conns.size) return;
    const canvas = document.getElementById("hud-stream") || document.getElementById("hud");
    if (!canvas) return;
    const w = 480, c = document.createElement("canvas");
    c.width = w; c.height = Math.round((canvas.height / canvas.width) * w) || 270;
    c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height);
    send({ type: "snap", data: c.toDataURL("image/jpeg", 0.55) });
  }, SNAP_MS);
}

let started = false;
function ensureStarted() {
  if (started) return;
  started = true;
  connect().catch((e) => { state.status = `link error: ${e.message}`; });
}

// ---------- what the HUD calls ----------
export function sendTelemetry(obj) {
  ensureStarted();
  send({ type: "telemetry", ...obj });
}
export async function sendPhoto(blob) {
  ensureStarted();
  if (!state.conns.size || !blob) return;
  send({ type: "photo", data: await blob.arrayBuffer() });
}
export function onMessage(callback) {
  ensureStarted();
  state.onMessage.push(callback);
}

// connect as soon as the HUD page loads
if (document.getElementById("hud")) ensureStarted();
