import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

let supabaseClient: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

export const ensureSupabaseClient = async (): Promise<SupabaseClient> => {
  // Falls bereits initialisiert → zurückgeben
  if (supabaseClient) {
    return supabaseClient;
  }

  // ✅ FIX: Falls gerade initialisiert wird → auf bestehendes Promise warten
  if (initPromise) {
    console.log('⏳ Warte auf laufende Supabase Initialisierung...');
    return initPromise;
  }

  console.log('Starte Supabase Initialisierung...');

  // Initialisierung kapseln
  initPromise = (async () => {
    let supabaseUrl = await AsyncStorage.getItem('supabase_url');
    let supabaseAnonKey = await AsyncStorage.getItem('supabase_key');

    // Fallback zu EXPO_PUBLIC env vars (falls nicht im Storage)
    if (!supabaseUrl) {
      supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
    }
    if (!supabaseAnonKey) {
      supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Supabase URL oder Anon Key fehlt!');
      console.log('AsyncStorage URL:', supabaseUrl ? 'OK' : 'FEHLT');
      console.log('AsyncStorage Key:', supabaseAnonKey ? 'OK' : 'FEHLT');
      initPromise = null; // Reset bei Fehler
      throw new Error('Supabase Credentials fehlen. Bitte in Verbindungen eintragen.');
    }

    console.log('✅ Erstelle Supabase Client mit URL:', supabaseUrl.substring(0, 30) + '...');

    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

    initPromise = null; // Initialisierung abgeschlossen
    return supabaseClient;
  })();

  return initPromise;
};

// Optional: Export für manuelles Reset (falls nötig)
export const resetSupabaseClient = () => {
  supabaseClient = null;
  initPromise = null;
  console.log('Supabase Client wurde zurückgesetzt.');
};
