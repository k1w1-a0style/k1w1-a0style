import { readRepoText } from "./helpers/repoSourceHelpers";

describe("useAppInfoScreen secure backup flow split invariants", () => {
  test("keeps export/import submit branches and secret apply pipeline split into dedicated callbacks", () => {
    const src = readRepoText("screens/AppInfoScreen/hooks/useAppInfoScreen.ts");

    expect(src).toContain("const runSecureBackupExport = useCallback(");
    expect(src).toContain("const runSecureBackupImport = useCallback(");
    expect(src).toContain("await runSecureBackupExport(passphrase, secureBackupRequest.scope);");
    expect(src).toContain("await runSecureBackupImport(passphrase);");

    expect(src).toContain("const persistImportedConnectionSecrets = useCallback(async (payload: SecretBackupPayloadV1) => {");
    expect(src).toContain("const persistImportedTokenSecrets = useCallback(async (payload: SecretBackupPayloadV1) => {");
    expect(src).toContain("const hydrateImportedGitHubSelection = useCallback(async (payload: SecretBackupPayloadV1) => {");
    expect(src).toContain("await persistImportedConnectionSecrets(payload);");
    expect(src).toContain("await persistImportedTokenSecrets(payload);");
    expect(src).toContain("await hydrateImportedGitHubSelection(payload);");
    expect(src).toContain("aiConfig: config,");
    expect(src).toContain('logger.info("[useAppInfoScreen] Secure-Backup-Flow wurde abgebrochen.");');
  });
});
