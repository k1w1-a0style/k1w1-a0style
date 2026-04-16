import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { runCleanupTask, runWithCleanupFallback } from "./safeCleanup";
import { STORAGE_KEYS } from "./storageKeys";

const SUPABASE_ANON_SECURE_KEY = "supabase_anon_key_v1";

export type SupabaseAnonKeyReadDetailed = {
  value: string | null;
  unreadable: boolean;
};

export async function readSupabaseAnonKeyDetailed(): Promise<SupabaseAnonKeyReadDetailed> {
  let secureValue: string | null = null;
  let secureUnreadable = false;
  try {
    secureValue = await SecureStore.getItemAsync(SUPABASE_ANON_SECURE_KEY);
  } catch {
    secureUnreadable = true;
  }

  const normalizedSecure = String(secureValue ?? "").trim();
  if (normalizedSecure) {
    return { value: normalizedSecure, unreadable: false };
  }

  let legacyValue: string | null = null;
  let legacyUnreadable = false;
  try {
    legacyValue = await AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_KEY);
  } catch {
    legacyUnreadable = true;
  }
  if (!legacyValue) {
    return { value: null, unreadable: secureUnreadable || legacyUnreadable };
  }

  const normalizedLegacy = legacyValue.trim();
  if (!normalizedLegacy) {
    await runCleanupTask(
      () => AsyncStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY),
      "[supabaseAnonKeyStorage] remove empty legacy value failed",
    );
    return { value: null, unreadable: secureUnreadable || legacyUnreadable };
  }

  const migratedToSecureStore = await runWithCleanupFallback(
    async () => {
      await SecureStore.setItemAsync(SUPABASE_ANON_SECURE_KEY, normalizedLegacy);
      return true;
    },
    false,
    "[supabaseAnonKeyStorage] migrate to secure store failed",
  );

  if (migratedToSecureStore) {
    await runCleanupTask(
      () => AsyncStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY),
      "[supabaseAnonKeyStorage] remove migrated legacy value failed",
    );
  }

  return { value: normalizedLegacy, unreadable: false };
}

export async function getSupabaseAnonKey(): Promise<string | null> {
  const detailed = await readSupabaseAnonKeyDetailed();
  return detailed.value;
}

export async function saveSupabaseAnonKey(value: string): Promise<void> {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    await deleteSupabaseAnonKey();
    return;
  }

  await SecureStore.setItemAsync(SUPABASE_ANON_SECURE_KEY, normalized);
  await runCleanupTask(
    () => AsyncStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY),
    "[supabaseAnonKeyStorage] remove legacy key after save failed",
  );
}

export async function deleteSupabaseAnonKey(): Promise<void> {
  await runCleanupTask(
    () => SecureStore.deleteItemAsync(SUPABASE_ANON_SECURE_KEY),
    "[supabaseAnonKeyStorage] secure delete failed",
  );
  await runCleanupTask(
    () => AsyncStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY),
    "[supabaseAnonKeyStorage] legacy delete failed",
  );
}
