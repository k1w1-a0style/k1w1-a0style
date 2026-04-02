import { createClient, SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./storageKeys";
import { logger } from "./logger";
import { getSupabaseAnonKey } from "./supabaseAnonKeyStorage";

let supabaseClient: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

type RuntimeProcess = {
  env?: Record<string, string | undefined>;
};

const getRuntimeProcess = (): RuntimeProcess | null => {
  if (typeof process === "undefined") return null;
  return process as RuntimeProcess;
};

function readNonEmptyTrimmed(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeSupabaseUrl(value: string | null | undefined): string | null {
  const trimmed = readNonEmptyTrimmed(value);
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

const setRuntimeEnvFromSupabase = (url: string, anonKey: string) => {
  try {
    const runtimeProcess = getRuntimeProcess();
    if (!runtimeProcess) return;

    if (!runtimeProcess.env) {
      runtimeProcess.env = {};
    }

    if (!runtimeProcess.env.EXPO_PUBLIC_SUPABASE_URL) {
      runtimeProcess.env.EXPO_PUBLIC_SUPABASE_URL = url;
    }

    if (!runtimeProcess.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
      runtimeProcess.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = anonKey;
    }
  } catch (e) {
    // Do not leak details (URL/key) into logs.
    if (__DEV__) {
      logger.warn("Could not set Supabase runtime env");
    }
  }
};

export const ensureSupabaseClient = async (): Promise<SupabaseClient> => {
  // Bereits initialisiert?
  if (supabaseClient) {
    return supabaseClient;
  }

  // Läuft schon eine Initialisierung?
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // 1) Werte aus deinen App-Settings (AsyncStorage)
      const storedSupabaseUrl = await AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL);
      const storedSupabaseAnonKey = await getSupabaseAnonKey();

      // 2) Fallback: bestehende Runtime-Env
      const runtimeProcess = getRuntimeProcess();
      const runtimeSupabaseUrl = runtimeProcess?.env?.EXPO_PUBLIC_SUPABASE_URL ?? null;
      const runtimeSupabaseAnonKey = runtimeProcess?.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? null;

      const supabaseUrl = normalizeSupabaseUrl(storedSupabaseUrl) ?? normalizeSupabaseUrl(runtimeSupabaseUrl);
      const supabaseAnonKey =
        readNonEmptyTrimmed(storedSupabaseAnonKey) ?? readNonEmptyTrimmed(runtimeSupabaseAnonKey);

      if (!supabaseUrl || !supabaseAnonKey) {
        const error = new Error(
          "Supabase Credentials fehlen oder sind ungültig. Bitte in Verbindungen eintragen.",
        );
        initPromise = null;
        throw error;
      }

      // Bridge → Orchestrator & Co sehen die Variablen
      setRuntimeEnvFromSupabase(supabaseUrl, supabaseAnonKey);

      if (__DEV__) {
        logger.info("✅ Supabase Client erstellt");
      }

      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      });

      // ✅ FIX: Setze initPromise erst NACH dem Client gesetzt wurde
      const client = supabaseClient;
      initPromise = null;
      return client;
    } catch (error) {
      // ✅ FIX: Stelle sicher, dass initPromise zurückgesetzt wird bei Fehlern
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
};

// Optional: manuell resetten
export const resetSupabaseClient = () => {
  supabaseClient = null;
  initPromise = null;
  if (__DEV__) {
    logger.info("Supabase Client wurde zurückgesetzt.");
  }
};
