
import type {
  MissionData,
  MissionDataProvider,
  MissionDataSource,
} from "../contracts/MissionData";
import { normalizeMissionData } from "../adapters/missionDataAdapter";

/** Supplies raw (unvalidated) mission JSON: a bundled import, a fetch, a test fixture, etc. */
export type RawMissionLoader = () => unknown | Promise<unknown>;

/**
 * Loads raw mission JSON through an injected loader and normalizes it through
 * the mission data adapter. Use it for the official T1.1 `mission.json`.
 *
 * The result is cached after the first successful load, so the HUD keeps
 * working offline once the data has loaded. A failed load isn't cached and
 * can be retried.
 */
export class JsonMissionDataProvider implements MissionDataProvider {
  private cached?: Promise<MissionData>;

  constructor(
    private readonly loadRaw: RawMissionLoader,
    private readonly source: MissionDataSource = "official",
  ) {}

  getMission(): Promise<MissionData> {
    if (!this.cached) {
      this.cached = Promise.resolve()
        .then(() => this.loadRaw())
        .then((raw) => normalizeMissionData(raw, { source: this.source }));
      this.cached.catch(() => {
        this.cached = undefined;
      });
    }
    return this.cached;
  }
}
