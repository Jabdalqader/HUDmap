# web/hud/ (FS1)
Phone HUD: two-eye view, arrow, stop cards, alerts, oxygen, voice button.
Uses: `../mission/mission.json`, `../sim/sim.js`, `../live/live.js`, `../ai/voice.js`.
Task: T1.4 (see the project board)

## Simulation mode (from AI3)
The sim is a **3D view behind the HUD**: give it a full-screen `<div>` under your HUD layer, then use `sim.getPosition()` like GPS and listen to `sim.on("arrive")` / `sim.on("scan")`. Details: `web/sim/README.md`.
