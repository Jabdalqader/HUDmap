
import type {
  MissionDataProvider,
  MissionDataSource,
  StopCardProvider,
} from "../contracts/MissionData";
import { JsonMissionDataProvider } from "../providers/JsonMissionDataProvider";
import { MockMissionDataProvider } from "../providers/MockMissionDataProvider";
import { MissionStopCardProvider } from "../stopCards/MissionStopCardProvider";
import { MissionService } from "../services/MissionService";
import { StopCardService } from "../services/StopCardService";

/**
 * COMPOSITION ROOT for mission data.
 *
 * This is the only module that picks concrete providers. Services and
 * business logic receive interfaces through their constructors.
 *
 * Switch mock or official data with the VITE_MISSION_DATA_SOURCE env var
 * ("mock" | "official"). The default is "mock". See docs/REPLACING_MOCK_DATA.md.
 */

/** Expected location of the official T1.1 file. */
export const OFFICIAL_MISSION_FILE = "src/data/mission.json";

// Eager glob: bundles the official file into the app if it exists (works
// offline after load), and gives `{}` instead of a build error while it's
// missing.
const officialMissionFiles = import.meta.glob("../data/mission.json", {
  eager: true,
  import: "default",
});

export function resolveMissionDataSource(
  value: string | undefined = import.meta.env.VITE_MISSION_DATA_SOURCE,
): MissionDataSource {
  if (value === undefined || value === "") return "mock";
  if (value === "mock" || value === "official") return value;
  throw new Error(
    `Invalid VITE_MISSION_DATA_SOURCE "${value}". Expected "mock" or "official".`,
  );
}

export function createMissionDataProvider(
  source: MissionDataSource = resolveMissionDataSource(),
  /** Overridable for tests. In the app this is the bundled glob result. */
  officialFiles: Record<string, unknown> = officialMissionFiles,
): MissionDataProvider {
  if (source === "mock") {
    return new MockMissionDataProvider();
  }
  return new JsonMissionDataProvider(() => {
    const raw = Object.values(officialFiles)[0];
    if (raw === undefined) {
      throw new Error(
        `Official mission data requested but ${OFFICIAL_MISSION_FILE} was not found. ` +
          `Add the T1.1 file there, or set VITE_MISSION_DATA_SOURCE=mock.`,
      );
    }
    return raw;
  }, "official");
}

export function createStopCardProvider(
  missionProvider: MissionDataProvider,
): StopCardProvider {
  // Scenario C: if official stop cards arrive as separate files, return that
  // provider here instead. See docs/REPLACING_MOCK_DATA.md.
  return new MissionStopCardProvider(missionProvider);
}

export interface MissionDataServices {
  missionProvider: MissionDataProvider;
  missionService: MissionService;
  stopCardService: StopCardService;
}

/** Wire up all mission data services. Call this once at app startup. */
export function createMissionDataServices(
  source: MissionDataSource = resolveMissionDataSource(),
): MissionDataServices {
  const missionProvider = createMissionDataProvider(source);
  return {
    missionProvider,
    missionService: new MissionService(missionProvider),
    stopCardService: new StopCardService(createStopCardProvider(missionProvider)),
  };
}
