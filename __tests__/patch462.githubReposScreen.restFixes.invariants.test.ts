import fs from "fs";
import path from "path";

const read = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Patch 462 GitHubReposScreen rest-fixes invariants", () => {
  it("keeps typed local file handling without root any-cast", () => {
    const src = read("screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts");

    expect(src).toContain("normalizeProjectFiles(projectData?.files)");
    expect(src).not.toContain("const list = (projectData?.files ?? []) as any[];");
  });

  it("guards sync status updates against stale async runs", () => {
    const src = read("screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts");

    expect(src).toContain("const syncStatusRunRef = useRef(0);");
    expect(src).toContain("if (runId !== syncStatusRunRef.current) return;");
  });

  it("keeps default branch after repo creation when GitHub provides one", () => {
    const src = read("screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts");
    const repoTypes = read("hooks/gitHubReposTypes.ts");

    expect(src).toContain('const defaultBranch = String(repo.default_branch || "").trim() || null;');
    expect(src).toContain("setLinkedRepo(repo.full_name, defaultBranch);");
    expect(repoTypes).toContain("default_branch?: string | null;");
  });
});
