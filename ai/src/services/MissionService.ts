
import type {
  MissionData,
  MissionDataProvider,
  MissionStop,
} from "../contracts/MissionData";

/**
 * Mission knowledge queries for the assistant. It depends only on the
 * `MissionDataProvider` interface, so the mock and official data can be
 * swapped without changing this class.
 */
export class MissionService {
  constructor(private readonly missionProvider: MissionDataProvider) {}

  getMission(): Promise<MissionData> {
    return this.missionProvider.getMission();
  }

  /** Returns `undefined` for an unknown stop id. Never makes up a stop. */
  async getStop(stopId: number): Promise<MissionStop | undefined> {
    const mission = await this.missionProvider.getMission();
    return mission.stops.find((stop) => stop.id === stopId);
  }

  /** Returns the stop after `stopId` in planned order, or `undefined` if there isn't one. */
  async getNextStop(stopId: number): Promise<MissionStop | undefined> {
    const { stops } = await this.missionProvider.getMission();
    const index = stops.findIndex((stop) => stop.id === stopId);
    return index === -1 ? undefined : stops[index + 1];
  }

  async isMockData(): Promise<boolean> {
    return (await this.missionProvider.getMission()).source === "mock";
  }
}
