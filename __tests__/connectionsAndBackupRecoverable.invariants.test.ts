import { readRepoText } from "./helpers/repoSourceHelpers";

describe("recoverable multi-store persistence invariants", () => {
  it("uses journaled recoverable commit in Connections save flow", () => {
    const src = readRepoText("screens/ConnectionsScreen/hooks/useConnectionsSaveActions.ts");

    expect(src).toContain('CONNECTIONS_SAVE_JOURNAL_KEY = "connections_save_recoverable_journal_v1"');
    expect(src).toContain("recoverFromPendingJournal<ConnectionsSnapshot>");
    expect(src).toContain("runRecoverableCommit({");
    expect(src).toContain("snapshot: rollbackSnapshot");
    expect(src).toContain("rollback: restoreSnapshot");
  });

  it("uses journaled recoverable commit in secure-backup import flow", () => {
    const src = readRepoText("screens/AppInfoScreen/hooks/useAppInfoSecureBackupFlow.ts");

    expect(src).toContain('SECURE_BACKUP_IMPORT_JOURNAL_KEY = "secure_backup_import_recoverable_journal_v1"');
    expect(src).toContain("recoverFromPendingJournal<SecureBackupImportSnapshot | SecureBackupImportJournalSnapshot>");
    expect(src).toContain('flow: "secure_backup_import"');
    expect(src).toContain("runRecoverableCommit<SecureBackupImportSnapshot, SecureBackupImportJournalSnapshot>({");
    expect(src).toContain("snapshotDerivedStatusBeforeSecretImport()");
    expect(src).toContain("derivedStatus: rollbackDerivedStatus");
    expect(src).toContain("journalSnapshot: {");
    expect(src).toContain("restoreDerivedStatusAfterSecretImportRollback(snapshot.derivedStatus)");
    expect(src).toContain('if ("secrets" in snapshot)');
    expect(src).toContain("const importRepoScope = payload.github.linkedRepo ?? null;");
    expect(src).toContain("repoFullName: importRepoScope");
  });

  it("keeps Connections recovery scope journal/snapshot-driven instead of current repo closure", () => {
    const src = readRepoText("screens/ConnectionsScreen/hooks/useConnectionsSaveActions.ts");
    expect(src).toContain("repoScope: effectiveRepo");
    expect(src).toContain("persistSelectedEasProjectId(plan.easProjectId, snapshot.repoScope);");
    expect(src).toContain("restoreConnectionSideState(snapshot)");
    expect(src).toContain("CONN_GITHUB_OK");
    expect(src).toContain("CONN_EXPO_OK");
    expect(src).toContain("CONN_REPO_OK");
    expect(src).toContain("CONN_SUPABASE_OK");
    expect(src).toContain("CONN_EAS_STATE");
    expect(src).toContain("setGitHubConnectionState({");
    expect(src).toContain("setExpoConnectionState({");
    expect(src).toContain("setRepoConnectionState({ ok: repoOk, line: repoLine });");
    expect(src).toContain("setSupabaseConnectionState({ ok: supabaseOk, ref: supabaseRef });");
  });

  it("keeps apply clear logic but prevents post-restore clear logic in rollback path", () => {
    const src = readRepoText("screens/ConnectionsScreen/hooks/useConnectionsSaveActions.ts");

    const restoreBlock = src.split("const restoreSnapshot = useCallback(")[1]?.split("const saveAll = useCallback(async () => {")[0] ?? "";
    expect(restoreBlock).not.toContain("clearEasConnectionState()");
    expect(restoreBlock).not.toContain("clearSupabaseConnectionState()");

    const applyBlock = src.split("apply: async () => {")[1]?.split("},\n          rollback: restoreSnapshot,")[0] ?? "";
    expect(applyBlock).toContain("if (plan.shouldClearEasConnection)");
    expect(applyBlock).toContain("if (plan.shouldClearSupabaseConnection)");
  });
});
