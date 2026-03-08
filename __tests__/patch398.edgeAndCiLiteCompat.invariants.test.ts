import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch 398 invariants", () => {
  it("github-run-artifact-json uses existing shared helpers", () => {
    const src = read("supabase/functions/github-run-artifact-json/index.ts");
    expect(src).toContain("handleCors");
    expect(src).toContain("requireAdminKey");
    expect(src).toContain("getGithubToken");
    expect(src).toContain("githubFetchJson");
    expect(src).toContain("githubFetchRaw");
    expect(src).not.toContain("handleOptions");
    expect(src).not.toContain("requireAdminAuth");
    expect(src).not.toContain("withErrorSanitization");
  });

  it("CI Lite artifact consumer accepts compatibility SHA fields", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");
    expect(src).toContain("source_commit_sha");
    expect(src).toContain("source_sha");
    expect(src).toContain("github_sha");
  });
});
