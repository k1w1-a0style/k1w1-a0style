import { readRepoText } from "./helpers/repoSourceHelpers";

describe("useAppInfoScreen icon flow split invariants", () => {
  test("keeps icon asset apply logic in dedicated callback", () => {
    const src = readRepoText("screens/AppInfoScreen/hooks/useAppInfoScreen.ts");

    expect(src).toContain("const runApplyIconToAssets = useCallback(async (base64Content: string) => {");
    expect(src).toContain("await runApplyIconToAssets(asset.base64);");
    expect(src).toContain("assets/adaptive-icon.png");
    expect(src).toContain("assets/splash.png");
    expect(src).toContain("assets/favicon.png");
  });
});
