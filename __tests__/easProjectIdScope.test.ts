import AsyncStorage from "@react-native-async-storage/async-storage";

import { readScopedEasProjectId, persistScopedEasProjectId } from "../lib/easProjectIdScope";
import { STORAGE_KEYS } from "../lib/storageKeys";

describe("easProjectIdScope", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("prefers repo-scoped id and falls back to legacy global key", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, "global-id");
    await AsyncStorage.setItem(`${STORAGE_KEYS.EAS_PROJECT_ID}::owner%2Frepo-a`, "repo-a-id");

    await expect(readScopedEasProjectId("owner/repo-a")).resolves.toBe("repo-a-id");
    await expect(readScopedEasProjectId("owner/repo-b")).resolves.toBe("global-id");
  });

  it("persists scoped values without silently clearing legacy fallback for other repos", async () => {
    await persistScopedEasProjectId({ projectId: "repo-b-id", repoFullName: "owner/repo-b" });

    await expect(AsyncStorage.getItem(`${STORAGE_KEYS.EAS_PROJECT_ID}::owner%2Frepo-b`)).resolves.toBe("repo-b-id");
    await expect(AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID)).resolves.toBe("repo-b-id");

    await persistScopedEasProjectId({ projectId: "", repoFullName: "owner/repo-b" });
    await expect(AsyncStorage.getItem(`${STORAGE_KEYS.EAS_PROJECT_ID}::owner%2Frepo-b`)).resolves.toBeNull();
  });
});

