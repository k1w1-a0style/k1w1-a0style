import fs from "fs";
import path from "path";

describe("eas project id scope invariants", () => {
  it("does not fallback from repo scope to global legacy EAS_PROJECT_ID", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "lib/easProjectIdScope.ts"), "utf8");
    expect(src).toContain("if (!repo) return \"\";");
    expect(src).toContain("validateGitHubRepo");
    expect(src).not.toContain("AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID)");
    expect(src).not.toContain("AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID");
  });
});
