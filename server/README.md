# server/: local link (runs on the Ground Control laptop)

Phone and laptop on **one network** (the phone's hotspot). The laptop serves the pages and relays the live view, data and messages. No internet needed for the link (the voice agent still needs internet).

```bash
node server/server.mjs                  # uses the laptop's hotspot / Wi-Fi address
node server/server.mjs --host 172.20.10.3 --port 8443
```
It prints two links:
- **Phone:** `https://<laptop-ip>:8443/hud/`
- **Ground Control:** `https://<laptop-ip>:8443/gc/`

First time on each device the browser says **"Your connection is not private"** → **Advanced** → **Proceed**. (It's the laptop's own certificate, made on first run in `server/certs/`, not committed.) On a Mac, click **Allow** if it asks about incoming connections for `node`.

- Live view: the phone sends one picture as soon as the last one arrived, so lag never builds up.
- Data and messages: server-sent events, which reconnect by themselves.
- Who can reach it: devices on that network only (it binds to one address, not all). Stop with Ctrl+C.
