import { createClient, SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./storageKeys";

let supabaseClient: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

const setRuntimeEnvFromSupabase = (url: string, anonKey: string) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyProcess = process as any;

    if (!anyProcess.env) {
      anyProcess.env = {};
    }

    if (!anyProcess.env.EXPO_PUBLIC_SUPABASE_URL) {
      anyProcess.env.EXPO_PUBLIC_SUPABASE_URL = url;
    }

    if (!anyProcess.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
      anyProcess.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = anonKey;
    }
  } catch (e) {
    // Do not leak details (URL/key) into logs.
    if (__DEV__) {
      console.warn("⚠️ Konnte Supabase Runtime-Env nicht setzen.");
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
      let supabaseUrl = await AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL);
      let supabaseAnonKey = await AsyncStorage.getItem(
        STORAGE_KEYS.SUPABASE_KEY,
      );

      // 2) Fallback: bestehende Runtime-Env
      if (!supabaseUrl && typeof process !== "undefined") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabaseUrl = (process as any).env?.EXPO_PUBLIC_SUPABASE_URL;
      }
      if (!supabaseAnonKey && typeof process !== "undefined") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabaseAnonKey = (process as any).env?.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      }

      if (!supabaseUrl || !supabaseAnonKey) {
        // ✅ FIX: Setze initPromise erst NACH dem Error werfen
        const error = new Error(
          "Supabase Credentials fehlen. Bitte in Verbindungen eintragen.",
        );
        initPromise = null;
        throw error;
      }

      // Bridge → Orchestrator & Co sehen die Variablen
      setRuntimeEnvFromSupabase(supabaseUrl, supabaseAnonKey);

      if (__DEV__) {
        console.log("✅ Supabase Client erstellt");
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
    console.log("Supabase Client wurde zurückgesetzt.");
  }
};
