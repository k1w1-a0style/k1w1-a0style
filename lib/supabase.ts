import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toAppError, logAppError } from '../utils/errorUtils';
import {
  deriveSupabaseDetails,
  SUPABASE_STORAGE_KEYS,
} from './supabaseConfig';

let supabaseClient: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

const STORAGE_URL_KEY = SUPABASE_STORAGE_KEYS.URL;
const STORAGE_RAW_KEY = SUPABASE_STORAGE_KEYS.RAW;
const STORAGE_ANON_KEY = SUPABASE_STORAGE_KEYS.KEY;

const setRuntimeEnvFromSupabase = (url: string, anonKey: string) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyProcess = process as any;
    if (!anyProcess.env) {
      anyProcess.env = {};
    }

    if (!anyProcess.env.EXPO_PUBLIC_SUPABASE_URL) {
      anyProcess.env.EXPO_PUBLIC_SUPABASE_URL = url;
      // eslint-disable-next-line no-console
      console.log('🌐 Runtime EXPO_PUBLIC_SUPABASE_URL gesetzt (aus Settings).');
    }

    if (!anyProcess.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
      anyProcess.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = anonKey;
      // eslint-disable-next-line no-console
      console.log('🔑 Runtime EXPO_PUBLIC_SUPABASE_ANON_KEY gesetzt (aus Settings).');
    }
  } catch (e) {
    const appError = toAppError(e, {
      code: 'SUPABASE_ENV_BRIDGE_FAILED',
      message:
        'Konnte process.env nicht setzen (nicht kritisch, nur für Orchestrator-Bridge).',
    });
    logAppError(appError, 'setRuntimeEnvFromSupabase');
    // eslint-disable-next-line no-console
    console.warn('⚠️ Konnte process.env nicht setzen (nicht kritisch):', e);
  }
};

export const ensureSupabaseClient = async (): Promise<SupabaseClient> => {
  // Bereits initialisiert?
  if (supabaseClient) {
    return supabaseClient;
  }

  // Läuft schon eine Initialisierung?
  if (initPromise) {
    // eslint-disable-next-line no-console
    console.log('⏳ Warte auf laufende Supabase Initialisierung...');
    return initPromise;
  }

  // eslint-disable-next-line no-console
  console.log('Starte Supabase Initialisierung...');

  initPromise = (async () => {
    try {
      // 1) Werte aus deinen App-Settings (AsyncStorage)
      const [storedUrl, supabaseAnonKeyRaw, storedRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_URL_KEY),
        AsyncStorage.getItem(STORAGE_ANON_KEY),
        AsyncStorage.getItem(STORAGE_RAW_KEY),
      ]);

      let supabaseUrl = storedUrl;
      let supabaseAnonKey = supabaseAnonKeyRaw;

      if (!supabaseUrl && storedRaw) {
        const derived = deriveSupabaseDetails(storedRaw);
        if (derived.url) {
          supabaseUrl = derived.url;
          try {
            await AsyncStorage.setItem(STORAGE_URL_KEY, derived.url);
          } catch (setErr) {
            // eslint-disable-next-line no-console
            console.warn(
              '[ensureSupabaseClient] Konnte supabase_url nicht persistieren:',
              setErr,
            );
          }
        }
      }

      // 2) Fallback: bestehende Runtime-Env
      if (!supabaseUrl && typeof process !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabaseUrl = (process as any).env?.EXPO_PUBLIC_SUPABASE_URL;
      }
      if (!supabaseAnonKey && typeof process !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabaseAnonKey = (process as any).env?.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      }

      if (!supabaseUrl || !supabaseAnonKey) {
        // eslint-disable-next-line no-console
        console.error('❌ Supabase URL oder Anon Key fehlt!');
        // eslint-disable-next-line no-console
        console.log('AsyncStorage URL:', supabaseUrl ? 'OK' : 'FEHLT');
        // eslint-disable-next-line no-console
        console.log('AsyncStorage Key:', supabaseAnonKey ? 'OK' : 'FEHLT');

        initPromise = null;

        const error = new Error(
          'Supabase Credentials fehlen. Bitte in Verbindungen eintragen.',
        );
        const appError = toAppError(error, {
          code: 'SUPABASE_MISSING_CREDENTIALS',
        });
        logAppError(appError, 'ensureSupabaseClient');

        throw error;
      }

      // Bridge → Orchestrator & Co sehen die Variablen
      setRuntimeEnvFromSupabase(supabaseUrl, supabaseAnonKey);

      // eslint-disable-next-line no-console
      console.log(
        '✅ Erstelle Supabase Client mit URL:',
        supabaseUrl.substring(0, 30) + '...',
      );

      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      });

      initPromise = null;
      return supabaseClient;
    } catch (error) {
      // Alles, was in der Initialisierung schiefgeht, läuft hier zusammen
      const appError = toAppError(error, {
        code: 'SUPABASE_INIT_FAILED',
        message:
          error instanceof Error
            ? error.message
            : 'Supabase Initialisierung fehlgeschlagen.',
      });

      logAppError(appError, 'ensureSupabaseClient');

      // initPromise zurücksetzen, damit ein erneuter Versuch möglich ist
      initPromise = null;

      // Original-Fehlertext nach außen geben (Verhalten bleibt für Call-Sites gleich)
      throw new Error(appError.message);
    }
  })();

  return initPromise;
};

// Optional: manuell resetten
export const resetSupabaseClient = () => {
  supabaseClient = null;
  initPromise = null;
  // eslint-disable-next-line no-console
  console.log('Supabase Client wurde zurückgesetzt.');
};
