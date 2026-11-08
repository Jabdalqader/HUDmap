# Mars Walk HUD: Backlog (easy path)

| Sprint | Tasks |
|---|---|
| **Sprint 1: Build the parts** (alone) | T1.1 Mission data (AI1) · T1.2 Voice agent (AI2) · T1.3 VR simulation (AI3) · T1.4 Phone HUD (FS1) · T1.5 Ground Control + live link (FS2) |
| **Sprint 2: Together** | T2.1 Indoor run · T2.2 Desert test · T2.3 Video + submit |

**Ready-made services we use (no servers to build):**
| Need | Service | Why |
|---|---|---|
| Voice assistant (speech → AI → speech) | **ElevenLabs Agents** | One service does listening, thinking and talking |
| Live link phone ↔ Ground Control | **Firebase Realtime Database** (free) | No server code; data syncs instantly |
| Hosting with HTTPS (phone needs HTTPS for camera/GPS) | **Firebase Hosting** (free) | One command deploys; HTTPS is automatic |
| Mars map | **Mars Trek tiles + Leaflet** | Ready NASA map tiles |

⚠️ These services need internet: the phone uses **mobile data** and the laptop connects to the phone's hotspot.

---

# SPRINT 1: Build the parts

---

## T1.1 Mission data: build `mission.json`
**Owner:** AI1 · **Folder:** `builder/` → output to `web/mission/` · **Labels:** `data` `must`

### Why
`mission.json` is the one file with everything about the mission: stops, route, map layers, stop cards, weather and radiation. The HUD, the AI agent, the simulation and Ground Control all read it. The challenge asks for **at least 3 kinds of NASA data from several missions**, and this file is where we put them together.

### Input
Our 5 stops on Curiosity's real path (Mount Sharp boxwork):

| Stop | Name | Lat | Lon | Sol | Note |
|---|---|---|---|---|---|
| 0 | Base | -4.803606 | 137.380074 | 4596 | Flat entry |
| 1 | First ridges | -4.805495 | 137.379536 | 4618 | First boxwork |
| 2 | Steep ridge | -4.806553 | 137.379317 | 4639 | Rover tilted 13–17°: hazard |
| 3 | Hollow | -4.807168 | 137.379896 | 4655 | Flat, check for sand |
| 4 | Main site | -4.808008 | 137.381004 | 4711 | Rover stayed ~80 sols |
| 5 | Exit | -4.807785 | 137.382671 | 4820 | Then back to base |

NASA sources:
| Data | Link | Use |
|---|---|---|
| Curiosity path | `https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json` | Each point has `sol`, `lat`, `lon`, `elev_geoid` (height), `tilt` (slope) |
| Rover photos | `https://mars.nasa.gov/api/v1/raw_image_items/?order=sol%20desc&per_page=50&page=0&condition_1=msl:mission&condition_2=SOL:sol:gte&condition_3=SOL:sol:lte` | Replace SOL. Keep items with `extended.sample_type == "full"` and instrument `NAV_LEFT_B` or `MAST_LEFT` |
| HiRISE map | `https://trek.nasa.gov/tiles/Mars/EQ/curiosity_hirise_mosaic/1.0.0/default/default028mm/{z}/{y}/{x}.png` | Base map (optical), max zoom 16 |
| Minerals | MRO CRISM on trek.nasa.gov/mars (search the Gale area, mineral layers) | Spectral layer |
| Weather | Curiosity REMS (PDS Atmospheres node) | Temperature per sol |
| Radiation | Curiosity RAD | Surface average 0.67 mSv/day ≈ **28 µSv/h** |

