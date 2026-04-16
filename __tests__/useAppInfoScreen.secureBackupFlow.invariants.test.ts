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
    expect(flow).toContain("applyImportedConfig(sanitizeAiConfigFromBackup(imported.aiConfig, config));");
    expect(flow).not.toContain("setConfig(sanitizeAiConfigFromBackup(imported.aiConfig, config));");
    expect(flow).toContain('logger.info("[useAppInfoScreen] Secure-Backup-Flow wurde abgebrochen.");');
  });
});
