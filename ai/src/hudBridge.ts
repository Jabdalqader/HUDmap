/**
 * HUD BRIDGE: exposes the voice assistant in the shape the Phone HUD (T1.4) expects.
 *
 * Built into `web/ai/voice.js` with `npm run build:hud`. The HUD loads it and calls:
 *   toggleVoice()            start / stop talking (Cardboard lever or clicker)
 *   getConversation()        -> { sendContextualUpdate(text) }   (arrivals, return-to-base)
 *   onAgentText(callback)    the agent's words, shown at the bottom of the HUD
 *   isListening()            true while connected (red dot on the HUD)
 *
 * Live status comes from `window.hud.getStatus()` (the HUD sets it).
 * Agent ID (public, not a secret): `?agent=` in the URL, `window.MARS_AGENT_ID`,
 * or VITE_ELEVENLABS_AGENT_ID at build time.
 */
import { createAssistantApp } from "./config/appComposition";
import type { MissionStatus } from "./contracts/MissionStatus";

type HudStatus = Partial<Record<keyof MissionStatus, unknown>> | null | undefined;
type HudWindow = Window & { hud?: { getStatus?: () => HudStatus }; MARS_AGENT_ID?: string };

function resolveAgentId(): string | undefined {
  const w = window as HudWindow;
  return (
    new URLSearchParams(location.search).get("agent") ||
    w.MARS_AGENT_ID ||
    import.meta.env.VITE_ELEVENLABS_AGENT_ID ||
    undefined
  );
}

/** Reads the HUD's status. While walking back to base the HUD reports stop = null: that is stop 0 (base). */
function readHudStatus(): MissionStatus {
  const status = (window as HudWindow).hud?.getStatus?.();
  if (!status) throw new Error("HUD status is not ready yet");
  return { ...status, stop: status.stop ?? 0 } as MissionStatus;
}

const app = createAssistantApp({ hud: { getStatus: readHudStatus }, agentId: resolveAgentId() });
const assistant = app.voiceAssistant;
const textListeners = new Set<(text: string) => void>();

assistant.subscribe((event) => {
  if (event.type === "transcript" && event.role === "agent") textListeners.forEach((cb) => cb(event.text));
  if (event.type === "error") textListeners.forEach((cb) => cb(`AI offline: ${event.message}`));
});

export async function toggleVoice(): Promise<void> {
  if (assistant.getState() === "disconnected") await assistant.start();
  else await assistant.stop();
}

export function getConversation() {
  return { sendContextualUpdate: (text: string) => assistant.updateMissionContext(text) };
}

export function onAgentText(callback: (text: string) => void): () => void {
  textListeners.add(callback);
  return () => textListeners.delete(callback);
}

export function isListening(): boolean {
  return assistant.isConnected();
}
