import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("useEnhancedBuildScreen return contract invariants", () => {
  test("composes return object through composer with critical build/run keys", () => {
    const src = read("screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts");

    expect(src).toContain("return composeEnhancedBuildScreenReturn({");
    expect(src).toContain("buildBlockedReason,");
    expect(src).toContain("canStartBuildUi,");
    expect(src).toContain("fetchRuns,");
    expect(src).toContain("onStartBuild,");
    expect(src).toContain("runDetailVisible,");
    expect(src).toContain("openRunDetails,");
    expect(src).toContain("refreshRunDetails,");
    expect(src).toContain("findHistoryMatchForRun,");
  });

  test("keeps canonical repo/branch block reason constants in hook scope", () => {
    const src = read("screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts");
    expect(src).toContain("Repo fehlt (im GitHub-Repos-Screen verknuepfen)");
    expect(src).toContain("Branch fehlt (im GitHub-Repos-Screen auswaehlen)");
  });
});
