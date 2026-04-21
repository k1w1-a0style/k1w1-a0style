import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./storageKeys";
import { readSupabaseAnonKeyDetailed } from "./supabaseAnonKeyStorage";
import { deriveSupabaseUrl, normalizeStoredSupabaseRaw } from "../screens/ConnectionsScreen/utils/validation";

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

export type SupabaseRuntimeCredentialReason = "ok" | "missing" | "invalid" | "unreadable";

export type SupabaseRuntimeConfigDetailed = {
  url: string | null;
  anonKey: string | null;
  urlReason: SupabaseRuntimeCredentialReason;
  anonKeyReason: SupabaseRuntimeCredentialReason;
};

async function readStoredSupabaseUrl(): Promise<{ value: string | null; unreadable: boolean }> {
  try {
    const [storedRaw, storedUrlMirror] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_RAW),
      AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL),
    ]);
    const normalizedRaw = normalizeStoredSupabaseRaw(storedRaw ?? "", storedUrlMirror ?? "");
    const derivedFromRaw = normalizeSupabaseUrl(deriveSupabaseUrl(normalizedRaw).url);
    if (derivedFromRaw) {
      return { value: derivedFromRaw, unreadable: false };
    }
    return {
      value: storedUrlMirror,
      unreadable: false,
    };
  } catch {
    return {
      value: null,
      unreadable: true,
    };
  }
}

async function readStoredSupabaseAnonKey(): Promise<{ value: string | null; unreadable: boolean }> {
  return readSupabaseAnonKeyDetailed();
}

export async function readSupabaseRuntimeConfigDetailed(): Promise<SupabaseRuntimeConfigDetailed> {
  const [storedUrlRead, storedAnonRead] = await Promise.all([
    readStoredSupabaseUrl(),
    readStoredSupabaseAnonKey(),
  ]);

  const storedSupabaseUrl = storedUrlRead.value;
  const storedSupabaseAnonKey = storedAnonRead.value;
  const runtimeProcess = getRuntimeProcess();
  const runtimeSupabaseUrl = runtimeProcess?.env?.EXPO_PUBLIC_SUPABASE_URL ?? null;
  const runtimeSupabaseAnonKey = runtimeProcess?.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? null;

  const normalizedStoredUrl = normalizeSupabaseUrl(storedSupabaseUrl);
  const normalizedRuntimeUrl = normalizeSupabaseUrl(runtimeSupabaseUrl);
  const normalizedStoredAnonKey = readNonEmptyTrimmed(storedSupabaseAnonKey);
  const normalizedRuntimeAnonKey = readNonEmptyTrimmed(runtimeSupabaseAnonKey);

  const url = normalizedStoredUrl ?? normalizedRuntimeUrl;
  const anonKey = normalizedStoredAnonKey ?? normalizedRuntimeAnonKey;

  const storedUrlRaw = readNonEmptyTrimmed(storedSupabaseUrl);
  const runtimeUrlRaw = readNonEmptyTrimmed(runtimeSupabaseUrl);
  const urlReason: SupabaseRuntimeCredentialReason = url
    ? "ok"
    : storedUrlRead.unreadable
      ? "unreadable"
      : (storedUrlRaw || runtimeUrlRaw)
        ? "invalid"
        : "missing";

  const storedAnonRaw = readNonEmptyTrimmed(storedSupabaseAnonKey);
  const runtimeAnonRaw = readNonEmptyTrimmed(runtimeSupabaseAnonKey);
  const anonKeyReason: SupabaseRuntimeCredentialReason = anonKey
    ? "ok"
    : storedAnonRead.unreadable
      ? "unreadable"
      : (storedAnonRaw || runtimeAnonRaw)
        ? "invalid"
        : "missing";

  return {
    url,
    anonKey,
    urlReason,
    anonKeyReason,
  };
}

export async function readSupabaseRuntimeConfig(): Promise<{ url: string | null; anonKey: string | null }> {
  const detailed = await readSupabaseRuntimeConfigDetailed();
  return {
    url: detailed.url,
    anonKey: detailed.anonKey,
  };
}
