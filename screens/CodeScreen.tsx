import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../theme';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

const LAST_AI_RESPONSE_KEY = 'last_ai_response';

const CodeScreen = () => {
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Bleibt true bis zum ersten Laden

  // --- KORRIGIERTER useFocusEffect ---
  useFocusEffect(
    useCallback(() => {
      // Definiere die async Funktion *innerhalb* des Callbacks
      async function loadLastCode() {
        // Lade nur, wenn wir nicht schon laden (verhindert doppeltes Laden)
        // setIsLoading(true); // Nicht mehr hier, wird nur initial gesetzt
        console.log("CodeScreen: Fokus erhalten, lade Code...");
        try {
          const storedCode = await AsyncStorage.getItem(LAST_AI_RESPONSE_KEY);
          // Setze den State nur, wenn sich der Wert geändert hat
          // Dies verhindert unnötige Re-Renders, wenn der Tab oft gewechselt wird
          setLastCode(currentCode => {
              if (currentCode !== storedCode) {
                  console.log("CodeScreen: Neuer Code gefunden und gesetzt.");
                  return storedCode;
              }
              console.log("CodeScreen: Code ist aktuell.");
              return currentCode; // Behalte alten State bei
          });
        } catch (e) {
          console.error("CodeScreen: Fehler beim Laden:", e);
          setLastCode(null); // Setze bei Fehler zurück
          Alert.alert("Ladefehler", "Konnte den letzten Code nicht laden.");
        } finally {
           // Setze isLoading nur beim allerersten Laden auf false
           // Bei späteren Fokus-Wechseln soll kein Ladeindikator mehr kommen
           setIsLoading(state => state ? false : state); // Setze nur auf false, wenn es true war
        }
      }

      // Rufe die async Funktion auf
      loadLastCode();

      // Optional: Cleanup-Funktion (wird ausgeführt, wenn der Screen den Fokus verliert)
      return () => {
        // console.log("CodeScreen: Fokus verloren.");
      };
    }, []) // Leeres Abhängigkeitsarray, damit der Callback konstant bleibt
  );
  // --- ENDE KORREKTUR ---


  const copyToClipboard = async () => {
    if (lastCode) {
      await Clipboard.setStringAsync(lastCode);
      Alert.alert("Kopiert", "Code wurde in die Zwischenablage kopiert.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.header}>
          <Text style={styles.title}>Zuletzt generierter Code</Text>
          {/* Zeige Ladeindikator nur beim allerersten Laden */}
          {isLoading && <ActivityIndicator size="small" color={theme.palette.primary} style={{ marginRight: 10 }} />}
          {!isLoading && lastCode && (
              <TouchableOpacity onPress={copyToClipboard} style={styles.copyButton}>
                  <Ionicons name="copy-outline" size={24} color={theme.palette.primary} />
              </TouchableOpacity>
          )}
      </View>
      <ScrollView
         style={styles.container}
         contentContainerStyle={styles.scrollContent}
         removeClippedSubviews={true}
       >
        {/* Zeige Ladeindikator nur initial */}
        {isLoading && !lastCode ? (
          <ActivityIndicator size="large" color={theme.palette.primary} style={styles.loader} />
        ) : lastCode ? (
          <Text selectable style={styles.codeText}>{lastCode}</Text>
        ) : (
          <Text style={styles.placeholderText}>
            Hier wird der zuletzt von der KI generierte Code angezeigt.
            Generiere Code im Chat-Tab.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// Styles (unverändert)
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.palette.card, backgroundColor: theme.palette.card },
  title: { fontSize: 18, fontWeight: 'bold', color: theme.palette.text.primary },
  copyButton: { padding: 5 },
  container: { flex: 1 },
  scrollContent: { padding: 15 },
  loader: { marginTop: 50 },
  codeText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, color: theme.palette.text.primary, lineHeight: 18 },
  placeholderText: { fontSize: 16, color: theme.palette.text.secondary, textAlign: 'center', marginTop: 50, paddingHorizontal: 20 },
});

export default CodeScreen;

