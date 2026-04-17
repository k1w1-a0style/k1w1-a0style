import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { STORAGE_KEYS } from "../storageKeys";
import {
  deleteSupabaseAnonKey,
  getSupabaseAnonKey,
  readSupabaseAnonKeyDetailed,
  saveSupabaseAnonKey,
} from "../supabaseAnonKeyStorage";

const secureStoreMock = SecureStore as unknown as {
  __resetMockStorage: () => void;
  __getMockStorage: () => Record<string, string>;
};

const asyncStorageMock = AsyncStorage as unknown as {
  __resetMockStorage: () => void;
  __setMockStorage: (storage: Record<string, string>) => void;
  __getMockStorage: () => Record<string, string>;
};

describe("supabaseAnonKeyStorage", () => {
  beforeEach(() => {
    secureStoreMock.__resetMockStorage();
    asyncStorageMock.__resetMockStorage();
  });

  it("saves anon key in SecureStore and removes legacy AsyncStorage key", async () => {
    await saveSupabaseAnonKey("anon-secret");

    expect(secureStoreMock.__getMockStorage().supabase_anon_key_v1).toBe("anon-secret");
    expect(asyncStorageMock.__getMockStorage()[STORAGE_KEYS.SUPABASE_KEY]).toBeUndefined();
  });

  it("migrates legacy AsyncStorage anon key into SecureStore on read", async () => {
    asyncStorageMock.__setMockStorage({ [STORAGE_KEYS.SUPABASE_KEY]: "legacy-anon" });

    const value = await getSupabaseAnonKey();

    expect(value).toBe("legacy-anon");
    expect(secureStoreMock.__getMockStorage().supabase_anon_key_v1).toBe("legacy-anon");
    expect(asyncStorageMock.__getMockStorage()[STORAGE_KEYS.SUPABASE_KEY]).toBeUndefined();
  });



  it("keeps legacy AsyncStorage anon key when SecureStore migration fails", async () => {
    asyncStorageMock.__setMockStorage({ [STORAGE_KEYS.SUPABASE_KEY]: "legacy-anon" });
    const setItemSpy = jest
      .spyOn(SecureStore, "setItemAsync")
      .mockRejectedValueOnce(new Error("secure-store-write-failed"));

    const value = await getSupabaseAnonKey();

    expect(value).toBe("legacy-anon");
    expect(secureStoreMock.__getMockStorage().supabase_anon_key_v1).toBeUndefined();
    expect(asyncStorageMock.__getMockStorage()[STORAGE_KEYS.SUPABASE_KEY]).toBe("legacy-anon");

    setItemSpy.mockRestore();
  });

  it("deletes anon key from both stores", async () => {
    await saveSupabaseAnonKey("anon-secret");
    asyncStorageMock.__setMockStorage({ [STORAGE_KEYS.SUPABASE_KEY]: "legacy" });

    await deleteSupabaseAnonKey();

    expect(secureStoreMock.__getMockStorage().supabase_anon_key_v1).toBeUndefined();
    expect(asyncStorageMock.__getMockStorage()[STORAGE_KEYS.SUPABASE_KEY]).toBeUndefined();
  });

  it("classifies real local read errors as unreadable in detailed read path", async () => {
    const secureReadSpy = jest.spyOn(SecureStore, "getItemAsync").mockRejectedValueOnce(new Error("secure read failed"));
    const legacyReadSpy = jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("legacy read failed"));

    const result = await readSupabaseAnonKeyDetailed();

    expect(result).toEqual({ value: null, unreadable: true });

    secureReadSpy.mockRestore();
    legacyReadSpy.mockRestore();
  });
});
