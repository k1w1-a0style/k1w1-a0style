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
    expect(src).toContain("recoverFromPendingJournal<SecretBackupPayloadV1>");
    expect(src).toContain('flow: "secure_backup_import"');
    expect(src).toContain("runRecoverableCommit({");
    expect(src).toContain("snapshot: rollbackSecrets");
    expect(src).toContain("const importRepoScope = payload.github.linkedRepo ?? null;");
    expect(src).toContain("repoFullName: importRepoScope");
  });

  it("keeps Connections recovery scope journal/snapshot-driven instead of current repo closure", () => {
    const src = readRepoText("screens/ConnectionsScreen/hooks/useConnectionsSaveActions.ts");
    expect(src).toContain("repoScope: effectiveRepo");
    expect(src).toContain("persistSelectedEasProjectId(plan.easProjectId, snapshot.repoScope);");
    expect(src).toContain("restoreConnectionSideState(snapshot)");
    expect(src).toContain("CONN_SUPABASE_OK");
    expect(src).toContain("CONN_EAS_STATE");
    expect(src).toContain("setSupabaseConnectionState({ ok: supabaseOk, ref: supabaseRef });");
  });
});
