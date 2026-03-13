import fs from "fs";
import path from "path";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Build traceability transparency invariants", () => {
  it("stores repo/branch/profile into currentBuild and history from startBuild", () => {
    const src = read("contexts/ProjectContext.tsx");

    expect(src).toContain("const buildBranch = (pd.linkedBranch ?? \"\").trim();");
    expect(src).toContain("branch: branchResolved");
    expect(src).toContain("branch: currentBuild?.branch ?? undefined");
    expect(src).toContain("buildProfile: currentBuild?.buildProfile ?? undefined");
    expect(src).toContain("repoName: currentBuild?.githubRepo ?? undefined");
  });

  it("shows effective repo/branch/profile in build status card", () => {
    const src = read("screens/EnhancedBuildScreen/components/BuildStatusSection.tsx");

    expect(src).toContain("Repo {currentBuild.githubRepo}");
    expect(src).toContain("Branch {currentBuild.branch}");
    expect(src).toContain("Profil {String(currentBuild.buildProfile)}");
  });

  it("keeps branch and source sha in build history presentation/export", () => {
    const src = read("screens/EnhancedBuildScreen/components/BuildHistorySection.tsx");

    expect(src).toContain('"branch"');
    expect(src).toContain('"sourceCommitSha"');
    expect(src).toContain("branch: {h.branch}");
    expect(src).toContain("sha: {h.sourceCommitSha.slice(0, 12)}");
  });
});
