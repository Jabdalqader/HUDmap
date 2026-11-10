import { describe, expect, it } from "vitest";
import officialMission from "../../web/mission/mission.json";
import { normalizeMissionData } from "../src/adapters/missionDataAdapter";

// The official T1.1 file (web/mission/mission.json) must load into the assistant.
describe("official mission.json", () => {
  const mission = normalizeMissionData(officialMission, { source: "official" });

  it("loads the 5 science stops (base skipped)", () => {
    expect(mission.stops.map((s) => s.id)).toEqual([1, 2, 3, 4, 5]);
  });
  it("maps task and science into tasks and description", () => {
    expect(mission.stops[1].tasks[0]).toMatch(/central fracture/);
    expect(mission.stops[1].description).toMatch(/fracture/);
  });
});
