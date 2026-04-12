import { runTriggerBuildFlow } from "../supabase/functions/trigger-eas-build/flow";

describe("trigger-eas-build route-like flow behavior", () => {
  it("falls back to branch dispatch when SHA lookup is unavailable", async () => {
    const dispatch = jest.fn(async () => ({ ok: true, status: 204, bodyText: "" }));
    const insert = jest.fn(async () => ({ id: 123 }));

    const result = await runTriggerBuildFlow(
      {
        githubRepo: "owner/repo",
        buildProfile: "preview",
        branch: "feature/x",
      },
      {
        resolveCommitSha: async () => null,
        insertBuildJob: insert,
        dispatchBuild: dispatch,
        patchBuildJobOnDispatchFailure: async () => undefined,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sourceCommitSha).toBeNull();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        client_payload: expect.objectContaining({
          ref: "feature/x",
          source_commit_sha: null,
        }),
      }),
    }));
  });

  it("pins dispatch to SHA and patches build job when dispatch fails", async () => {
    const patchFailure = jest.fn(async () => undefined);

    const result = await runTriggerBuildFlow(
      {
        githubRepo: "owner/repo",
        buildProfile: "production",
        branch: "main",
      },
      {
        resolveCommitSha: async () => "abc123",
        insertBuildJob: async () => ({ id: 99 }),
        dispatchBuild: async () => ({ ok: false, status: 502, bodyText: "bad gateway" }),
        patchBuildJobOnDispatchFailure: patchFailure,
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.sourceCommitSha).toBe("abc123");
    expect(result.status).toBe(502);
    expect(patchFailure).toHaveBeenCalledWith(
      99,
      expect.objectContaining({
        status: "error",
        error_message: "dispatch_failed:502",
        source_commit_sha: "abc123",
      }),
    );
  });
});
