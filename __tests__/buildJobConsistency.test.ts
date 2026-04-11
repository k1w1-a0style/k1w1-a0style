import {
  buildDispatchFailurePatch,
  mapGitHubRunToBuildStatus,
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
});
