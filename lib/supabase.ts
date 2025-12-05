import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Mutex } from 'async-mutex';

let supabaseClient: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

// ✅ SICHERHEIT: Mutex verhindert Race Conditions bei parallelen Init-Aufrufen
const initMutex = new Mutex();

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

/**
 * Stellt sicher, dass ein Supabase-Client initialisiert ist.
 * 
 * ✅ THREAD-SAFE: Verwendet Mutex zur Vermeidung von Race Conditions
 * 
 * @returns Initialisierter Supabase-Client
 * @throws Error wenn Credentials fehlen
 */
export const ensureSupabaseClient = async (): Promise<SupabaseClient> => {
  // ✅ Fast Path: Client bereits initialisiert (kein Lock nötig)
  if (supabaseClient) {
    return supabaseClient;
  }

  // ✅ RACE CONDITION SCHUTZ: Mutex Lock
  return await initMutex.runExclusive(async () => {
    // Double-Check nach Lock-Erhalt (ein anderer Thread könnte initialisiert haben)
    if (supabaseClient) {
      return supabaseClient;
    }

    // Läuft schon eine Initialisierung? (sollte durch Mutex verhindert werden)
    if (initPromise) {
      console.log('⏳ Warte auf laufende Supabase Initialisierung...');
      return initPromise;
    }

    console.log('🚀 Starte Supabase Initialisierung...');

    initPromise = (async () => {
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
      initPromise = null;
      throw new Error('Supabase Credentials fehlen. Bitte in Verbindungen eintragen.');
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

      initPromise = null;
      return supabaseClient;
    })();

    return initPromise;
  });
};

// Optional: manuell resetten
export const resetSupabaseClient = () => {
  supabaseClient = null;
  initPromise = null;
  console.log('Supabase Client wurde zurückgesetzt.');
};
