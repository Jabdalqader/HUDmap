
import type { MissionStatus, StatusProvider } from "../contracts/MissionStatus";
import type { MissionStop, StopCard } from "../contracts/MissionData";
import type { MissionService } from "./MissionService";
import type { StopCardService } from "./StopCardService";
import { errorMessage } from "../utils/errorMessage";

export interface MissionSnapshot {
  /** Latest live status, or `null` if the status provider failed this time. */
  status: MissionStatus | null;
  statusError: string | null;
  /** Current stop from the latest status, or the last known one if the status failed. */
  stopId: number | null;
  /** Local stop card for `stopId`. Comes from bundled data and doesn't need ElevenLabs. */
  stopCard: StopCard | undefined;
  stopCardError: string | null;
  nextStop: MissionStop | undefined;
  /** True only on the refresh where the astronaut's stop changed. */
  stopChanged: boolean;
}

/**
 * Combines live status (`StatusProvider`) with local mission knowledge
 * (`MissionService`, `StopCardService`). Works without any voice
 * connection, so the HUD can always show the current stop card.
 */
export class MissionContextService {
  private lastStopId: number | null = null;

  constructor(
    private readonly statusProvider: StatusProvider,
    private readonly missionService: MissionService,
    private readonly stopCardService: StopCardService,
  ) {}

  async refresh(): Promise<MissionSnapshot> {
    let status: MissionStatus | null = null;
    let statusError: string | null = null;
    try {
      status = await this.statusProvider.getStatus();
    } catch (error) {
      statusError = errorMessage(error);
    }

    const stopId = status?.stop ?? this.lastStopId;
    const stopChanged = status !== null && status.stop !== this.lastStopId;
    if (status) this.lastStopId = status.stop;

    let stopCard: StopCard | undefined;
    let nextStop: MissionStop | undefined;
    let stopCardError: string | null = null;
    if (stopId !== null) {
      try {
        stopCard = await this.stopCardService.getStopCard(stopId);
        nextStop = await this.missionService.getNextStop(stopId);
      } catch (error) {
        stopCardError = errorMessage(error);
      }
    }

    return { status, statusError, stopId, stopCard, stopCardError, nextStop, stopChanged };
  }
}

/**
 * Text for an ElevenLabs contextual update when the astronaut reaches a stop.
 * Built only from local mission data, never from invented details.
 */
export function describeStopArrival(snapshot: MissionSnapshot): string | null {
  const { stopId, stopCard, nextStop } = snapshot;
  if (stopId === null) return null;

  if (!stopCard) {
    return (
      `The astronaut has arrived at stop ${stopId}. No stop card is available for this stop. ` +
      "Do not invent its location details or tasks."
    );
  }

  const parts = [
    `The astronaut has arrived at stop ${stopCard.stopId}: ${stopCard.title}.`,
    stopCard.description,
    stopCard.tasks.length > 0
      ? `Planned tasks: ${stopCard.tasks.join("; ")}.`
      : "No planned tasks are listed for this stop.",
    nextStop ? `Next planned stop: ${nextStop.id}. ${nextStop.name}.` : "This is the last planned stop.",
  ];
  if (stopCard.source === "mock") {
    parts.push("Note: this stop information is MOCK demonstration data, not official mission data.");
  }
  parts.push("For live oxygen, distance, radiation and temperature values, call get_status.");
  return parts.join(" ");
}
