import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { runCleanupTask, runWithCleanupFallback } from "./safeCleanup";
import { STORAGE_KEYS } from "./storageKeys";

const SUPABASE_ANON_SECURE_KEY = "supabase_anon_key_v1";

export async function getSupabaseAnonKey(): Promise<string | null> {
  const secureValue = await runWithCleanupFallback(
    () => SecureStore.getItemAsync(SUPABASE_ANON_SECURE_KEY),
    null,
    "[supabaseAnonKeyStorage] secure read failed",
  );
  if (secureValue) {
    return secureValue;
  }

  const legacyValue = await runWithCleanupFallback(
    () => AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_KEY),
    null,
    "[supabaseAnonKeyStorage] legacy read failed",
  );
  if (!legacyValue) {
    return null;
  }

  const normalized = legacyValue.trim();
  if (!normalized) {
    await runCleanupTask(
      () => AsyncStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY),
      "[supabaseAnonKeyStorage] remove empty legacy value failed",
    );
    return null;
  }

  const migratedToSecureStore = await runWithCleanupFallback(
    async () => {
      await SecureStore.setItemAsync(SUPABASE_ANON_SECURE_KEY, normalized);
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

  return normalized;
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
