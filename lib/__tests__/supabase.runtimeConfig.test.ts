jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ auth: {} })),
}));

jest.mock("../supabaseAnonKeyStorage", () => ({
  getSupabaseAnonKey: jest.fn(async () => "stored-anon-key"),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { ensureSupabaseClient, resetSupabaseClient } from "../supabase";
import { STORAGE_KEYS } from "../storageKeys";

describe("supabase runtime config", () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(async () => {
    resetSupabaseClient();
    await AsyncStorage.clear();
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
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
});
