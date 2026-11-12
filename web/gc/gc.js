// Ground Control (T1.5): watch the astronaut live, follow them on the Mars map, send messages and events.
import { PEER_PREFIX, ICE } from "../live/live-config.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const video = $("video"), snap = $("snap"), noVideo = $("noVideo");
let peer = null, conn = null, room = null, retryTimer = null, lastAlerts = new Set(), lastData = 0;
const RETRY_MS = 1500, DEAD_MS = 6000;

// ---------- log ----------
function log(text, kind = "info") {
  const li = document.createElement("li");
  li.className = kind;
  li.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
  $("log").prepend(li);
}
function setLink(text, cls) { const el = $("link"); el.textContent = text; el.className = `pill ${cls}`; }

// ---------- Mars delay ----------
const delayMs = () => ($("delayOn").checked ? Number($("delaySec").value) * 1000 : 0);
const later = (fn) => { const d = delayMs(); d ? setTimeout(fn, d) : fn(); };

// ---------- map ----------
const mission = await (await fetch("../mission/mission.json")).json();
const hirise = mission.layers.find((l) => l.id === "hirise")?.tiles;
const map = L.map("map", { crs: L.CRS.EPSG4326, zoomControl: true, attributionControl: true })
  .setView(mission.anchor.mars, 16);
L.tileLayer(hirise, { maxNativeZoom: 16, maxZoom: 18, attribution: "NASA/JPL/UArizona HiRISE · Mars Trek" }).addTo(map);
L.polyline(mission.route.map((p) => p.mars ?? [p.lat, p.lon]), { color: "#ffb54a", weight: 3, opacity: 0.9 }).addTo(map);
for (const s of mission.stops) {
  L.circleMarker(s.mars, { radius: 7, color: s.is_base ? "#4ade80" : "#22d3ee", fillOpacity: 0.85 })
    .bindTooltip(`${s.id} · ${s.name}`, { permanent: true, direction: "right", className: "" }).addTo(map);
}
const trail = L.polyline([], { color: "#22d3ee", weight: 2, dashArray: "4 4" }).addTo(map);
const astro = L.marker(mission.anchor.mars, { icon: L.divIcon({ className: "", html: '<div class="astro"></div>', iconSize: [18, 18] }) }).addTo(map);
let followed = false;

// ---------- incoming data ----------
function onTelemetry(t) {
  $("o2").textContent = t.o2_pct != null ? `${t.o2_pct}%` : "—";
  $("rad").textContent = t.rad_dose_uSv ?? "—";
  const stop = mission.stops.find((s) => s.id === t.stop && !s.is_base);
  $("stop").textContent = stop ? stop.name : t.stop == null ? "Base" : `#${t.stop}`;
  $("dnext").textContent = t.dist_next_m != null ? `${t.dist_next_m} m` : "—";
  $("dbase").textContent = t.dist_base_m != null ? `${t.dist_base_m} m` : "—";
  $("heading").textContent = t.heading != null ? `${t.heading}°` : "—";
  $("viewMode").textContent = { field: "· camera", sim: "· 3D simulation" }[t.mode] ?? "";
  if (t.mars) {
    astro.setLatLng(t.mars);
    trail.addLatLng(t.mars);
    if (!followed) { map.panTo(t.mars); followed = true; }
  }
  const now = new Set(t.alerts ?? []);
  for (const a of now) if (!lastAlerts.has(a)) log(`ALERT ${a.replaceAll("_", " ")}`, "alert");
  lastAlerts = now;
}
let localLink = false;
function videoPlaying() { return localLink || (video.srcObject && video.videoWidth > 0); }
function onData(msg) {
  if (!msg || typeof msg !== "object") return;
  lastData = Date.now();
  if (msg.type === "ping") return;
  later(() => {
    if (msg.type === "telemetry") onTelemetry(msg);
    if (msg.type === "snap" && !videoPlaying()) {
      snap.src = msg.data; snap.style.display = "block"; noVideo.style.display = "none";
    }
    if (msg.type === "hello") log(`Linked to astronaut (room ${msg.room})`, "info");
  });
}

