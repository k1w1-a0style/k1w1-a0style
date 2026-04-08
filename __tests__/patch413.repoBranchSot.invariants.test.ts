import fs from "fs";
import path from "path";

const repoPath = (rel: string) => path.join(process.cwd(), rel);
const read = (rel: string) => fs.readFileSync(repoPath(rel), "utf8");
const exists = (rel: string) => fs.existsSync(repoPath(rel));

describe("Patch 413 repo/branch SoT invariants", () => {
  it("removes config repo fallback from build start", () => {
    const src = read("contexts/ProjectContext.tsx");
    const buildController = read("contexts/projectContext/useProjectBuildController.ts");
    expect(src).not.toContain("CONFIG.BUILD.GITHUB_REPO");
    expect(buildController).toContain("Kein GitHub-Repo verknüpft.");
  });

  it("blocks CI-Lite patch sync without an explicit branch", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLitePatch.ts");
    expect(src).not.toContain("getDefaultBranch");
    expect(src).not.toContain('targetBranch = "main"');
    expect(src).toContain("Kein Branch verknüpft (Auto-Sync nach Patch).");
  });

  it("blocks remote diagnostics and pipeline checks without a branch", () => {
    const buildDiag = read("lib/diagnostics/buildPipelineDiagnostics.ts");
    const remoteDiag = read("lib/diagnostics/remoteDiagnostics.ts");
    expect(buildDiag).toContain('throw new Error("Kein Branch ausgewählt.")');
    expect(buildDiag).not.toContain('safeTrim(params.branch) || "main"');
    expect(remoteDiag).not.toContain('safeTrim(params.branch) || "main"');
  });

  it("keeps repo screen pull/push/eas-link paths free of silent main fallbacks", () => {
    const pushPullSrc = read("screens/GitHubReposScreen/hooks/useGitHubReposPushPull.ts");
    const easLinkSrc = read("screens/GitHubReposScreen/hooks/useGitHubReposEasLink.ts");
    expect(pushPullSrc).not.toContain('(activeBranch || "main").trim() || "main"');
    expect(pushPullSrc).not.toContain('activeBranch ?? "main"');
    expect(easLinkSrc).not.toContain('(activeBranch || "main").trim() || "main"');
    expect(easLinkSrc).not.toContain('activeBranch ?? "main"');
    expect(pushPullSrc).toContain("Kein Branch ausgewählt.");
    expect(easLinkSrc).toContain("Kein Branch ausgewählt.");
  });

  it("keeps the active diff view free of silent main fallbacks and removes the dead legacy diff section", () => {
    const localRemote = read("screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx");
    expect(exists("screens/GitHubReposScreen/components/DiffFilesSection.tsx")).toBe(false);
    expect(localRemote).not.toContain('(activeBranch || "main").trim() || "main"');
  });
});
