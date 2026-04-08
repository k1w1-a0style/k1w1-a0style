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

  it("does not fall back to full workflow run list when active profile filter has zero matches", () => {
    const src = read("screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts");

    expect(src).not.toContain("return list.length > 0 ? list : runs;");
    expect(src).toContain("filterWorkflowRunsByProfile");
  });

  it("uses project-context repo/branch as the only header CI-Lite source of truth", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");

    expect(src).not.toContain("activeRepo?.trim() || projectData?.linkedRepo?.trim()");
    expect(src).not.toContain("activeBranch?.trim() || projectData?.linkedBranch?.trim()");
    expect(src).toContain('projectData?.linkedRepo?.trim() || ""');
    expect(src).toContain('projectData?.linkedBranch?.trim() || ""');
  });



  it("marks context repo/branch selection as fallback-only in Connections status copy", () => {
    const src = read("screens/ConnectionsScreen/components/StatusCard.tsx");

    expect(src).toContain('? `${repoSelectionHint} · Maßgeblich für Build/Signing.`');
    expect(src).toContain('? `${repoSelectionHint} · Nur letzter bekannter Stand; erst nach Verknüpfen im Projekt wirklich wirksam.`');
  });

  it("does not silently fall back to 'main' in ConnectionsScreen EAS prep flows", () => {
    const src = read("screens/ConnectionsScreen/hooks/useConnectionsScreen.ts");
    const easLink = read("screens/ConnectionsScreen/hooks/useConnectionsEasLink.ts");

    expect(easLink).toContain("Kein Branch ausgewählt. Bitte zuerst in GitHub Repos einen Branch verknüpfen.");
    expect(src).not.toContain('projectData?.linkedBranch || "main"');
    expect(src).not.toContain('activeBranch || projectData?.linkedBranch || "main"');
  });

  it("keeps repo/branch selection centralized in the shared helper", () => {
    const src = read("screens/ConnectionsScreen/hooks/useConnectionsScreen.ts");
    const helper = read("lib/selection/repoBranch.ts");

    expect(src).toContain("resolveRepoBranchSelection");
    expect(helper).toContain("projectData.linkedRepo exists");
    expect(helper).toContain("We never mix project repo with GitHubContext branch");
    expect(helper).toContain("We never invent a default branch here");
  });

  it("does not keep stale active branch when resolving repo default branch", () => {
    const src = read("screens/GitHubReposScreen/hooks/useGitHubReposSelection.ts");

    expect(src).toContain("setLinkedRepo(fullName, b);");
    expect(src).not.toContain("setActiveBranch(activeBranch || b);");
  });

  it("passes deterministic artifact result into computeCiLiteOk", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");

    expect(src).toContain("resultOk: artifactResult?.ok ?? null");
    expect(src).toContain("eslintExit: artifactResult?.eslint_exit ?? null");
    expect(src).toContain("tscExit: artifactResult?.tsc_exit ?? null");
  });

  it("uses shared edge function constant for artifact-json endpoint", () => {
    const facadeSrc = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");
    const artifactSrc = read("components/CiLiteHeaderButton/hooks/useCiLiteArtifactFetch.ts");

    expect(artifactSrc).toContain("SUPABASE_EDGE_FUNCTIONS.GITHUB_RUN_ARTIFACT_JSON");
    expect(artifactSrc).not.toContain("`${edgeUrl}/github-run-artifact-json`");
    expect(facadeSrc).toContain("useCiLiteArtifactFetch({");
  });

  it("keeps managed markers in managed workflow templates", () => {
    const src = read("shared/workflows/templates/ciLiteTemplate.ts");

    expect(src).toContain('# managed-by: k1w1');
    expect(src).toContain('# workflow-version: 399');
  });

  it("keeps source provenance fields in CI-Lite template artifacts", () => {
    const src = read("shared/workflows/templates/ciLiteTemplate.ts");

    expect(src).toContain('\"source_sha\": \"\\${SOURCE_SHA:-}\"');
    expect(src).toContain('\"github_sha\": \"\\${GITHUB_SHA}\"');
  });


  it("does not keep a default-branch fallback in CI-Lite header dispatch", () => {
    const facadeSrc = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");
    const dispatchSrc = read("components/CiLiteHeaderButton/hooks/useCiLiteDispatch.ts");
    const helper = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflowHelpers.ts");

    expect(dispatchSrc).toContain("resolveCiLiteDispatchSelection");
    expect(facadeSrc).toContain("const dispatchWorkflow = useCiLiteDispatch({");
    expect(helper).toContain("CI Lite blockiert: Kein Branch verknüpft.");
    expect(dispatchSrc).not.toContain("getDefaultBranch");
    expect(dispatchSrc).not.toContain('targetBranch = "main"');
  });

  it("keeps signing-key readiness project-scoped with legacy fallback", () => {
    const buildPreconditions = read("screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts");
    const signingKeyGate = read("screens/EnhancedBuildScreen/hooks/signingKeyGate.ts");
    const wizard = read("screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts");

    expect(buildPreconditions).toContain("readSigningKeyGateState");
    expect(signingKeyGate).toContain("resolveProjectCredentialScope");
    expect(signingKeyGate).toContain("credKeyForProjectUiMode");
    expect(signingKeyGate).toContain("params.scopedKey === params.legacyKey");

    expect(wizard).toContain("resolveProjectCredentialScope");
    expect(wizard).toContain("credKeyForProjectUiMode");
    expect(wizard).toContain("scopedKey !== legacyKey");
    expect(wizard).not.toContain("One-time migration into project-scoped key.");
  });

});
