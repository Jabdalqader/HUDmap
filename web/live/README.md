# web/live/ (T1.5): live link phone ↔ Ground Control

`live.js` is loaded by the HUD. It streams the HUD screen (camera or 3D Mars + HUD) as **live video** to Ground Control, sends the telemetry every second, and receives messages and events.

- How: WebRTC through the free **PeerJS** service (no account). `vendor/peerjs.min.js` (MIT).
- **Room code:** shown on the HUD under COMMS ("Ground Control code K7Q2XM"). Fix one with `/hud/?room=MYCODE`.
- Who can watch: anyone who knows the room code (nothing private is sent: Mars view, HUD numbers).
- Backup: a small screenshot every 2 s if the video can't play.
- Tip: if it won't connect on mobile data, connect the Ground Control laptop to the **phone's hotspot**.
