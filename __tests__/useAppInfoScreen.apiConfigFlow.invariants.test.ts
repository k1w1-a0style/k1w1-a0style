import { readRepoText } from "./helpers/repoSourceHelpers";

describe("useAppInfoScreen API-config flow split invariants", () => {
  test("keeps API config import execution in dedicated callback", () => {
    const src = readRepoText("screens/AppInfoScreen/hooks/useAppInfoScreen.ts");

    expect(src).toContain("const runApiConfigImport = useCallback(async () => {");
    expect(src).toContain("const handleImportAPIConfig = useCallback(async () => {");
    expect(src).toContain("void runApiConfigImport();");
    expect(src).toContain("applyImportedApiConfig(result.config, config)");
    expect(src).toContain('logger.info("[useAppInfoScreen] API-Config-Import wurde abgebrochen.");');
  });
});
