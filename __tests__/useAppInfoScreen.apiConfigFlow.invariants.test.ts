import { readRepoText } from "./helpers/repoSourceHelpers";

describe("useAppInfoScreen API-config flow split invariants", () => {
  test("keeps API config import execution in dedicated flow hook", () => {
    const src = readRepoText("screens/AppInfoScreen/hooks/useAppInfoScreen.ts");
    const flow = readRepoText("screens/AppInfoScreen/hooks/useAppInfoApiConfigFlow.ts");

    expect(src).toContain("useAppInfoApiConfigFlow");
    expect(flow).toContain("const runApiConfigImport = useCallback(async () => {");
    expect(flow).toContain("const handleImportAPIConfig = useCallback(async () => {");
    expect(flow).toContain("void runApiConfigImport();");
    expect(flow).toContain("applyImportedApiConfig(result.config, config)");
    expect(flow).toContain('logger.info("[useAppInfoScreen] API-Config-Import wurde abgebrochen.");');
  });
});
