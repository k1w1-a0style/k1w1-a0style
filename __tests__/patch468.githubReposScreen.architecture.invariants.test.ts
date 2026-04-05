import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Patch 468 GitHub repo sync architecture invariants", () => {
  it("keeps sync-status comparison centralized in infra and avoids per-file content API loop", () => {
    const syncHook = read("screens/GitHubReposScreen/hooks/useGitHubReposSyncStatus.ts");

    expect(syncHook).toContain("compareLocalFilesWithRepo({");
    expect(syncHook).not.toContain("for (const f of slice)");
    expect(syncHook).not.toContain("const remote = await getRepoFileText");
  });

  it("uses consolidated Git tree/commit/ref flow for multi-file push", () => {
    const filesInfra = read("infra/github/files.ts");

    expect(filesInfra).toContain("/git/trees");
    expect(filesInfra).toContain("/git/commits");
    expect(filesInfra).toContain("/git/refs/heads/");
    expect(filesInfra).not.toContain("IMPORTANT: GitHub Contents API creates a commit per file.");
  });
});
