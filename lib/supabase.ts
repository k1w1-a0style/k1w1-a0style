import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Alert } from 'react-native';

const supabaseUrlKey = 'supabase_url';
const supabaseAnonKeyKey = 'supabase_key';

let supabaseInstance: SupabaseClient | null = null;
let initializationPromise: Promise<SupabaseClient> | null = null;

const createDummyClient = (): SupabaseClient => {
    console.warn("Erstelle Dummy Supabase Client.");
    const dummyError = { message: 'Supabase client not initialized. Please check settings.', code: 'DUMMY_CLIENT' };
    return {
        from: (table: string) => ({
             select: async (select?: string, options?: any) => ({ data: null, error: dummyError }),
             insert: async (values: any | any[], options?: any) => ({ data: null, error: dummyError }),
             update: async (values: any, options?: any) => ({ data: null, error: dummyError }),
             delete: async (options?: any) => ({ data: null, error: dummyError }),
             // @ts-ignore
             eq: () => createDummyClient().from(table),
        }),
        functions: {
            // @ts-ignore
            invoke: async (functionName: string, options?: any) => ({ data: null, error: { ...dummyError, context: { status: 500 } } }),
        },
        auth: {
            // @ts-ignore
            signInWithPassword: async (credentials: any) => ({ data: null, error: dummyError }),
            signUp: async (credentials: any) => ({ data: null, error: dummyError }),
            signOut: async () => ({ error: null }),
        },
        storage: {
            // @ts-ignore
             from: (bucketId: string) => ({
                 upload: async (path: string, file: any, options?: any) => ({ data: null, error: dummyError }),
                 download: async (path: string, options?: any) => ({ data: null, error: dummyError }),
             }),
        },
    } as unknown as SupabaseClient;
};

const initializeSupabase = async (): Promise<SupabaseClient> => {
  console.log("Starte Supabase Initialisierung...");
  try {
    const supabaseUrl = await AsyncStorage.getItem(supabaseUrlKey);
    const supabaseAnonKey = await AsyncStorage.getItem(supabaseAnonKeyKey);

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("Supabase URL/Key fehlt im Storage.");
      if (!supabaseInstance) supabaseInstance = createDummyClient();
      return supabaseInstance;
    }

    if (!supabaseInstance || supabaseInstance.supabaseUrl !== supabaseUrl || supabaseInstance.supabaseKey !== supabaseAnonKey) {
        console.log("Erstelle/Aktualisiere echten Supabase Client.");
        supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    } else {
        console.log("Echter Supabase Client ist bereits aktuell.");
    }
    return supabaseInstance;

  } catch (error) {
    console.error("Fehler bei Supabase Initialisierung:", error);
    if (!supabaseInstance) supabaseInstance = createDummyClient();
    return supabaseInstance;
  }
};

export const ensureSupabaseClient = (): Promise<SupabaseClient> => {
  if (supabaseInstance) {
    return Promise.resolve(supabaseInstance);
  }
  if (!initializationPromise) {
    initializationPromise = initializeSupabase();
  }
  return initializationPromise;
};

export const refreshSupabaseCredentialsAndClient = async (): Promise<SupabaseClient> => {
  console.log("Erzwinge Neuladen von Supabase Credentials & Client...");
  initializationPromise = null;
  supabaseInstance = null;
  return await ensureSupabaseClient();
};
