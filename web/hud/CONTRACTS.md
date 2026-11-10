# What the HUD needs from the other tasks

Until a part is deployed, the HUD uses a stand-in from `/hud/dev`, so nobody is blocked.
Paths are set in `js/config.js`.

## T1.1 mission.json (served at `/mission.json`)
```json
{
  "anchor": { "mars": [lat, lon], "field": [lat, lon] | null, "rotation_deg": 0, "scale": 1.0 },
  "route": [{ "mars": [lat, lon], "slope_deg": 8.6 }],
  "stops": [{ "id": 1, "name": "...", "mars": [lat, lon], "photo": "url",
              "task": "...", "hazard": "...", "science": "...",
              "conditions": { "temp_c": -48, "rad_uSv_h": 27.9 } }],
  "suit": { "o2_start_pct": 100, "o2_pct_per_min": 0.25, "walk_speed_mps": 0.8 }
}
```
- **rotation_deg**: how far Mars offsets turn **clockwise** to land in the desert. Use `js/core/twin.js` (`marsToField`) so both sides agree.
- **scale**: desert metres per Mars metre.
- **anchor.field = null**: the first good GPS fix (±20 m) becomes base.
- **route[].slope_deg**: slope from this point to the next one. Needed for the steep-ground alert.
- Example built from real Curiosity data: `dev/sample-mission.json`.

## T1.2 voice (module at `/voice/voice.js`)
- `toggleVoice()`: start/stop talking (the Cardboard lever calls it).
- `convo` or `getConversation()` with `sendContextualUpdate(text)`: the HUD tells the agent about arrivals and return-to-base.
- `onAgentText(callback)`: hands the agent's words to the HUD for the bottom of the screen.
- Optional `isListening()`: shows a red dot while listening.
- The agent reads the walk state from `window.hud.getStatus()`.

## T1.3 sim (module at `/sim/sim.js`)
- `getPosition()` → `{ lat, lon, heading }` on **Mars** (heading in degrees from Mars north).
- `getBackground()` → an image, canvas or video to draw behind the HUD.
- Optional `start()`, `stop()`, `jumpToStop(index)` (used by the demo panel).

## T1.5 live (module at `/live/live.js`)
- `sendTelemetry(object)`: called every second.
- `sendPhoto(blob)`: a 320 px wide JPEG every 2 seconds, field mode only.
- `onMessage(callback)`: Ground Control messages, either a string or `{ text }`.
- As far as we know, new Firebase file storage needs the paid plan, so consider saving the latest photo as text in a database document.

Each module can export these by name, as `default`, or as an object (`live`, `sim`).
