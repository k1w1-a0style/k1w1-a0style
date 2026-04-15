import { createClient, SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "./logger";
import { readSupabaseRuntimeConfig } from "./supabaseRuntimeConfig";

let supabaseClient: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

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
      const runtimeConfig = await readSupabaseRuntimeConfig();
      const supabaseUrl = runtimeConfig.url;
      const supabaseAnonKey = runtimeConfig.anonKey;

      if (!supabaseUrl || !supabaseAnonKey) {
        const error = new Error(
          "Supabase Credentials fehlen oder sind ungültig. Bitte in Verbindungen eintragen.",
        );
        initPromise = null;
        throw error;
      }

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
