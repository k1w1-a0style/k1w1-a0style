import { readRepoText } from "./helpers/repoSourceHelpers";

describe("useAppInfoScreen secure backup flow split invariants", () => {
  test("keeps export/import submit branches and secret apply pipeline in dedicated flow hook", () => {
    const src = readRepoText("screens/AppInfoScreen/hooks/useAppInfoScreen.ts");
    const flow = readRepoText("screens/AppInfoScreen/hooks/useAppInfoSecureBackupFlow.ts");

    expect(src).toContain("useAppInfoSecureBackupFlow");
    expect(flow).toContain("const runSecureBackupExport = useCallback(async (passphrase: string, scope: SecureBackupScope) => {");
    expect(flow).toContain("const runSecureBackupImport = useCallback(async (passphrase: string) => {");
    expect(flow).toContain("await runSecureBackupExport(passphrase, secureBackupRequest.scope);");
    expect(flow).toContain("await runSecureBackupImport(passphrase);");

    expect(flow).toContain("const persistImportedConnectionSecrets = useCallback(async (payload: SecretBackupPayloadV1) => {");
    expect(flow).toContain("const persistImportedTokenSecrets = useCallback(async (payload: SecretBackupPayloadV1) => {");
    expect(flow).toContain("const hydrateImportedGitHubSelection = useCallback(async (payload: SecretBackupPayloadV1) => {");
    expect(flow).toContain("await persistImportedConnectionSecrets(payload);");
    expect(flow).toContain("await persistImportedTokenSecrets(payload);");
    expect(flow).toContain("await hydrateImportedGitHubSelection(payload);");
    expect(flow).toContain("aiConfig: config,");
    expect(flow).toContain("const importedAiConfig = imported.kind === \"config-secret-snapshot\"");
    expect(flow).toContain("assertImportedConfigAllowed(importedAiConfig);");
    expect(flow).toContain("if (importedAiConfig) {");
    expect(flow).toContain("applyImportedConfig(importedAiConfig);");
    expect(flow).not.toContain("applyImportedConfig(sanitizeAiConfigFromBackup(imported.aiConfig, config));");
    expect(flow).not.toContain("setConfig(sanitizeAiConfigFromBackup(imported.aiConfig, config));");
    const recoverIdx = flow.indexOf("await recoverFromPendingJournal<SecureBackupImportSnapshot | SecureBackupImportJournalSnapshot>({");
    const preflightIdx = flow.indexOf("assertImportedConfigAllowed(importedAiConfig);");
    const commitIdx = flow.indexOf("await runRecoverableCommit<SecureBackupImportSnapshot, SecureBackupImportJournalSnapshot>({");
    expect(recoverIdx).toBeGreaterThanOrEqual(0);
    expect(preflightIdx).toBeGreaterThanOrEqual(0);
    expect(commitIdx).toBeGreaterThanOrEqual(0);
    expect(recoverIdx).toBeLessThan(preflightIdx);
    expect(preflightIdx).toBeLessThan(commitIdx);
    expect(flow).toContain('logger.info("[useAppInfoScreen] Secure-Backup-Flow wurde abgebrochen.");');
  });
});
