import {
  buildDispatchFailurePatch,
  buildReconciliationPatch,
  mapGitHubRunToBuildStatus,
  resolveDispatchRef,
  shouldReconcileBuildStatus,
} from "../supabase/functions/_shared/buildJobConsistency";

describe("build job consistency helpers", () => {
  it("creates deterministic dispatch failure patch", () => {
    const patch = buildDispatchFailurePatch({
      statusCode: 422,
      sourceCommitSha: "abc123",
      nowIso: "2026-04-11T00:00:00.000Z",
    });
    expect(patch).toEqual({
      status: "error",
      completed_at: "2026-04-11T00:00:00.000Z",
      error_message: "dispatch_failed:422",
      source_commit_sha: "abc123",
    });
  });

  it("maps github terminal states to build status truthfully", () => {
    expect(mapGitHubRunToBuildStatus("completed", "success")).toBe("completed");
    expect(mapGitHubRunToBuildStatus("completed", "failure")).toBe("error");
    expect(mapGitHubRunToBuildStatus("in_progress", null)).toBeNull();
  });

  it("reconciles only stale non-terminal db statuses", () => {
    expect(shouldReconcileBuildStatus("queued", "error")).toBe(true);
    expect(shouldReconcileBuildStatus("building", "completed")).toBe(true);
    expect(shouldReconcileBuildStatus("completed", "error")).toBe(false);
    expect(shouldReconcileBuildStatus("failed", "completed")).toBe(false);
    expect(shouldReconcileBuildStatus("queued", null)).toBe(false);
  });

  it("prefers source commit sha for deterministic dispatch ref selection", () => {
    expect(resolveDispatchRef("main", "abc123")).toBe("abc123");
    expect(resolveDispatchRef("main", "")).toBe("main");
    expect(resolveDispatchRef("release/x", null)).toBe("release/x");
  });

  it("creates reconciliation patch for stale success writeback loss", () => {
    const result = buildReconciliationPatch({
      currentStatus: "building",
      runStatus: "completed",
      runConclusion: "success",
      existingErrorMessage: null,
      nowIso: "2026-04-12T00:00:00.000Z",
    });
    expect(result).toEqual({
      nextStatus: "completed",
      patch: {
        status: "completed",
        completed_at: "2026-04-12T00:00:00.000Z",
        error_message: null,
      },
    });
  });

  it("creates reconciliation patch for stale failure writeback loss", () => {
    const result = buildReconciliationPatch({
      currentStatus: "queued",
      runStatus: "completed",
      runConclusion: "failure",
      existingErrorMessage: null,
      nowIso: "2026-04-12T00:00:00.000Z",
    });
    expect(result).toEqual({
      nextStatus: "error",
      patch: {
        status: "error",
        completed_at: "2026-04-12T00:00:00.000Z",
        error_message: "Reconciled from GitHub terminal state",
      },
    });
  });

  it("does not reconcile already terminal db statuses", () => {
    expect(buildReconciliationPatch({
      currentStatus: "completed",
      runStatus: "completed",
      runConclusion: "failure",
      existingErrorMessage: "already done",
    })).toBeNull();
  });
});
