import AsyncStorage from "@react-native-async-storage/async-storage";

import { readScopedEasProjectId, persistScopedEasProjectId } from "../lib/easProjectIdScope";
import { STORAGE_KEYS } from "../lib/storageKeys";

describe("easProjectIdScope", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("never reuses legacy global id for a different repo", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, "global-id");
    await AsyncStorage.setItem(`${STORAGE_KEYS.EAS_PROJECT_ID}::owner%2Frepo-a`, "repo-a-id");

    await expect(readScopedEasProjectId("owner/repo-a")).resolves.toBe("repo-a-id");
    await expect(readScopedEasProjectId("owner/repo-b")).resolves.toBe("");
  });

  it("persists and clears only repo-scoped slots", async () => {
    await persistScopedEasProjectId({ projectId: "repo-b-id", repoFullName: "owner/repo-b" });

    await expect(AsyncStorage.getItem(`${STORAGE_KEYS.EAS_PROJECT_ID}::owner%2Frepo-b`)).resolves.toBe("repo-b-id");
    await expect(AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID)).resolves.toBeNull();

    await persistScopedEasProjectId({ projectId: "", repoFullName: "owner/repo-b" });
    await expect(AsyncStorage.getItem(`${STORAGE_KEYS.EAS_PROJECT_ID}::owner%2Frepo-b`)).resolves.toBeNull();
  });

  it("returns empty for missing repo context", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, "legacy-only");
    await expect(readScopedEasProjectId(null)).resolves.toBe("");
  });
});
