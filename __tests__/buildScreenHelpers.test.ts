import { resolveBuildStatusPresentation, resolveLogsLoadContext } from "../screens/EnhancedBuildScreen/hooks/buildScreenHelpers";

describe("buildScreenHelpers", () => {
  it("maps building progress to percentage label", () => {
    expect(resolveBuildStatusPresentation({ status: "building", progress: 0.42 })).toEqual({
      statusEmoji: "🔨",
      statusLabel: "42%",
    });
  });

  it("maps non-building statuses to uppercase labels", () => {
    expect(resolveBuildStatusPresentation({ status: "queued", progress: 0.42 })).toEqual({
      statusEmoji: "⏳",
      statusLabel: "QUEUED",
    });

    expect(resolveBuildStatusPresentation({ status: "success" })).toEqual({
      statusEmoji: "✅",
      statusLabel: "SUCCESS",
    });
  });

  it("keeps build logs pinned to the active build repo and waits for a runId", () => {
    expect(resolveLogsLoadContext({
      selectedRepoFullName: "owner/selected",
      currentBuildRepoFullName: "owner/build",
      runId: null,
      status: "queued",
    })).toEqual({
      githubRepoForLogs: null,
      shouldLoadLogs: false,
      logsWaitingReason: "Run-ID für den aktiven Build liegt noch nicht vor. Logs werden geladen, sobald der Workflow-Lauf zugeordnet ist.",
    });

    expect(resolveLogsLoadContext({
      selectedRepoFullName: "owner/selected",
      currentBuildRepoFullName: "owner/build",
      runId: 42,
      status: "building",
    })).toEqual({
      githubRepoForLogs: "owner/build",
      shouldLoadLogs: true,
      logsWaitingReason: null,
    });
  });

  it("falls back to the selected repo only for non-active historical runs with runId", () => {
    expect(resolveLogsLoadContext({
      selectedRepoFullName: "owner/selected",
      currentBuildRepoFullName: null,
      runId: 99,
      status: "success",
    })).toEqual({
      githubRepoForLogs: "owner/selected",
      shouldLoadLogs: true,
      logsWaitingReason: null,
    });
  });
});
