import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  resetDerivedStatusAfterSecretImport,
  restoreDerivedStatusAfterSecretImportRollback,
  snapshotDerivedStatusBeforeSecretImport,
} from "../screens/AppInfoScreen/hooks/secretImportStatusReset";
import { STORAGE_KEYS } from "../lib/storageKeys";

type MockAsyncStorage = typeof AsyncStorage & {
  __resetMockStorage: () => void;
  __setMockStorage: (next: Record<string, string>) => void;
};

describe("secret import derived status reset", () => {
  const storage = AsyncStorage as MockAsyncStorage;

  beforeEach(() => {
    storage.__resetMockStorage();
  });

  it("removes static and dynamic status keys while keeping unrelated keys", async () => {
    storage.__setMockStorage({
      [STORAGE_KEYS.CONN_GITHUB_OK]: "true",
      [`${STORAGE_KEYS.CRED_KEY_EXISTS_DEV}::project%3Aabc`]: "true",
      [`${STORAGE_KEYS.DIAGNOSTIC_LAST_OK}::owner%2Frepo::main`]: "true",
      [`${STORAGE_KEYS.CI_LITE_SCOPED_SNAPSHOT}::owner%2Frepo::main`]: "{\"ok\":true}",
      [STORAGE_KEYS.SUPABASE_URL]: "https://example.supabase.co",
      keep_me: "1",
    });

    await resetDerivedStatusAfterSecretImport();

    expect(await AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_OK)).toBeNull();
    expect(await AsyncStorage.getItem(`${STORAGE_KEYS.CRED_KEY_EXISTS_DEV}::project%3Aabc`)).toBeNull();
    expect(await AsyncStorage.getItem(`${STORAGE_KEYS.DIAGNOSTIC_LAST_OK}::owner%2Frepo::main`)).toBeNull();
    expect(await AsyncStorage.getItem(`${STORAGE_KEYS.CI_LITE_SCOPED_SNAPSHOT}::owner%2Frepo::main`)).toBeNull();

    expect(await AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL)).toBe("https://example.supabase.co");
    expect(await AsyncStorage.getItem("keep_me")).toBe("1");
  });

  it("can snapshot and restore removed derived status keys for rollback", async () => {
    storage.__setMockStorage({
      [STORAGE_KEYS.CONN_GITHUB_OK]: "true",
      [STORAGE_KEYS.CONN_EXPO_USER]: "expo-user",
      [`${STORAGE_KEYS.CI_LITE_SCOPED_SNAPSHOT}::owner%2Frepo::main`]: "{\"ok\":true}",
      keep_me: "1",
    });
    const snapshot = await snapshotDerivedStatusBeforeSecretImport();

    await resetDerivedStatusAfterSecretImport();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_OK)).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.CONN_EXPO_USER)).toBeNull();

    await restoreDerivedStatusAfterSecretImportRollback(snapshot);
    expect(await AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_OK)).toBe("true");
    expect(await AsyncStorage.getItem(STORAGE_KEYS.CONN_EXPO_USER)).toBe("expo-user");
    expect(await AsyncStorage.getItem(`${STORAGE_KEYS.CI_LITE_SCOPED_SNAPSHOT}::owner%2Frepo::main`)).toBe("{\"ok\":true}");
    expect(await AsyncStorage.getItem("keep_me")).toBe("1");
  });
});
