
import type {
  MissionData,
  MissionDataProvider,
  StopCard,
  StopCardProvider,
} from "../contracts/MissionData";

/** Build stop cards from normalized mission data. Pure and deterministic. */
export function buildStopCards(mission: MissionData): StopCard[] {
  return mission.stops.map((stop) => ({
    stopId: stop.id,
    title: stop.name,
    description: stop.description,
    tasks: [...stop.tasks],
    missionId: mission.missionId,
    source: mission.source,
  }));
}

/**
 * Builds stop cards from whatever `MissionDataProvider` is injected (mock or
 * official), so stop details have a single source of truth.
 *
 * If T1.1 ships separate official stop-card files, add another
 * `StopCardProvider` and select it in the composition root
 * (docs/REPLACING_MOCK_DATA.md, Scenario C).
 */
export class MissionStopCardProvider implements StopCardProvider {
  constructor(private readonly missionProvider: MissionDataProvider) {}

  async getStopCards(): Promise<StopCard[]> {
    return buildStopCards(await this.missionProvider.getMission());
  }
}
