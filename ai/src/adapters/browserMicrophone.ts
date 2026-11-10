
import { errorMessage } from "../utils/errorMessage";

/**
 * Ask for microphone permission before connecting, so a denied or missing
 * microphone shows up as a clear error and no ElevenLabs session is opened.
 * The test stream is stopped right away; the SDK opens its own stream.
 */
export async function requestBrowserMicrophone(
  mediaDevices: Pick<MediaDevices, "getUserMedia"> | undefined = globalThis.navigator?.mediaDevices,
): Promise<void> {
  if (!mediaDevices?.getUserMedia) {
    throw new Error(
      "Microphone API unavailable. Open the app over HTTPS or http://localhost in a modern browser.",
    );
  }
  try {
    const stream = await mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new Error("Microphone permission was denied. Allow microphone access for this site and try again.");
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      throw new Error("No microphone was found. Connect a microphone and try again.");
    }
    if (name === "NotReadableError") {
      throw new Error("The microphone is in use by another application or could not be started.");
    }
    throw new Error(`Could not access the microphone: ${errorMessage(error)}`);
  }
}
