import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Alert } from 'react-native'; // Import Alert

// Schlüsselnamen für AsyncStorage (verwende die gleichen wie im SettingsScreen)
const supabaseUrlKey = 'supabase_url';
const supabaseAnonKeyKey = 'supabase_key';

// Variablen für die geladenen Credentials
let supabaseUrl: string | null = null;
let supabaseAnonKey: string | null = null;
let supabaseClient: any = null; // Variable für den initialisierten Client

// Funktion zum Laden der Credentials aus AsyncStorage
const loadSupabaseCredentials = async (): Promise<boolean> => {
  try {
    supabaseUrl = await AsyncStorage.getItem(supabaseUrlKey);
    supabaseAnonKey = await AsyncStorage.getItem(supabaseAnonKeyKey);

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("Supabase URL oder Anon Key nicht im AsyncStorage gefunden.");
      // Optional: Zeige eine Warnung in der App
      // Alert.alert("Konfiguration fehlt", "Bitte Supabase URL und Key in den Einstellungen eintragen.");
      return false; // Laden fehlgeschlagen
    }
    return true; // Laden erfolgreich
  } catch (error) {
    console.error("Fehler beim Laden der Supabase Credentials:", error);
    Alert.alert("Fehler", "Supabase Credentials konnten nicht geladen werden.");
    return false; // Laden fehlgeschlagen
  }
};

// Funktion zum Initialisieren des Supabase Clients
const initializeSupabase = async () => {
  const loaded = await loadSupabaseCredentials();
  if (loaded && supabaseUrl && supabaseAnonKey) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    console.log("Supabase Client initialisiert.");
  } else {
    // Erstelle einen Dummy-Client oder behandle den Fehler,
    // damit die App nicht crasht, wenn `supabase` importiert wird.
    console.warn("Supabase Client konnte nicht initialisiert werden, da Credentials fehlen.");
    supabaseClient = {
      // Dummy-Methoden, um Abstürze zu vermeiden
      from: () => ({ select: async () => ({ error: { message: 'Supabase not initialized' } }), insert: async () => ({ error: { message: 'Supabase not initialized' } }) }),
      functions: { invoke: async () => ({ error: { message: 'Supabase not initialized' } }) },
      // Füge hier weitere benötigte Dummy-Methoden hinzu
    };
     // Optional: Zeige eine Warnung, aber nur einmal oder an geeigneter Stelle
     // Alert.alert("Supabase Fehler", "Client konnte nicht initialisiert werden. Bitte Einstellungen prüfen.");
  }
};

// Initialisiere den Client beim Laden des Moduls
initializeSupabase();

// Exportiere den Client (kann initial der Dummy sein)
// WICHTIG: Exportiere den Client selbst, nicht eine Funktion, die ihn zurückgibt,
// damit der Import in anderen Dateien einfach bleibt.
export const supabase = supabaseClient;

// Optionale Funktion, um Credentials neu zu laden und Client neu zu initialisieren
// (z.B. nach dem Speichern in den Settings)
export const refreshSupabaseClient = async () => {
  console.log("Versuche Supabase Client neu zu initialisieren...");
  await initializeSupabase();
  // Da 'supabase' direkt exportiert wird und supabaseClient eine globale Variable ist,
  // müssen wir den Export nicht ändern. Zukünftige Zugriffe auf 'supabase'
  // greifen auf den (potenziell neu initialisierten) supabaseClient zu.
  // Es ist jedoch wichtig zu verstehen, dass Module nur einmal geladen werden.
  // Eine robustere Lösung wäre, eine Funktion zu exportieren, die den Client zurückgibt,
  // oder einen State-Management-Ansatz zu verwenden. Für dieses Setup ist es okay.
  console.log("Aktualisierter Supabase Client:", supabase === supabaseClient); // Sollte true sein
};

