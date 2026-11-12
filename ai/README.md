# ai/ (AI2)
ElevenLabs agent setup: `prompt.md` (system prompt), `knowledge/` (files uploaded to the agent), `tests.md` (10 test questions + results).
The agent ID is not secret, but **never commit the ElevenLabs API key**.
Task: T1.2 in docs/backlog.md



## Local Development

Install dependencies:

```bash
cd ai
npm ci
```

Create `.env.local` using `.env.example` and configure:

```dotenv
VITE_ELEVENLABS_AGENT_ID=YOUR_AGENT_ID
VITE_MISSION_DATA_SOURCE=mock
```

Run the application:

```bash
npm run dev
```

Run automated tests and production build:

```bash
npm run check
npm run build
```

## Testing

- 66/66 automated tests passed.
- 10/10 voice questions answered correctly using mock data.
- Emergency return test passed.
- HUD outage test passed.
- AI offline fallback test passed.

See `tests.md` for detailed results.

## Pending Integration

- Replace mock mission data with official `mission.json` from T1.1.
- Connect the real HUD using `HudStatusProvider`.
- Configure the production domain allowlist using the T1.5 website domain.

## Security Note

ElevenLabs rejected local development hosts such as
`localhost:5173` and `127.0.0.1:5173` in its allowlist.

The public agent must be restricted to the final website
domain before production deployment.

Never put an ElevenLabs API key in frontend code.

## Replacing Mock Data

See `docs/REPLACING_MOCK_DATA.md`.

## HUD integration (merged)
- `src/hudBridge.ts` exposes the assistant to the HUD as `toggleVoice()`, `getConversation().sendContextualUpdate()`, `onAgentText()`, `isListening()`, reading live status from `window.hud.getStatus()`.
- Build it into the website with `npm run build:hud` → `web/ai/voice.js` (copies the official `web/mission/mission.json` into `src/data/` and builds with `VITE_MISSION_DATA_SOURCE=official`).
- Agent ID: put it in `.env.local` (`VITE_ELEVENLABS_AGENT_ID=...`) before `npm run build:hud`, or open the HUD with `?agent=<id>`.
- `src/adapters/missionDataAdapter.ts` now also reads the official schema: skips the stop marked `"is_base": true`, maps `science` → `description` and `task` → `tasks`. Test: `tests/officialMission.test.ts`. All 68 tests pass.
