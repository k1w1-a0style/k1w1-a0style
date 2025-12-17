import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

let supabaseClient: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

const STORAGE_URL_KEY = 'supabase_url';
const STORAGE_ANON_KEY = 'supabase_key';

const setRuntimeEnvFromSupabase = (url: string, anonKey: string) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyProcess = process as any;

    if (!anyProcess.env) {
      anyProcess.env = {};
    }

    if (!anyProcess.env.EXPO_PUBLIC_SUPABASE_URL) {
      anyProcess.env.EXPO_PUBLIC_SUPABASE_URL = url;
      console.log('🌐 Runtime EXPO_PUBLIC_SUPABASE_URL gesetzt (aus Settings).');
    }

    if (!anyProcess.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
      anyProcess.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = anonKey;
      console.log('🔑 Runtime EXPO_PUBLIC_SUPABASE_ANON_KEY gesetzt (aus Settings).');
    }
  } catch (e) {
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
    console.log('⏳ Warte auf laufende Supabase Initialisierung...');
    return initPromise;
  }

  console.log('Starte Supabase Initialisierung...');

  initPromise = (async () => {
    try {
      // 1) Werte aus deinen App-Settings (AsyncStorage)
      let supabaseUrl = await AsyncStorage.getItem(STORAGE_URL_KEY);
      let supabaseAnonKey = await AsyncStorage.getItem(STORAGE_ANON_KEY);

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
        console.error('❌ Supabase URL oder Anon Key fehlt!');
        console.log('AsyncStorage URL:', supabaseUrl ? 'OK' : 'FEHLT');
        console.log('AsyncStorage Key:', supabaseAnonKey ? 'OK' : 'FEHLT');
        // ✅ FIX: Setze initPromise erst NACH dem Error werfen
        const error = new Error('Supabase Credentials fehlen. Bitte in Verbindungen eintragen.');
        initPromise = null;
        throw error;
      }

      // Bridge → Orchestrator & Co sehen die Variablen
      setRuntimeEnvFromSupabase(supabaseUrl, supabaseAnonKey);

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
  console.log('Supabase Client wurde zurückgesetzt.');
};
