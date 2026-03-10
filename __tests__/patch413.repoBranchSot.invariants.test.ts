import fs from "fs";
import path from "path";

const read = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Patch 413 repo/branch SoT invariants", () => {
  it("removes config repo fallback from build start", () => {
    const src = read("contexts/ProjectContext.tsx");
    expect(src).not.toContain("CONFIG.BUILD.GITHUB_REPO");
    expect(src).toContain("Kein GitHub-Repo verknüpft.");
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
    const src = read("screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts");
    expect(src).not.toContain('(activeBranch || "main").trim() || "main"');
    expect(src).not.toContain('activeBranch ?? "main"');
    expect(src).toContain("Kein Branch ausgewählt.");
  });

  it("keeps diff views free of silent main fallbacks", () => {
    const diffFiles = read("screens/GitHubReposScreen/components/DiffFilesSection.tsx");
    const localRemote = read("screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx");
    expect(diffFiles).not.toContain('defaultBranch || "main"');
    expect(localRemote).not.toContain('(activeBranch || "main").trim() || "main"');
  });
});
