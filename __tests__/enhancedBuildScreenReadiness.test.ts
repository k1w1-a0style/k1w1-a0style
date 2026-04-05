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
});
