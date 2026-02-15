// lib/supabaseEdge.ts
// Shared helper to resolve Supabase Edge base URL at runtime.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { CONFIG } from "../config";
import { STORAGE_KEYS } from "./storageKeys";

/**
 * Returns the Supabase Edge Functions base URL.
 *
 * Priority:
 * 1) Runtime URL from ConnectionsScreen (AsyncStorage)
 * 2) EXPO_PUBLIC_SUPABASE_URL (if set)
 * 3) Static config fallback
 */
export async function getSupabaseEdgeUrl(): Promise<string> {
  const storedUrl = await AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL).catch(
    () => null,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envUrl = ((typeof process !== "undefined"
    ? (process as any).env?.EXPO_PUBLIC_SUPABASE_URL
    : null) as string | null) ?? null;

  const runtimeUrl = (storedUrl || envUrl || "").trim();
  if (runtimeUrl) {
    return `${runtimeUrl.replace(/\/$/, "")}/functions/v1`;
  }

  return CONFIG.API.SUPABASE_EDGE_URL;
}
