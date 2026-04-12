import { resolveCommitShaBestEffort } from "../supabase/functions/trigger-eas-build/helpers";

describe("trigger-eas-build SHA lookup resilience", () => {
  it("returns SHA when upstream lookup succeeds", async () => {
    const sha = await resolveCommitShaBestEffort({
      githubRepo: "owner/repo",
      branch: "main",
      fetchCommitSha: async () => "abc123",
    });
    expect(sha).toBe("abc123");
  });

  it("falls back to null when upstream lookup throws transiently", async () => {
    const sha = await resolveCommitShaBestEffort({
      githubRepo: "owner/repo",
      branch: "main",
      fetchCommitSha: async () => {
        throw new Error("timeout");
      },
    });
    expect(sha).toBeNull();
  });
});
