import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

const LAST_AI_RESPONSE_KEY = 'last_ai_response';

const CodeScreen = () => {
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      async function loadLastCode() {
        console.log("CodeScreen: Fokus erhalten, lade Code...");
        try {
          const storedCode = await AsyncStorage.getItem(LAST_AI_RESPONSE_KEY);
          setLastCode(currentCode => (currentCode !== storedCode ? storedCode : currentCode));
        } catch (e) {
          console.error("CodeScreen: Fehler beim Laden:", e);
          setLastCode(null);
        } finally {
           setIsLoading(state => state ? false : state);
        }
      }
      loadLastCode();
      return () => {};
    }, [])
  );

  const copyToClipboard = async () => { /* ... */ if (lastCode) { await Clipboard.setStringAsync(lastCode); Alert.alert("Kopiert", "Code in Zwischenablage kopiert."); } };

  const handleDebugCode = () => {
    if (!lastCode) { Alert.alert("Fehler", "Kein Code zum Debuggen vorhanden."); return; }
    console.log("CodeScreen: Sende Code an Chat-Tab zum Debuggen...");
    // @ts-ignore
    navigation.navigate('Chat', { debugCode: lastCode });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.header}>
          <Text style={styles.title}>Zuletzt generierter Code</Text>
          <View style={styles.buttonContainer}>
            {isLoading && <ActivityIndicator size="small" color={theme.palette.text.secondary} style={{ marginRight: 15 }} />}
            {!isLoading && lastCode && (
                <TouchableOpacity onPress={handleDebugCode} style={styles.copyButton}>
                    {/* === FARBKORREKTUR HIER === */}
                    <Ionicons name="bug-outline" size={24} color={theme.palette.primary} />
                </TouchableOpacity>
            )}
            {!isLoading && lastCode && (
                <TouchableOpacity onPress={copyToClipboard} style={styles.copyButton}>
                    <Ionicons name="copy-outline" size={24} color={theme.palette.primary} />
                </TouchableOpacity>
            )}
          </View>
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} removeClippedSubviews={true}>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.palette.card, backgroundColor: theme.palette.card },
  title: { fontSize: 18, fontWeight: 'bold', color: theme.palette.text.primary },
  buttonContainer: { flexDirection: 'row', alignItems: 'center', },
  copyButton: { padding: 5, marginLeft: 15, },
  container: { flex: 1 },
  scrollContent: { padding: 15 },
  loader: { marginTop: 50 },
  codeText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, color: theme.palette.text.primary, lineHeight: 18 },
  placeholderText: { fontSize: 16, color: theme.palette.text.secondary, textAlign: 'center', marginTop: 50, paddingHorizontal: 20 },
});

export default CodeScreen;

