jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ auth: {} })),
}));

jest.mock("../supabaseAnonKeyStorage", () => ({
  readSupabaseAnonKeyDetailed: jest.fn(async () => ({ value: "stored-anon-key", unreadable: false })),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { ensureSupabaseClient, resetSupabaseClient } from "../supabase";
import { readSupabaseRuntimeConfigDetailed } from "../supabaseRuntimeConfig";
import { STORAGE_KEYS } from "../storageKeys";
import { readSupabaseAnonKeyDetailed } from "../supabaseAnonKeyStorage";

describe("supabase runtime config", () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(async () => {
    resetSupabaseClient();
    await AsyncStorage.clear();
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });

  it("does not mutate process.env while resolving stored runtime config", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, "https://stored.supabase.co");
    await ensureSupabaseClient();

    expect(process.env.EXPO_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined();
  });

  it("marks invalid url config separately from missing values", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, "not-a-url");
    (readSupabaseAnonKeyDetailed as jest.Mock).mockResolvedValueOnce({ value: "stored-anon-key", unreadable: false });

    const result = await readSupabaseRuntimeConfigDetailed();

    expect(result.url).toBeNull();
    expect(result.urlReason).toBe("invalid");
    expect(result.anonKeyReason).toBe("ok");
  });

  it("marks unreadable config reads as unreadable", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("storage io failed"));
    (readSupabaseAnonKeyDetailed as jest.Mock).mockResolvedValueOnce({ value: null, unreadable: true });

    const result = await readSupabaseRuntimeConfigDetailed();

    expect(result.urlReason).toBe("unreadable");
    expect(result.anonKeyReason).toBe("unreadable");
  });

  it("reports supabase init error as unreadable when anon-key read is unreadable", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, "https://stored.supabase.co");
    (readSupabaseAnonKeyDetailed as jest.Mock).mockResolvedValueOnce({ value: null, unreadable: true });

    await expect(ensureSupabaseClient()).rejects.toMatchObject({
      name: "SupabaseInitError",
      code: "supabase_config_unreadable",
    });
  });
});
