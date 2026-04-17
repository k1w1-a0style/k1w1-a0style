import { createClient, SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "./logger";
import {
  readSupabaseRuntimeConfigDetailed,
  type SupabaseRuntimeCredentialReason,
} from "./supabaseRuntimeConfig";

let supabaseClient: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

export type SupabaseInitFailureCode =
  | "supabase_config_missing"
  | "supabase_config_invalid"
  | "supabase_config_unreadable";

export class SupabaseInitError extends Error {
  readonly code: SupabaseInitFailureCode;

  constructor(code: SupabaseInitFailureCode, message: string) {
    super(message);
    this.name = "SupabaseInitError";
    this.code = code;
  }
}

function hasReason(
  reasons: [SupabaseRuntimeCredentialReason, SupabaseRuntimeCredentialReason],
  match: SupabaseRuntimeCredentialReason,
): boolean {
  return reasons[0] === match || reasons[1] === match;
}

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
      const runtimeConfig = await readSupabaseRuntimeConfigDetailed();
      const supabaseUrl = runtimeConfig.url;
      const supabaseAnonKey = runtimeConfig.anonKey;

      if (!supabaseUrl || !supabaseAnonKey) {
        const reasons: [SupabaseRuntimeCredentialReason, SupabaseRuntimeCredentialReason] = [
          runtimeConfig.urlReason,
          runtimeConfig.anonKeyReason,
        ];
        const code: SupabaseInitFailureCode = hasReason(reasons, "unreadable")
          ? "supabase_config_unreadable"
          : hasReason(reasons, "invalid")
            ? "supabase_config_invalid"
            : "supabase_config_missing";

        const error = new SupabaseInitError(
          code,
          code === "supabase_config_unreadable"
            ? "Supabase-Konfiguration konnte lokal nicht gelesen werden (SecureStore/Storage unreadable)."
            : code === "supabase_config_invalid"
              ? "Supabase-Konfiguration ist vorhanden, aber ungültig."
              : "Supabase Credentials fehlen. Bitte in Verbindungen eintragen.",
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
