
import { describe, it, expect } from "vitest";
import { MissionContextService, describeStopArrival } from "../src/services/MissionContextService";
import { MissionService } from "../src/services/MissionService";
import { StopCardService } from "../src/services/StopCardService";
import { MissionStopCardProvider } from "../src/stopCards/MissionStopCardProvider";
import { MockMissionDataProvider } from "../src/providers/MockMissionDataProvider";
import { MockStatusProvider } from "../src/providers/MockStatusProvider";
import { SimulatedStatusProvider } from "../src/dev/SimulatedStatusProvider";

function setup() {
  const status = new SimulatedStatusProvider(new MockStatusProvider());
  const missionProvider = new MockMissionDataProvider();
  const context = new MissionContextService(
    status,
    new MissionService(missionProvider),
    new StopCardService(new MissionStopCardProvider(missionProvider)),
  );
  return { status, context };
}

describe("MissionContextService", () => {
  it("resolves the current stop card from live status and local mission data", async () => {
    const { context } = setup();
    const snapshot = await context.refresh();
    expect(snapshot.stopId).toBe(2);
    expect(snapshot.stopCard?.title).toBe("Steep ridge");
    expect(snapshot.nextStop?.name).toBe("Boxwork Formation");
    expect(snapshot.statusError).toBeNull();
  });

  it("flags a stop change only when the astronaut arrives somewhere new", async () => {
    const { context, status } = setup();
    expect((await context.refresh()).stopChanged).toBe(true);
    expect((await context.refresh()).stopChanged).toBe(false);

    status.simulateStop(3, "Boxwork Formation");
    const arrived = await context.refresh();
    expect(arrived.stopChanged).toBe(true);
    expect(arrived.stopCard?.stopId).toBe(3);
  });

  it("offline fallback: keeps showing the last known stop card when status fails", async () => {
    const { context, status } = setup();
    await context.refresh();
    status.simulateOutage(true);

    const snapshot = await context.refresh();
    expect(snapshot.status).toBeNull(); // no stale or made-up live values
    expect(snapshot.statusError).toContain("Simulated HUD outage");
    expect(snapshot.stopId).toBe(2);
    expect(snapshot.stopCard?.title).toBe("Steep ridge");
    expect(snapshot.stopChanged).toBe(false);
  });

  it("reports an unknown stop without inventing a card", async () => {
    const { context, status } = setup();
    status.simulateStop(42, "Unknown");
    const snapshot = await context.refresh();
    expect(snapshot.stopCard).toBeUndefined();
    expect(describeStopArrival(snapshot)).toContain("No stop card is available");
  });

  it("returns nothing to show before any status has ever been received", async () => {
    const { context, status } = setup();
    status.simulateOutage(true);
    const snapshot = await context.refresh();
    expect(snapshot.stopId).toBeNull();
    expect(describeStopArrival(snapshot)).toBeNull();
  });
});

describe("describeStopArrival", () => {
  it("builds the contextual update from the stop card and marks mock data", async () => {
    const { context } = setup();
    const text = describeStopArrival(await context.refresh())!;
    expect(text).toContain("arrived at stop 2: Steep ridge");
    expect(text).toContain("Observe ridge structures; Document visible patterns");
    expect(text).toContain("Next planned stop: 3. Boxwork Formation");
    expect(text).toContain("MOCK demonstration data");
    expect(text).toContain("call get_status");
    expect(text).not.toMatch(/\d+\s*%|µSv|°C/); // no live values copied in
  });

  it("notes the last stop", async () => {
    const { context, status } = setup();
    status.simulateStop(3, "Boxwork Formation");
    expect(describeStopArrival(await context.refresh())).toContain("This is the last planned stop.");
  });
});
