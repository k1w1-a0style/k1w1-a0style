import {
  POLL_INTERVALS_MS,
  POLL_MAX_INTERVAL_MS,
  getBuildStatusPollInterval,
} from "../hooks/buildStatusTypes";

describe("buildStatusTypes adaptive polling", () => {
  it("starts with the shortest interval for a fresh build", () => {
    expect(
      getBuildStatusPollInterval({ errorCount: 0, elapsedMs: 0 }),
    ).toBe(POLL_INTERVALS_MS[0]);
  });

  it("backs off over time for long-running builds", () => {
    expect(
      getBuildStatusPollInterval({ errorCount: 0, elapsedMs: 130_000 }),
    ).toBe(POLL_INTERVALS_MS[1]);
    expect(
      getBuildStatusPollInterval({ errorCount: 0, elapsedMs: 260_000 }),
    ).toBe(POLL_INTERVALS_MS[2]);
    expect(
      getBuildStatusPollInterval({ errorCount: 0, elapsedMs: 600_000 }),
    ).toBe(POLL_MAX_INTERVAL_MS);
  });

  it("jumps to max interval after repeated transient errors", () => {
    expect(
      getBuildStatusPollInterval({ errorCount: 3, elapsedMs: 10_000 }),
    ).toBe(POLL_MAX_INTERVAL_MS);
  });
});
