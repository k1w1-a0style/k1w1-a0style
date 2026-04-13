import {
  createChecklistItems,
  resolveBuildBlockedAction,
} from "../screens/EnhancedBuildScreen/hooks/enhancedBuildScreenReadiness";

describe("enhancedBuildScreenReadiness", () => {
  test("prioritizes repo/branch missing as first blocked action", () => {
    const action = resolveBuildBlockedAction({
      repoValidationValid: false,
      branchName: "",
      hasTokens: false,
      hasWorkflowAdminKey: false,
      hasOperatorJwt: false,
      hasDiagOk: false,
      hasCiLiteOk: false,
      repoSyncState: "unknown",
      hasSigningKey: false,
      buildBlockedReason: "Repo fehlt (im GitHub-Repos-Screen verknuepfen)",
    });

    expect(action?.screen).toBe("GitHubRepos");
    expect(action?.title).toBe("Repo/Branch zuerst verknüpfen");
  });

  test("keeps diagnostic action autoRun=true contract", () => {
    const action = resolveBuildBlockedAction({
      repoValidationValid: true,
      branchName: "feature/a",
      hasTokens: true,
      hasWorkflowAdminKey: true,
      hasOperatorJwt: true,
      hasDiagOk: false,
      hasCiLiteOk: true,
      repoSyncState: "in_sync",
      hasSigningKey: true,
      buildBlockedReason: "Diagnostik noch nicht sicher bestaetigt – im Diagnostic-Screen ausfuehren",
    });

    expect(action?.screen).toBe("Diagnostic");
    expect(action?.params).toEqual({ autoRun: true });
  });

  test("creates checklist with pending repo-sync when project files are missing", () => {
    const items = createChecklistItems({
      buildProfile: "preview",
      repoFullName: "o/r",
      branchName: "main",
      hasSigningKey: true,
      signingKeyReason: null,
      hasTokens: true,
      hasWorkflowAdminKey: true,
      workflowAdminKeyReason: null,
      hasOperatorJwt: true,
      operatorJwtReason: null,
      hasDiagOk: true,
      diagnosticReason: null,
      hasCiLiteOk: true,
      ciLiteReason: null,
      hasProjectFiles: false,
      projectFilesReason: "Projekt ist leer – zuerst Dateien erzeugen oder importieren",
      repoSyncState: "unknown",
      repoSyncReason: "Repo-Sync-Status unklar – bitte einmal explizit pushen und danach erneut prüfen",
      projectFilesCount: 0,
    });

    const repoSync = items.find((item) => item.id === "repo_sync");
    expect(repoSync?.status).toBe("pending");
    expect(repoSync?.detail).toContain("sobald Dateien im Projekt vorhanden sind");
  });

  test("routes to Connections when operator auth prerequisites are missing", () => {
    const action = resolveBuildBlockedAction({
      repoValidationValid: true,
      branchName: "main",
      hasTokens: true,
      hasWorkflowAdminKey: false,
      hasOperatorJwt: true,
      hasDiagOk: true,
      hasCiLiteOk: true,
      repoSyncState: "in_sync",
      hasSigningKey: true,
      buildBlockedReason: "Workflow-Admin-Key fehlt",
    });

    expect(action?.screen).toBe("Connections");
    expect(action?.title).toContain("Operator-Precheck");
  });

  test("uses explicit client-side precheck wording for operator JWT checklist and blocked action", () => {
    const action = resolveBuildBlockedAction({
      repoValidationValid: true,
      branchName: "main",
      hasTokens: true,
      hasWorkflowAdminKey: true,
      hasOperatorJwt: false,
      hasDiagOk: true,
      hasCiLiteOk: true,
      repoSyncState: "in_sync",
      hasSigningKey: true,
      buildBlockedReason: null,
    });
    expect(action?.detail).toContain("nur clientseitige Readiness");
    expect(action?.detail).toContain("server-/edge-seitige Autorisierung");

    const items = createChecklistItems({
      buildProfile: "preview",
      repoFullName: "o/r",
      branchName: "main",
      hasSigningKey: true,
      signingKeyReason: null,
      hasTokens: true,
      hasWorkflowAdminKey: true,
      workflowAdminKeyReason: null,
      hasOperatorJwt: true,
      operatorJwtReason: null,
      hasDiagOk: true,
      diagnosticReason: null,
      hasCiLiteOk: true,
      ciLiteReason: null,
      hasProjectFiles: true,
      projectFilesReason: null,
      repoSyncState: "in_sync",
      repoSyncReason: null,
      projectFilesCount: 3,
    });
    const operatorJwt = items.find((item) => item.id === "operator_jwt");
    expect(operatorJwt?.label).toContain("Precheck (clientseitig)");
    expect(operatorJwt?.detail).toContain("decode-only");
    expect(operatorJwt?.detail).toContain("maßgeblich");
  });
});
