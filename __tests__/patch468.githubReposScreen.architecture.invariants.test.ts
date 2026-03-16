import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Patch 468 GitHub repo sync architecture invariants", () => {
  it("keeps sync-status comparison centralized in infra and avoids per-file content API loop", () => {
    const screenHook = read("screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts");

    expect(screenHook).toContain("compareLocalFilesWithRepo({");
    expect(screenHook).not.toContain("for (const f of slice)");
    expect(screenHook).not.toContain("const remote = await getRepoFileText");
  });

  it("uses consolidated Git tree/commit/ref flow for multi-file push", () => {
    const filesInfra = read("infra/github/files.ts");

    expect(filesInfra).toContain("/git/trees");
    expect(filesInfra).toContain("/git/commits");
    expect(filesInfra).toContain("/git/refs/heads/");
    expect(filesInfra).not.toContain("IMPORTANT: GitHub Contents API creates a commit per file.");
  });
});
