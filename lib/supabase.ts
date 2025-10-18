import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Alert } from 'react-native';

const supabaseUrlKey = 'supabase_url';
const supabaseAnonKeyKey = 'supabase_key';

let supabaseInstance: SupabaseClient | null = null;
let initializationPromise: Promise<SupabaseClient> | null = null; // Promise für Initialisierung

const createDummyClient = (): SupabaseClient => { /* ... (wie vorher) ... */
    console.warn("Erstelle Dummy Supabase Client.");
    const dummyError = { message: 'Supabase client not initialized. Please check settings.', code: 'DUMMY_CLIENT' };
    return {
        from: (table: string) => ({
             select: async (select?: string, options?: any) => ({ data: null, error: dummyError }),
             insert: async (values: any | any[], options?: any) => ({ data: null, error: dummyError }),
             update: async (values: any, options?: any) => ({ data: null, error: dummyError }),
             delete: async (options?: any) => ({ data: null, error: dummyError }),
             eq: () => createDummyClient().from(table),
        }),
        functions: {
            invoke: async (functionName: string, options?: any) => ({ data: null, error: dummyError }),
        },
        auth: {
            signInWithPassword: async (credentials: any) => ({ data: null, error: dummyError }),
            signUp: async (credentials: any) => ({ data: null, error: dummyError }),
            signOut: async () => ({ error: null }),
        },
        storage: {
             from: (bucketId: string) => ({
                 upload: async (path: string, file: any, options?: any) => ({ data: null, error: dummyError }),
                 download: async (path: string, options?: any) => ({ data: null, error: dummyError }),
             }),
        },
    } as unknown as SupabaseClient;
};

// --- Initialisierungsfunktion gibt jetzt den Client zurück oder wirft Fehler ---
const initializeSupabase = async (): Promise<SupabaseClient> => {
  console.log("Starte Supabase Initialisierung...");
  try {
    const supabaseUrl = await AsyncStorage.getItem(supabaseUrlKey);
    const supabaseAnonKey = await AsyncStorage.getItem(supabaseAnonKeyKey);

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("Supabase URL/Key fehlt im Storage.");
      // Erstelle Dummy nur, wenn noch kein Client existiert
      if (!supabaseInstance) supabaseInstance = createDummyClient();
      return supabaseInstance; // Gib Dummy zurück
    }

    // Erstelle/Aktualisiere echten Client nur wenn nötig
    if (!supabaseInstance || supabaseInstance.supabaseUrl !== supabaseUrl || supabaseInstance.supabaseKey !== supabaseAnonKey) {
        console.log("Erstelle/Aktualisiere echten Supabase Client.");
        supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    } else {
        console.log("Echter Supabase Client ist bereits aktuell.");
    }
    return supabaseInstance; // Gib echten Client zurück

  } catch (error) {
    console.error("Fehler bei Supabase Initialisierung:", error);
    Alert.alert("Fehler", "Supabase Credentials konnten nicht geladen/verarbeitet werden.");
    // Erstelle Dummy nur, wenn noch kein Client existiert
    if (!supabaseInstance) supabaseInstance = createDummyClient();
    return supabaseInstance; // Gib Dummy im Fehlerfall zurück
  }
};

// --- Funktion, die sicherstellt, dass der Client initialisiert ist ---
// Gibt eine Promise zurück, die mit dem Client (echt oder Dummy) resolved.
export const ensureSupabaseClient = (): Promise<SupabaseClient> => {
  if (supabaseInstance) {
    // Wenn schon initialisiert (oder Dummy erstellt), sofort zurückgeben
    return Promise.resolve(supabaseInstance);
  }
  if (!initializationPromise) {
    // Wenn Initialisierung noch nicht gestartet wurde, starte sie
    initializationPromise = initializeSupabase();
  }
  // Gib die laufende oder abgeschlossene Initialisierungs-Promise zurück
  return initializationPromise;
};


// --- Funktion zum Neu-Initialisieren (z.B. nach Settings-Änderung) ---
export const refreshSupabaseCredentialsAndClient = async (): Promise<SupabaseClient> => {
  console.log("Erzwinge Neuladen von Supabase Credentials & Client...");
  // Setze Promise zurück, um Neuladen zu erzwingen
  initializationPromise = null;
  supabaseInstance = null; // Alte Instanz entfernen
  // Starte Initialisierung neu und gib das Ergebnis zurück
  return await ensureSupabaseClient();
};

// --- Veralteter direkter Export (vermeiden!) ---
// export const supabase = getSupabaseClient(); // Dies verursacht Race Condition!

// --- Verwendung in Komponenten: ---
// import { ensureSupabaseClient } from '../lib/supabase';
//
// const MyComponent = () => {
//   const [client, setClient] = useState<SupabaseClient | null>(null);
//   useEffect(() => {
//     ensureSupabaseClient().then(setClient);
//   }, []);
//
//   if (!client) return <Text>Loading Supabase...</Text>;
//
//   const fetchData = async () => {
//     const { data, error } = await client.from('...')...
//   }
// }
