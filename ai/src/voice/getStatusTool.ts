
import type { MissionStatus, StatusProvider } from "../contracts/MissionStatus";
import type { ClientToolHandler } from "../contracts/VoiceSession";
import { errorMessage } from "../utils/errorMessage";

/** Must match the client tool name configured on the ElevenLabs agent exactly. */
export const GET_STATUS_TOOL_NAME = "get_status";

export const DEFAULT_STATUS_TIMEOUT_MS = 5000;

const NUMERIC_FIELDS = [
  "stop",
  "dist_next_m",
  "dist_base_m",
  "o2_pct",
  "o2_minutes_left",
  "rad_uSv_h",
  "temp_c",
] as const satisfies readonly (keyof MissionStatus)[];

export class StatusUnavailableError extends Error {
  constructor(reason: string) {
    super(
      `Live astronaut status is unavailable (${reason}). ` +
        "Do not estimate or invent oxygen, distance, radiation, temperature or stop values. " +
        "Tell the astronaut that live status could not be read and to check the HUD directly.",
    );
    this.name = "StatusUnavailableError";
  }
}

export interface GetStatusToolOptions {
  timeoutMs?: number;
  /** Notified of every call outcome, e.g. for a UI log. */
  onResult?: (result: { ok: true; status: MissionStatus } | { ok: false; error: string }) => void;
}

/**
 * Build the `get_status` client tool around an injected `StatusProvider`
 * (mock or HUD). It returns the status as JSON exactly as the provider
 * reported it.
 *
 * If the status is late, missing, or malformed, it throws, so the SDK sends
 * `is_error: true` with an explanation to the agent. It never returns
 * substitute values.
 */
export function createGetStatusTool(
  statusProvider: StatusProvider,
  options: GetStatusToolOptions = {},
): ClientToolHandler {
  const timeoutMs = options.timeoutMs ?? DEFAULT_STATUS_TIMEOUT_MS;

  return async () => {
    try {
      const status = await withTimeout(statusProvider.getStatus(), timeoutMs);
      assertMissionStatus(status);
      options.onResult?.({ ok: true, status });
      return JSON.stringify(status);
    } catch (error) {
      const failure =
        error instanceof StatusUnavailableError ? error : new StatusUnavailableError(errorMessage(error));
      options.onResult?.({ ok: false, error: failure.message });
      throw failure;
    }
  };
}

/** Runtime check at the HUD boundary: rejects missing or non-numeric readings. */
export function assertMissionStatus(value: unknown): asserts value is MissionStatus {
  if (typeof value !== "object" || value === null) {
    throw new StatusUnavailableError("status provider returned no data");
  }
  const record = value as Record<string, unknown>;
  const bad: string[] = NUMERIC_FIELDS.filter(
    (key) => typeof record[key] !== "number" || !Number.isFinite(record[key]),
  );
  if (typeof record.must_return !== "boolean") bad.push("must_return");
  if (typeof record.stop_name !== "string") bad.push("stop_name");
  if (bad.length > 0) {
    throw new StatusUnavailableError(`invalid or missing fields: ${bad.join(", ")}`);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`status provider timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
