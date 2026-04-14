import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("patch658 EAS project id scoped storage invariants", () => {
  const files = [
    "screens/ConnectionsScreen/hooks/useConnectionsScreen.ts",
    "screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts",
    "screens/AppInfoScreen/hooks/useAppInfoScreen.ts",
    "lib/autoSyncRepoSecrets.ts",
  ] as const;

  it("does not use legacy global STORAGE_KEYS.EAS_PROJECT_ID read/write paths", () => {
    for (const relPath of files) {
      const source = readFileSync(join(process.cwd(), relPath), "utf8");
      expect(source).not.toContain("AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID)");
      expect(source).not.toContain("AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID");
      expect(source).not.toContain("AsyncStorage.removeItem(STORAGE_KEYS.EAS_PROJECT_ID");
      expect(source).toContain("easProjectIdKeyForRepo");
    }
  });
});
