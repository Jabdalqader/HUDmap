
import { describe, it, expect } from "vitest";
import { MockStatusProvider } from "../src/providers/MockStatusProvider";
import { HudStatusProvider } from "../src/providers/HudStatusProvider";

describe("Status Providers", () => {
  it("returns mock astronaut status", async () => {
    const provider = new MockStatusProvider();

    const status = await provider.getStatus();

    expect(status.o2_pct).toBe(82);
    expect(status.stop).toBe(2);
    expect(status.must_return).toBe(false);
  });

  it("accepts an injected HUD", async () => {
    const fakeHud = {
      getStatus: () => ({
        stop: 3,
        stop_name: "Test stop",
        dist_next_m: 20,
        dist_base_m: 500,
        o2_pct: 65,
        o2_minutes_left: 250,
        must_return: false,
        rad_uSv_h: 28,
        temp_c: -60,
      }),
    };

    const provider = new HudStatusProvider(fakeHud);
    const status = await provider.getStatus();

    expect(status.stop).toBe(3);
    expect(status.o2_pct).toBe(65);
  });
});
