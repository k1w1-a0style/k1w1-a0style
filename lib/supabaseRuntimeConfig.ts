import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./storageKeys";
import { getSupabaseAnonKey } from "./supabaseAnonKeyStorage";

type RuntimeProcess = {
  env?: Record<string, string | undefined>;
};

function getRuntimeProcess(): RuntimeProcess | null {
  if (typeof process === "undefined") return null;
  return process as RuntimeProcess;
}

function readNonEmptyTrimmed(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function normalizeSupabaseUrl(value: string | null | undefined): string | null {
  const trimmed = readNonEmptyTrimmed(value);
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export async function readSupabaseRuntimeConfig(): Promise<{ url: string | null; anonKey: string | null }> {
  const [storedSupabaseUrl, storedSupabaseAnonKey] = await Promise.all([
    Promise.resolve(AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL)).catch(() => null),
    Promise.resolve(getSupabaseAnonKey()).catch(() => null),
  ]);

  const runtimeProcess = getRuntimeProcess();
  const runtimeSupabaseUrl = runtimeProcess?.env?.EXPO_PUBLIC_SUPABASE_URL ?? null;
  const runtimeSupabaseAnonKey = runtimeProcess?.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? null;

  return {
    url: normalizeSupabaseUrl(storedSupabaseUrl) ?? normalizeSupabaseUrl(runtimeSupabaseUrl),
    anonKey: readNonEmptyTrimmed(storedSupabaseAnonKey) ?? readNonEmptyTrimmed(runtimeSupabaseAnonKey),
  };
}
