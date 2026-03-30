import {
  buildRepoBranchContextKey,
  getEasLinkNeutralMessage,
  resolveSyncStatusPrecheck,
} from "../screens/GitHubReposScreen/hooks/useGitHubReposScreenHelpers";

describe("useGitHubReposScreenHelpers", () => {
  it("builds a context key only when repo and branch are both present", () => {
    expect(buildRepoBranchContextKey(" owner/repo ", " main ")).toBe("owner/repo@@main");
    expect(buildRepoBranchContextKey("owner/repo", "")).toBeNull();
    expect(buildRepoBranchContextKey("", "main")).toBeNull();
  });

  it("returns the neutral EAS status message for selected or missing context", () => {
    expect(getEasLinkNeutralMessage("owner/repo@@main")).toBe(
      "Pruefstatus fuer die aktuelle Repo-/Branch-Auswahl noch nicht geladen.",
    );
    expect(getEasLinkNeutralMessage(null)).toBe("Repo oder Branch sind noch nicht ausgewaehlt.");
  });

  it("resolves sync-status precheck states deterministically", () => {
    expect(
      resolveSyncStatusPrecheck({
        activeRepo: "",
        activeBranch: "main",
      }).status,
    ).toBe("missing_repo");

    expect(
      resolveSyncStatusPrecheck({
        activeRepo: "owner/repo",
        activeBranch: "",
      }).status,
    ).toBe("missing_branch");

    expect(
      resolveSyncStatusPrecheck({
        activeRepo: "owner-only",
        activeBranch: "main",
      }).status,
    ).toBe("invalid_repo");

    const ready = resolveSyncStatusPrecheck({
      activeRepo: "owner/repo",
      activeBranch: "main",
    });
    expect(ready.status).toBe("ready");
    expect(ready.repoParts).toEqual({ owner: "owner", repo: "repo" });
    expect(ready.branch).toBe("main");
  });
});