### What to do (easy path)
1. **Route = Curiosity's real path.** The rover drove it safely, so take all waypoints between sol 4596 and 4820 as the route. No path-finding needed.
2. **Slope = rover tilt.** Each waypoint has `tilt`. Store it on the route points and on each stop. Anything over 12° is a hazard.
3. **Photos:** for each stop, download 3–5 photos from that sol and keep the best 1–2 (landscape, not the rover's body). Save as `assets/stopN.jpg`.
4. **Layers (at least 3 kinds of data):**
   - Optical: HiRISE tiles (URL above), MRO
   - Topographic: route colored by height/slope (from waypoints), Curiosity
   - Spectral: CRISM mineral overlay (PNG + bounds), MRO
   - Atmospheric: temperature + radiation per stop, Curiosity REMS/RAD
5. **Stop cards:** for each stop write `task`, `hazard`, `science`, 1 sentence each. Use ChatGPT/Claude to draft from NASA's boxwork articles, then **check every line**. Put links in `sources`.
6. **Weather/radiation:** temperature from REMS for that sol (or a typical value, marked "typical"), radiation 28 µSv/h.
7. Save `mission.json` + `assets/` and push to the repo. **Push a first version with fake values on day 1** so others can start.

**Tools:** a Python script or Jupyter notebook (requests, Pillow).

### Output: `mission.json` format
```json
{
  "mission_id": "boxwork-01",
  "site": "Mount Sharp boxwork, Gale Crater, Mars",
  "anchor": { "mars": [-4.803606, 137.380074], "field": [0, 0], "rotation_deg": 0, "scale": 1.0 },
  "route": [{ "lat": -4.803606, "lon": 137.380074, "elev": -3640.5, "slope": 6.5 }],
  "layers": [
    { "id": "hirise", "name": "Photo", "mission": "MRO", "instrument": "HiRISE", "kind": "optical",
      "tiles": "https://trek.nasa.gov/tiles/Mars/EQ/curiosity_hirise_mosaic/1.0.0/default/default028mm/{z}/{y}/{x}.png" },
    { "id": "minerals", "name": "Minerals", "mission": "MRO", "instrument": "CRISM", "kind": "spectral",
      "image": "assets/crism.png", "bounds": [[-4.811, 137.378], [-4.802, 137.384]] }
  ],
  "stops": [{
    "id": 2, "name": "Steep ridge", "mars": [-4.806553, 137.379317], "field": null, "sol": 4639,
    "slope_deg": 15, "hazard": "Steep slope, walk slowly",
    "task": "Photograph the dark crack on the ridge top",
    "science": "The ridge is rock hardened by minerals from old groundwater",
    "temp_c": -60, "rad_uSv_h": 28,
    "photos": ["assets/stop2.jpg"],
    "sources": ["MSL waypoints", "Navcam sol 4639", "NASA boxwork article 2026-02-23"]
  }],
  "suit": { "o2_start_pct": 100, "o2_pct_per_min": 0.25, "walk_speed_mps": 0.8 }
}
```
`mars` = position on Mars. `field` = position in the desert (filled in T2.2).

### Done when
- [ ] Fake version pushed on day 1
- [ ] Real version: 6 stops (base + 5) with photos, task, hazard, science, temp, radiation, sources
- [ ] Route from real waypoints with slope
- [ ] At least 3 data kinds from 2+ missions
- [ ] Someone else checked the stop-card text

### Extra (only if time)
Slope map from the 1 m height map (Mars Trek `Gale_DEM_SMG_1m`) as another layer.

---

## T1.2 Voice agent with ElevenLabs
**Owner:** AI2 · **Folders:** `ai/` (prompt, knowledge, tests) + `web/ai/voice.js` · **Labels:** `ai` `must`

### Why
Mars is 3–22 minutes from Earth by radio, so the astronaut can't wait for Mission Control. A voice assistant that knows the mission answers instantly. **ElevenLabs Agents** does speech-to-text, the AI and text-to-speech in one service, so we only configure it.

### Input
- `mission.json` (from T1.1)
- Live astronaut status from the HUD (via a "client tool", see below)

### What to do
1. **Account:** create an ElevenLabs account (one for the team). Free plan = 10k credits/month, enough for testing. If you run out, the Starter plan is $1 for the first month, then $6/month. Test in **text mode** in the dashboard to save credits.
2. **Create agent:** Agents → New agent → blank.
   - **Voice:** pick a calm, clear voice.
   - **First message:** "Suit assistant online. How can I help?"
   - **System prompt:**
     ```
     You are the suit assistant for an astronaut on a Marswalk at the Mount Sharp
     boxwork site on Mars. Answer in 1–2 short sentences.
     Use ONLY the mission knowledge base and the get_status tool.
     For any question about oxygen, distance, next stop or safety, call get_status first.
     If the answer is not in the data, say "I don't know."
     Safety first: if oxygen is low or get_status says return, tell the astronaut to go back to base.
     ```
3. **Knowledge base:** upload `mission.json` and a short text file with the stop cards + a boxwork explainer (what boxwork is, why water matters).
4. **Client tool `get_status`:** Tools → Add tool → Type **Client**, name `get_status`, no parameters, **Wait for response = ON**. The HUD runs this function and returns:
   `{ stop, stop_name, dist_next_m, dist_base_m, o2_pct, o2_minutes_left, must_return, rad_uSv_h, temp_c }`
5. **Security:** in the agent's security settings, allow only our website domain (from T1.5). **Never put an API key in the code.** With a public agent, the website only needs the agent ID.
6. **Give FS1 this code** to add to the HUD:
   ```js
   import { Conversation } from "@elevenlabs/client";

   let convo = null;
   async function toggleVoice() {
     if (convo) { await convo.endSession(); convo = null; return; }
     await navigator.mediaDevices.getUserMedia({ audio: true });
     convo = await Conversation.startSession({
       agentId: "YOUR_AGENT_ID",
       clientTools: {
         get_status: async () => JSON.stringify(hud.getStatus())
       },
       onMessage: (m) => hud.showAiText(m.message)
     });
   }
   // when arriving at a stop:
   // convo?.sendContextualUpdate("Astronaut arrived at stop 2: Steep ridge");
   ```
   The button (Cardboard lever or clicker) calls `toggleVoice()`: first press starts listening, second press ends.
7. **Test with 10 questions** and write the results in `ai/tests.md`: "What's at the next stop?", "How much oxygen do I have?", "Can I go on?", "What is boxwork?", "Why is this place important?", "How far is base?", "What should I do here?", "Is the slope dangerous?", "What's the radiation?", "Who won the football match?" (→ "I don't know").

### Output
Working agent + agent ID + the code snippet + test results.

### Done when
- [ ] Agent answers by voice
- [ ] Uses `get_status` for oxygen/distance questions
- [ ] 10/10 test questions correct
- [ ] Only our domain allowed; no API key in code

### Extra
When the AI is unreachable (no signal), the HUD shows "AI offline" and the text of the current stop card.

---

## T1.3 VR simulation: walk on Mars
**Owner:** AI3 · **Folders:** `web/sim/` + `builder/panoramas.py` · **Labels:** `sim` `must`

### Why
Our demo has two parts: a VR walk on Mars and a real desert walk. The simulation lets judges **see Mars** through our HUD, and it's safe because the user stands still.

### Input
- `mission.json` (route, stops, photos)
- Phone compass/gyro (look around) + Bluetooth clicker (walk)

### What to do (easy path: panoramas "on rails")
1. **Panoramas:** for each stop make one wide Mars image:
   - Download that sol's Navcam frames from the same sequence (same `NCAM…` id in the file name) and place them side by side with Python Pillow, **or**
   - Use NASA's published Curiosity panoramas of the boxwork area (NASA Photojournal / science.nasa.gov, 2025–2026).
   Save as `assets/pano_stopN.jpg`.
2. **Look around:** the phone's heading (from `deviceorientation`) slides the panorama left/right. Turning your head turns the view.
3. **Walk on rails:** while the clicker is held, move forward **along the route** at 0.8 m/s. No free walking, so you can't get lost. Between stops, fade from the current panorama to the next one.
4. **Fake GPS:** give the HUD your position like real GPS:
   ```js
   sim.start(mission)          // begin at base
   sim.getPosition()           // -> { mars: [lat, lon], heading: deg }
   sim.getBackground()         // -> { image, offsetPx }  (HUD draws it in both eyes)
   sim.event("dust")           // extra: orange haze
   ```
5. Test on the phone inside the VR box.

**Tools:** plain JavaScript + Python Pillow for stitching.

### Output
`web/sim/sim.js` + `web/mission/assets/pano_stop*.jpg`

### Done when
- [ ] One panorama per stop
- [ ] Looking around works in the VR box
- [ ] Holding the clicker walks you from base to stop 5 along the route
- [ ] `getPosition()` gives correct Mars coordinates (HUD stop cards trigger)

### Extra
3D terrain with A-Frame/three.js from the height map + HiRISE image.

---

## T1.4 Phone HUD: the astronaut's screen
**Owner:** FS1 · **Folder:** `web/hud/` · **Labels:** `hud` `must`

### Why
This is what the astronaut sees, and it's the core of the product. It guides them stop to stop, keeps them safe and shows the science.

### Input
- `mission.json` (T1.1)
- Phone camera, GPS, compass; in sim mode `sim.js` (T1.3)
- Voice snippet (T1.2), live link helper `live.js` (T1.5)

### What to do
1. **Page layout:** plain HTML/CSS/JS (Vite optional). The screen is split into **two identical halves** (left/right eye). Each half has a background (camera video or sim panorama) and the HUD drawn on top. Keep the screen on (Wake Lock API).
2. **Mode switch:** `field` = back camera (`getUserMedia`) + GPS (`watchPosition`) + compass (`deviceorientation`, needs one tap to allow) · `sim` = `sim.getBackground()` + `sim.getPosition()`.
3. **Desert → Mars position (field mode only):**
   ```
   meters from anchor (Earth, R=6371000):  north = R·Δlat,  east = R·cos(lat0)·Δlon   (radians)
   rotate by anchor.rotation_deg, divide by anchor.scale
   Mars position (R=3396190):              Δlat = north/R,  Δlon = east/(R·cos(lat0))
   ```
4. **Navigation:** arrow pointing to the next stop (bearing minus heading), distance in meters, ETA = distance / 0.8 m/s.
5. **Arrival:** within **20 m** of a stop for **3 seconds** → show the stop card (photo, name, task, hazard, science) → call `convo?.sendContextualUpdate(...)` → arrow switches to the next stop.
6. **Readouts:** O₂ %, radiation µSv/h, temperature °C, stop X/5.
7. **Oxygen:** starts at 100 %, drops 0.25 %/min.
8. **Alerts:** `SLOPE_AHEAD` (next route point slope > 12°) · `LOW_O2` (< 30 %) · `RETURN_TO_BASE` (O₂ minutes left < minutes to walk back + 10, and the arrow points home) · messages from Ground Control.
9. **`hud.getStatus()`** returns `{ stop, stop_name, dist_next_m, dist_base_m, o2_pct, o2_minutes_left, must_return, rad_uSv_h, temp_c }`. The voice agent uses it.
10. **Voice button:** Cardboard lever / clicker → `toggleVoice()` (T1.2 code). Show the AI's text at the bottom.
11. **Live link:** every 1 s `live.sendTelemetry({...})`; every 2 s `live.sendPhoto(smallJpeg)` (field mode, 320 px wide). Show messages from `live.onMessage()`.

**Distance/bearing:** use the haversine formula with R = 3,396,190 m (Mars), since all positions are converted to Mars.

### Output
`web/hud/index.html` (+ js/css), deployed by FS2 at `https://<project>.web.app/hud/`

### Done when
- [ ] Two-eye view with camera on the Android phone
- [ ] Arrow + distance correct outdoors
- [ ] Stop cards appear on arrival
- [ ] All alerts can be triggered
- [ ] Sim mode works with `sim.js`
- [ ] Voice button talks to the agent
- [ ] Telemetry + photo appear in Firebase

---

## T1.5 Ground Control + live link + hosting
**Owner:** FS2 · **Folders:** `web/gc/`, `web/live/`, `firebase.json`, `database.rules.json` · **Labels:** `ground-control` `must`

### Why
Ground Control is the second screen judges see: where the astronaut is on Mars, what they see, and whether they're safe. Firebase gives us the live link and HTTPS hosting with no server to build.

### Input
- `mission.json` (T1.1)
- Telemetry + photos from the HUD (via Firebase)

### What to do
1. **Firebase project** (free Spark plan): turn on **Realtime Database** and **Hosting**. Add **Anonymous sign-in** (Authentication).
2. **Hosting:** `firebase init hosting` with **public folder = `web`** → deploys HUD (`/hud/`), Ground Control (`/gc/`), sim, live, voice and mission files together. HTTPS is automatic. Give the URL to everyone (and to AI2 for the ElevenLabs domain allowlist).
3. **Database paths:**
   ```
   /live/telemetry   ← phone writes every 1 s
   /live/photo       ← phone writes every 2 s (base64 JPEG, ~30 KB)
   /live/messages    ← Ground Control writes { text, deliver_at }
   /live/events      ← Ground Control writes { type: "dust" | "solar" | "o2_leak", deliver_at }
   ```
   **Rules:** only signed-in (anonymous) users can read/write, and only under `/live`.
4. **`web/live/live.js` helper** for FS1:
   `sendTelemetry(obj)`, `sendPhoto(b64)`, `onMessage(cb)`, `onEvent(cb)` (phone side) · `onTelemetry(cb)`, `onPhoto(cb)`, `sendMessage(text)`, `sendEvent(type)` (Ground Control side).
5. **Telemetry format** (agree with FS1):
   ```json
   { "t": 1763100000, "mode": "field", "mars": [-4.8061, 137.3795], "heading": 182,
     "stop": 2, "dist_next_m": 41, "dist_base_m": 410,
     "o2_pct": 82, "rad_uSv_h": 28, "temp_c": -60, "alerts": ["SLOPE_AHEAD"] }
   ```
6. **Ground Control page:**
   - **Map:** Leaflet with `crs: L.CRS.EPSG4326`, HiRISE tile URL from mission.json, `maxZoom: 16`. Draw route (colored by slope), stops, and the astronaut dot + heading.
   - **Layer switch** for each layer in `mission.layers`, showing mission + instrument.
   - **Readouts:** O₂, radiation, temperature, stop X/5, distance to base.
   - **Latest camera photo.**
   - **Alert log** with time.
   - **Message box** → `sendMessage`.
   - **Mars delay switch:** when ON, show incoming telemetry N seconds late (keep a queue) and set `deliver_at = now + N` on outgoing messages (the HUD waits until then). Demo N = 20 s; label it "Real Mars: 3–22 min".
   - **Demo event buttons:** dust storm, solar flare, O₂ leak → `sendEvent`.

### Output
Live site: `https://<project>.web.app/gc/` and `/hud/`, plus `live.js`.

### Done when
- [ ] Site live with HTTPS; phone opens `/hud/` with no warning
- [ ] Map shows HiRISE, route, stops, layers
- [ ] Dot + readouts + photo update live from the phone
- [ ] Message from Ground Control appears on the HUD
- [ ] Delay switch works both ways
- [ ] Database rules restrict access to `/live` for signed-in users

---

# SPRINT 2: Together

---

## T2.1 Plug together + indoor run in VR
**Owner:** FS2 (lead) + everyone · **Labels:** `demo` `must`

### Why
Five parts built alone never fit perfectly the first time. This task joins them and proves the **whole mission works in VR simulation** before going outside.

### What to do
1. **Plug together (2–3 h, everyone):** real `mission.json` deployed; HUD uses `sim.js`, `live.js` and the voice agent; Ground Control shows the phone live.
2. **Indoor run** in sim mode with the VR box: base → 5 stops → back to base. Ground Control watching. Ask the agent 5 questions. Trigger one demo event. Turn on the delay switch once.
3. Every problem → a GitHub issue with an owner. Fix, then run again.
4. Record one full run as a **backup video**.

### Done when
- [ ] Full sim run with no restart
- [ ] Agent answers during the run
- [ ] Ground Control follows the whole walk
- [ ] Backup video recorded

---

## T2.2 Desert test with the real camera
**Owner:** FS1 (lead) + AI3 + everyone · **Labels:** `demo` `must`

### Why
It proves the HUD works **outdoors while walking**, like a real Marswalk. NASA tests in Mars-like deserts too, which is a strong point for judges.

### Bring
VR box (Cardboard v2 with lever, white/vented), Bluetooth clicker, 2 power banks + cables, spare phone, laptop, water, a spotter.

### What to do
1. **Place:** flat, safe, open, ≥ 200 m, no cars, and **mobile signal** (check before you go).
2. **Place the stops:** stand at the start, save GPS as `anchor.field`, set `rotation_deg` so the route fits the ground. If a stop lands somewhere unsafe, set its `field` by hand. Keep stops **≥ 30 m apart**. Redeploy mission.json.
3. **Walk hand-held first:** tune the arrival radius and check the compass (remove the VR box magnet if it breaks the compass).
4. **Walk in the VR box** with a spotter beside you, slowly, in short sessions. Watch phone heat; take shade breaks.
5. **Film** the walk + Ground Control at the same time (for T2.3).

### Done when
- [ ] All stops trigger in the desert
- [ ] Ground Control shows the walk on the Mars map
- [ ] One full VR-box walk done safely
- [ ] Footage recorded

---

## T2.3 Video, slides and submission
**Owner:** AI2 + AI3 (video, slides) · FS2 (README, submit) · **Labels:** `demo` `must`

### Why
Judges only see what we submit. A clear video and page decide the result.

### What to do
1. **Video:** split screen with **astronaut view | Ground Control**. Show: VR walk on Mars → desert walk → a question to the agent → an alert (return to base) → the delay switch. Make a 30-second and a 2–3 minute version.
2. **Slides:** update the existing deck with real screenshots.
3. **README:** what it is, NASA data used (missions + instruments), services used, how to run, team.
4. **Submit** on the Space Apps site before the deadline.

### Done when
- [ ] 30 s + long video exported
- [ ] Slides final
- [ ] README lists all NASA data sources
- [ ] Submitted ✅
