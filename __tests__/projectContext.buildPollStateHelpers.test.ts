import {
  getBuildStatusMessage,
  mergeBuildPollIntoCurrentBuild,
} from "../contexts/projectContextStateHelpers";

describe("projectContextStateHelpers build poll state mapping", () => {
  it("keeps existing urls when poll details omit them", () => {
    const merged = mergeBuildPollIntoCurrentBuild({
      previous: {
        status: "queued",
        urls: {
          html: "https://example.com/old-html",
          artifacts: "https://example.com/old-artifacts",
          buildUrl: null,
        },
      },
      activeJobId: "job-1",
      details: {
        jobId: "job-1",
        status: "building",
        runId: 1,
        sourceCommitSha: "abc123",
        raw: null,
      },
      status: "building",
      lastError: null,
      nowIso: "2026-04-05T00:00:00.000Z",
    });

    expect(merged.urls).toEqual({
      html: "https://example.com/old-html",
      artifacts: "https://example.com/old-artifacts",
      buildUrl: null,
    });
    expect(merged.runId).toBe(1);
    expect(merged.sourceCommitSha).toBe("abc123");
  });

  it("sets completedAt only for final/error states", () => {
    const successState = mergeBuildPollIntoCurrentBuild({
      previous: { status: "building" },
      activeJobId: "job-1",
      details: null,
      status: "success",
      nowIso: "2026-04-05T00:00:01.000Z",
    });
    expect(successState.completedAt).toBe("2026-04-05T00:00:01.000Z");

    const buildingState = mergeBuildPollIntoCurrentBuild({
      previous: { status: "building", completedAt: "2026-04-05T00:00:01.000Z" },
      activeJobId: "job-1",
      details: null,
      status: "building",
      nowIso: "2026-04-05T00:00:02.000Z",
    });
    expect(buildingState.completedAt).toBe("2026-04-05T00:00:01.000Z");
  });

  it("builds status messages for polling states", () => {
    expect(getBuildStatusMessage({ status: "queued" })).toContain("Warteschlange");
    expect(getBuildStatusMessage({ status: "building" })).toContain("Build läuft");
    expect(getBuildStatusMessage({ status: "error", lastError: "Timeout" })).toContain("Timeout");
  });
});
