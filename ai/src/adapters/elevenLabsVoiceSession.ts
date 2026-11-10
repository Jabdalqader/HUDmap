
import { Conversation } from "@elevenlabs/client";
import type {
  StartVoiceSession,
  VoiceDisconnect,
  VoiceSession,
} from "../contracts/VoiceSession";

/**
 * ElevenLabs implementation of `StartVoiceSession` (`@elevenlabs/client`
 * 1.35). It's the only module that imports the SDK.
 *
 * It uses the public-agent mechanism: just the agent ID, with no API key or
 * signed URL. The agent must be public (authentication off) in the
 * ElevenLabs dashboard.
 */
export const startElevenLabsVoiceSession: StartVoiceSession = async ({
  agentId,
  clientTools,
  callbacks,
}) => {
  const conversation = await Conversation.startSession({
    agentId,
    textOnly: false,
    clientTools,
    onMessage: ({ role, message }) => callbacks.onMessage({ role, text: message }),
    onModeChange: ({ mode }) => callbacks.onModeChange(mode),
    onError: (message) => callbacks.onError(message),
    onDisconnect: (details) => {
      const mapped: VoiceDisconnect =
        details.reason === "error"
          ? { reason: "error", message: details.message }
          : { reason: details.reason };
      callbacks.onDisconnect(mapped);
    },
  });

  const session: VoiceSession = {
    id: conversation.getId(),
    sendContextualUpdate: (text) => conversation.sendContextualUpdate(text),
    endSession: () => conversation.endSession(),
  };
  return session;
};
