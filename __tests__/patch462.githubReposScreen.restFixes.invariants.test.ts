import { readRepoText as read } from "./helpers/repoSourceHelpers";

describe("Patch 462 GitHubReposScreen rest-fixes invariants", () => {
  it("keeps typed local file handling without root any-cast", () => {
    const src = read("screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts");

    expect(src).toContain("normalizeProjectFiles(projectData?.files)");
    expect(src).not.toContain("const list = (projectData?.files ?? []) as " + "any[];");
  });

  it("guards sync status updates against stale async runs", () => {
    const src = read("screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts");

    expect(src).toContain("const syncStatusRunRef = useRef(0);");
    expect(src).toContain("if (runId !== syncStatusRunRef.current) return;");
  });

  it("keeps default branch after repo creation when GitHub provides one", () => {
    const screenSrc = read("screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts");
    const crudSrc = read("screens/GitHubReposScreen/hooks/useGitHubRepoCrud.ts");
    const repoTypes = read("hooks/gitHubReposTypes.ts");

    expect(crudSrc).toContain('const defaultBranch = String(repo.default_branch || "").trim() || null;');
    expect(crudSrc).toContain("setLinkedRepo(repo.full_name, defaultBranch);");
    expect(screenSrc).toContain("useGitHubRepoCrud({");
    expect(repoTypes).toContain("default_branch?: string | null;");
  });
});
