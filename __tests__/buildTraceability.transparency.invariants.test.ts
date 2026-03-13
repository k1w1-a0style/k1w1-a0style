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
    expect(src).toContain("const historySelection = resolveHistoryBuildSelection");
    expect(src).toContain("branch: historySelection.branch");
    expect(src).toContain("buildProfile: historySelection.buildProfile");
    expect(src).toContain("repoName: historySelection.repoName");
  });

  it("shows effective repo/branch/profile in build status card", () => {
    const src = read("screens/EnhancedBuildScreen/components/BuildStatusSection.tsx");

    expect(src).toContain("const contextRepo = currentBuild?.githubRepo || selectedRepo;");
    expect(src).toContain("const contextBranch = currentBuild?.branch || selectedBranch;");
    expect(src).toContain("const contextProfile = currentBuild?.buildProfile || selectedBuildProfile;");
    expect(src).toContain("Laufkontext (aktueller Build)");
    expect(src).toContain("Laufkontext (aktuelle Auswahl)");
  });

  it("keeps branch and source sha in build history presentation/export", () => {
    const src = read("screens/EnhancedBuildScreen/components/BuildHistorySection.tsx");

    expect(src).toContain('"branch"');
    expect(src).toContain('"sourceCommitSha"');
    expect(src).toContain("branch: {h.branch}");
    expect(src).toContain("sha: {h.sourceCommitSha.slice(0, 12)}");
  });
});
