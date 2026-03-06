import fs from "fs";
import path from "path";

/**
 * "YES-tests" (Invariants)
 *
 * These tests are meant to stop regressions where someone accidentally hardcodes
 * repo/branch/workflow defaults instead of using the in-app selections.
 *
 * They are intentionally simple string checks (fast + stable).
 */

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Invariants: repo/branch selection is source of truth", () => {
  it("Build Screen must NOT silently fall back to 'main' when branch is missing", () => {
    const src = read("screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts");

    // The Build screen should block with a clear message if branch is missing.
    // It should not quietly assume a branch.
    expect(src).not.toMatch(/\|\|\s*["']main["']/);
  });

  it("uses project-context repo/branch as the only build-screen source of truth", () => {
    const src = read("screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts");

    expect(src).not.toContain("currentBuild?.githubRepo?.trim() || normalizedRepo || null");
    expect(src).not.toContain('projectData?.linkedRepo?.trim() ||\n      (currentBuild?.githubRepo ?? "").trim()');
    expect(src).not.toContain("projectData?.linkedBranch?.trim() ||\n      activeBranch?.trim() ||");
  });

  it("uses project-context repo/branch as the only header CI-Lite source of truth", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");

    expect(src).not.toContain("activeRepo?.trim() || projectData?.linkedRepo?.trim()");
    expect(src).not.toContain("activeBranch?.trim() || projectData?.linkedBranch?.trim()");
    expect(src).toContain('projectData?.linkedRepo?.trim() || ""');
    expect(src).toContain('projectData?.linkedBranch?.trim() || ""');
  });

  it("passes deterministic artifact result into computeCiLiteOk", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");

    expect(src).toContain("resultOk: artifactResult?.ok ?? null");
    expect(src).toContain("eslintExit: artifactResult?.eslint_exit ?? null");
    expect(src).toContain("tscExit: artifactResult?.tsc_exit ?? null");
  });

  it("keeps managed markers in embedded workflow templates", () => {
    const src = read("supabase/functions/github-workflow-dispatch/index.ts");

    expect(src).toContain('# managed-by: k1w1');
    expect(src).toContain('# workflow-version: 4');
  });

  it("keeps source_commit_sha in CI-Lite template artifacts", () => {
    const src = read("supabase/functions/github-workflow-dispatch/index.ts");

    expect(src).toContain('"source_commit_sha": "${SOURCE_COMMIT_SHA:-}"');
  });

});
