import { readRepoText } from "./helpers/repoSourceHelpers";

describe("useAppInfoScreen secure backup flow split invariants", () => {
  test("keeps export/import submit branches split into dedicated callbacks", () => {
    const src = readRepoText("screens/AppInfoScreen/hooks/useAppInfoScreen.ts");

    expect(src).toContain("const runSecureBackupExport = useCallback(");
    expect(src).toContain("const runSecureBackupImport = useCallback(");
    expect(src).toContain("await runSecureBackupExport(passphrase, secureBackupRequest.scope);");
    expect(src).toContain("await runSecureBackupImport(passphrase);");
  });
});