// ---------- connection ----------
function connect(code) {
  room = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!room) return;
  history.replaceState(null, "", `?room=${room}`);
  clearTimeout(retryTimer);
  conn?.close();
  peer?.destroy();
  setLink("connecting…", "warn");
  peer = new Peer({ config: ICE });
  peer.on("open", () => {
    conn = peer.connect(PEER_PREFIX + room, { reliable: true });
    conn.on("open", () => {
      lastData = Date.now();
      setLink(`connected · ${room}`, "on"); log("Connected", "info");
      // no video after 4 s? ask the phone to send it again
      setTimeout(() => { if (!videoPlaying() && conn?.open) conn.send({ type: "want-video" }); }, 4000);
    });
    conn.on("data", onData);
    conn.on("close", () => { setLink("lost: reconnecting", "warn"); retryTimer = setTimeout(() => connect(room), RETRY_MS); });
  });
  peer.on("call", (call) => {
    call.answer();
    call.on("stream", (stream) => {
      video.srcObject = stream;
      video.play().catch(() => {});
      snap.style.display = "none"; noVideo.style.display = "none";
    });
  });
  peer.on("error", (err) => {
    if (err.type === "peer-unavailable") setLink("astronaut not online yet: retrying", "warn");
    else setLink(`error: ${err.type}`, "warn");
    retryTimer = setTimeout(() => connect(room), RETRY_MS);
  });
}
// watchdog: no data (not even the heartbeat) for 6 s means the link is dead: reconnect
setInterval(() => {
  if (room && conn?.open && Date.now() - lastData > DEAD_MS) { log("Link silent: reconnecting", "alert"); connect(room); }
  if (conn?.open && Date.now() - lastData > 2500) setLink(`weak link · ${Math.round((Date.now() - lastData) / 1000)} s`, "warn");
  else if (conn?.open) setLink(`connected · ${room}`, "on");
}, 1000);
async function allowLocalNetwork() {
  try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop()); } catch { /* fine */ }
}
$("join").addEventListener("submit", async (e) => { e.preventDefault(); await allowLocalNetwork(); connect($("room").value); });
if (params.get("room")) { $("room").value = params.get("room"); connect(params.get("room")); }

// ---------- outgoing ----------
function sendToAstronaut(msg, label) {
  if (!localLink && !conn?.open) { log("Not connected", "alert"); return; }
  const d = delayMs();
  log(d ? `${label} (arrives in ${d / 1000} s, Mars delay)` : label, "gc");
  later(() => {
    if (localLink) fetch("/api/message", { method: "POST", body: JSON.stringify(msg), headers: { "Content-Type": "application/json" } }).catch(() => log("Send failed", "alert"));
    else if (conn?.open) conn.send(msg);
  });
}
$("msgForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("msg").value.trim();
  if (!text) return;
  sendToAstronaut({ type: "message", text }, `GC: ${text}`);
  $("msg").value = "";
});
document.querySelectorAll("[data-event]").forEach((b) =>
  b.addEventListener("click", () => sendToAstronaut({ type: "event", name: b.dataset.event }, `EVENT ${b.textContent}`)));
document.querySelectorAll("[data-demo]").forEach((b) =>
  b.addEventListener("click", () => sendToAstronaut({ type: "demo", name: b.dataset.demo }, `TEST ${b.textContent}`)));
$("delayOn").addEventListener("change", () => log($("delayOn").checked ? `Mars delay ON (${$("delaySec").value} s each way). Video stays live.` : "Mars delay OFF", "info"));

// ---------- local link (this page is served by server/server.mjs on the laptop) ----------
async function startLocalLink() {
  try { if (!(await fetch("/api/ping", { cache: "no-store" })).ok) return; } catch { return; }
  localLink = true;
  clearTimeout(retryTimer); conn?.close(); peer?.destroy(); room = null;
  $("join").querySelector("label").style.display = "none";
  $("join").querySelector("button").style.display = "none";
  setLink("local link: waiting for phone", "warn");
  snap.src = "/api/video.mjpg";                                    // live picture stream from the phone
  snap.style.display = "block"; video.style.display = "none";
  snap.onload = () => { noVideo.style.display = "none"; };
  snap.onerror = () => setTimeout(() => { snap.src = `/api/video.mjpg?${Date.now()}`; }, 1000);
  const events = new EventSource("/api/events");                  // reconnects by itself
  let phoneOnline = false;
  events.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "ping") {
      if (msg.phoneOnline !== phoneOnline) { phoneOnline = msg.phoneOnline; log(phoneOnline ? "Phone connected" : "Phone not sending", phoneOnline ? "info" : "alert"); }
      setLink(phoneOnline ? "local link · phone online" : "local link: waiting for phone", phoneOnline ? "on" : "warn");
      return;
    }
    onData(msg);
  };
  events.onerror = () => setLink("laptop server not reachable", "warn");
}
startLocalLink();
