// lib/supabaseEdge.ts
// Shared helper to resolve Supabase Edge base URL at runtime.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { CONFIG } from "../config";
import { logger } from "./logger";
import { STORAGE_KEYS } from "./storageKeys";
import { deriveSupabaseUrl, normalizeStoredSupabaseRaw } from "../screens/ConnectionsScreen/utils/validation";
import { normalizeSupabaseUrl } from "./supabaseRuntimeConfig";

/**
 * Returns the Supabase Edge Functions base URL.
 *
 * Priority:
 * 1) Runtime URL from ConnectionsScreen (AsyncStorage)
 * 2) EXPO_PUBLIC_SUPABASE_URL (if set)
 * 3) Static config fallback
 */
export const SUPABASE_URL_MISSING_ERROR = "Supabase URL fehlt. Bitte in Verbindungen/Credentials setzen (oder EXPO_PUBLIC_SUPABASE_URL als Env setzen).";

const getRuntimeEnv = (): Record<string, string | undefined> | null => {
  if (typeof process === "undefined") return null;
  const runtime = process as { env?: Record<string, string | undefined> };
  return runtime.env ?? null;
};

async function readStoredSupabaseUrlDetailed(): Promise<{
  value: string | null;
  unreadable: boolean;
}> {
  try {
    const [storedRaw, storedUrlMirror] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_RAW),
      AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL),
    ]);
    const normalizedRaw = normalizeStoredSupabaseRaw(storedRaw ?? "", storedUrlMirror ?? "");
    const derivedUrl = normalizeSupabaseUrl(deriveSupabaseUrl(normalizedRaw).url);
    const normalizedMirror = normalizeSupabaseUrl(storedUrlMirror);
    return {
      // SUPABASE_RAW remains canonical; mirror is only legacy/compat fallback.
      value: derivedUrl ?? normalizedMirror,
      unreadable: false,
    };
  } catch (error: unknown) {
    logger.warn("[supabaseEdge] Stored Supabase URL unreadable; falling back to env/static config.", {
      error,
    });
    return {
      value: null,
      unreadable: true,
    };
  }
}

export async function getSupabaseEdgeUrl(): Promise<string> {
  const storedUrlRead = await readStoredSupabaseUrlDetailed();
  const storedUrl = storedUrlRead.value;

  const envUrl = getRuntimeEnv()?.EXPO_PUBLIC_SUPABASE_URL ?? null;
  const staticUrl = CONFIG.API.SUPABASE_EDGE_URL;

  const runtimeUrl = (storedUrl || envUrl || "").trim();
  if (runtimeUrl) {
    return `${runtimeUrl.replace(/\/$/, "")}/functions/v1`;
  }

  if (storedUrlRead.unreadable && staticUrl) {
    logger.warn("[supabaseEdge] Using static Supabase Edge URL fallback after unreadable stored config.");
  }

  return staticUrl;
}

export async function requireSupabaseEdgeUrl(): Promise<string> {
  const url = await getSupabaseEdgeUrl();
  if (!url) {
    throw new Error(
      SUPABASE_URL_MISSING_ERROR,
    );
  }
  return url;
}
