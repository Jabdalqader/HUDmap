// Mars Walk HUD: local link server (runs on the Ground Control laptop).
//
//   node server/server.mjs                 # picks the laptop's Wi-Fi / hotspot address
//   node server/server.mjs --host 172.20.10.3 --port 8443
//
// Serves web/ over HTTPS (self-signed certificate, made on first run) and relays between the phone and
// Ground Control on the same network. No internet needed for the link.
//   phone  -> POST /api/frame (JPEG)  -> GET /api/video.mjpg   (Ground Control live view)
//   phone  -> POST /api/telemetry     -> GET /api/events (SSE)  (Ground Control data)
//   Ground Control -> POST /api/message -> GET /api/phone-events (SSE) (to the phone)
//
// Who can reach it: devices on the same network (your phone's hotspot). It binds to that one address,
// not to every interface. Stop it with Ctrl+C when you're done.
import https from "node:https";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..", "web");
const CERTS = path.join(HERE, "certs");
const args = Object.fromEntries(process.argv.slice(2).join(" ").split("--").filter(Boolean).map((a) => a.trim().split(/\s+/)));
const PORT = Number(args.port ?? 8443);

// ---------- which address to listen on: the private Wi-Fi / hotspot one ----------
function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address))
    .map((i) => i.address);
}
const HOST = args.host ?? lanAddresses()[0];
if (!HOST) { console.error("No Wi-Fi / hotspot address found. Connect the laptop to the phone's hotspot, or pass --host <ip>."); process.exit(1); }

// ---------- self-signed certificate (phones need HTTPS for camera, GPS and motion) ----------
function certificate() {
  const key = path.join(CERTS, "key.pem"), crt = path.join(CERTS, "cert.pem"), forHost = path.join(CERTS, "host.txt");
  if (!fs.existsSync(crt) || fs.readFileSync(forHost, "utf8").trim() !== HOST) {
    fs.mkdirSync(CERTS, { recursive: true });
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", crt, "-days", "365",
      "-subj", "/CN=Mars Walk HUD", "-addext", `subjectAltName=IP:${HOST},IP:127.0.0.1,DNS:localhost`], { stdio: "ignore" });
    fs.writeFileSync(forHost, HOST);
  }
  return { key: fs.readFileSync(key), cert: fs.readFileSync(crt) };
}

// ---------- relay state ----------
const gcClients = new Set();      // Ground Control SSE
const phoneClients = new Set();   // phone SSE
const videoClients = new Set();   // MJPEG viewers
let lastFrame = null, lastTelemetry = null, lastPhoneSeen = 0;

function sse(res, clients) {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
  res.write("retry: 1000\n\n");
  clients.add(res);
  res.on("close", () => clients.delete(res));
}
function push(clients, obj) {
  const line = `data: ${JSON.stringify(obj)}\n\n`;
  for (const c of clients) c.write(line);
}
setInterval(() => {               // heartbeat both ways + phone link status for Ground Control
  push(gcClients, { type: "ping", phoneOnline: Date.now() - lastPhoneSeen < 7000 });
  push(phoneClients, { type: "ping", viewers: gcClients.size });
}, 2000);

function readBody(req, limit = 2_000_000) {
  return new Promise((ok, fail) => {
    const chunks = []; let size = 0;
    req.on("data", (c) => { size += c.length; if (size > limit) { req.destroy(); fail(new Error("too big")); } else chunks.push(c); });
    req.on("end", () => ok(Buffer.concat(chunks)));
    req.on("error", fail);
  });
}

// ---------- static files (only inside web/) ----------
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".bin": "application/octet-stream", ".woff2": "font/woff2", ".ico": "image/x-icon" };
function serveFile(req, res) {
  const url = new URL(req.url, "https://x");
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") { res.writeHead(302, { Location: "/hud/" }); return res.end(); }
  let file = path.resolve(WEB, "." + rel);
  if (file !== WEB && !file.startsWith(WEB + path.sep)) { res.writeHead(403); return res.end(); }   // no ../ escapes
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end("Not found"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(file).pipe(res);
}

// ---------- server ----------
const server = https.createServer(certificate(), async (req, res) => {
  const { pathname } = new URL(req.url, "https://x");
  try {
    if (pathname === "/api/ping") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end('{"ok":true}'); }
    if (pathname === "/api/frame" && req.method === "POST") {
      lastFrame = await readBody(req); lastPhoneSeen = Date.now();
      for (const v of videoClients) {
        v.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${lastFrame.length}\r\n\r\n`);
        v.write(lastFrame); v.write("\r\n");
      }
      res.writeHead(204); return res.end();
    }
    if (pathname === "/api/video.mjpg") {
      res.writeHead(200, { "Content-Type": "multipart/x-mixed-replace; boundary=frame", "Cache-Control": "no-store", Connection: "keep-alive" });
      videoClients.add(res); res.on("close", () => videoClients.delete(res));
      if (lastFrame) { res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${lastFrame.length}\r\n\r\n`); res.write(lastFrame); res.write("\r\n"); }
      return;
    }
    if (pathname === "/api/telemetry" && req.method === "POST") {
      lastTelemetry = JSON.parse((await readBody(req, 100_000)).toString()); lastPhoneSeen = Date.now();
      push(gcClients, { ...lastTelemetry, type: "telemetry" });
      res.writeHead(204); return res.end();
    }
    if (pathname === "/api/events") { sse(res, gcClients); if (lastTelemetry) push(new Set([res]), { ...lastTelemetry, type: "telemetry" }); return; }
    if (pathname === "/api/phone-events") { sse(res, phoneClients); lastPhoneSeen = Date.now(); return; }
    if (pathname === "/api/message" && req.method === "POST") {
      push(phoneClients, JSON.parse((await readBody(req, 100_000)).toString()));
      res.writeHead(204); return res.end();
    }
    return serveFile(req, res);
  } catch (e) {
    if (!res.headersSent) res.writeHead(400);
    res.end(String(e.message ?? e));
  }
});
server.keepAliveTimeout = 65_000;
server.listen(PORT, HOST, () => {
  console.log(`\nMars Walk HUD link server on https://${HOST}:${PORT}`);
  console.log(`  Phone (on the same hotspot):   https://${HOST}:${PORT}/hud/`);
  console.log(`  Ground Control (this laptop):  https://${HOST}:${PORT}/gc/`);
  console.log("  First time: the browser warns 'not private' -> Advanced -> Proceed.  Ctrl+C to stop.\n");
});
