
import mockMission from "../data/mission.mock.json";
import { JsonMissionDataProvider } from "./JsonMissionDataProvider";

/**
 * MOCK mission data provider.
 *
 * Serves the FICTIONAL demo mission in `src/data/mission.mock.json`. This is
 * NOT official NASA or T1.1 mission data. Data it returns has
 * `source: "mock"`.
 *
 * It goes through the same adapter as the official data, so the mock data is
 * validated the same way.
 */
export class MockMissionDataProvider extends JsonMissionDataProvider {
  constructor() {
    super(() => mockMission, "mock");
  }
}
