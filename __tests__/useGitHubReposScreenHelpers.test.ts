import {
  buildRepoBranchContextKey,
  getEasLinkNeutralMessage,
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
});
