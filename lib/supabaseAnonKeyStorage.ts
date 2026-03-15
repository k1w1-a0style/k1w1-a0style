import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { STORAGE_KEYS } from "./storageKeys";

const SUPABASE_ANON_SECURE_KEY = "supabase_anon_key_v1";

export async function getSupabaseAnonKey(): Promise<string | null> {
  const secureValue = await SecureStore.getItemAsync(SUPABASE_ANON_SECURE_KEY).catch(() => null);
  if (secureValue) {
    return secureValue;
  }

  const legacyValue = await AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_KEY).catch(() => null);
  if (!legacyValue) {
    return null;
  }

  const normalized = legacyValue.trim();
  if (!normalized) {
    await AsyncStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY).catch(() => {});
    return null;
  }

  await SecureStore.setItemAsync(SUPABASE_ANON_SECURE_KEY, normalized).catch(() => {});
  await AsyncStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY).catch(() => {});
  return normalized;
}

export async function saveSupabaseAnonKey(value: string): Promise<void> {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    await deleteSupabaseAnonKey();
    return;
  }

  await SecureStore.setItemAsync(SUPABASE_ANON_SECURE_KEY, normalized);
  await AsyncStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY).catch(() => {});
}

export async function deleteSupabaseAnonKey(): Promise<void> {
  await SecureStore.deleteItemAsync(SUPABASE_ANON_SECURE_KEY).catch(() => {});
  await AsyncStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY).catch(() => {});
}
