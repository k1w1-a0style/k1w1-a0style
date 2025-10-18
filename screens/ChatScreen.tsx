import React, { useState, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, TextInput, Text, ActivityIndicator,
  Alert, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import { ensureSupabaseClient, refreshSupabaseCredentialsAndClient } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SupabaseClient } from '@supabase/supabase-js';

interface ChatMessage {
  _id: string;
  text: string;
  createdAt: Date;
  user: {
    _id: number;
    name: string;
  };
}

const ChatScreen = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  const loadClient = useCallback(async () => {
    setError(null);
    try {
      const client = await ensureSupabaseClient();
      setSupabase(client);
      // @ts-ignore
      if (client && client.functions.invoke.toString().includes('DUMMY_CLIENT')) {
        setError("Supabase ist nicht konfiguriert. Bitte Keys in Settings prüfen.");
      } else {
        console.log("ChatScreen: Supabase Client ist bereit.");
      }
    } catch (e: any) {
      console.error("Fehler beim Holen des Supabase Clients:", e);
      setError("Supabase konnte nicht geladen werden.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      async function checkSupabase() { await loadClient(); }
      checkSupabase();
    }, [loadClient])
  );

  const handleSend = useCallback(async () => {
    const prompt = textInput.trim();
    if (!prompt || !supabase) return;
    setError(null);

    // @ts-ignore
    if (supabase.functions.invoke.toString().includes('DUMMY_CLIENT')) {
      Alert.alert('Fehler', 'Supabase nicht konfiguriert...'); return;
    }
    const groqApiKey = await AsyncStorage.getItem('groq_key');
    if (!groqApiKey) { Alert.alert('Key fehlt', 'Groq Key...'); return; }

    const userMessage: ChatMessage = { _id: Math.random().toString(36).substring(7), text: prompt, createdAt: new Date(), user: { _id: 1, name: 'User' } };
    setMessages((prev) => [userMessage, ...prev]);
    setTextInput('');
    setIsLoading(true);

    try {
      const anonKey = await AsyncStorage.getItem('supabase_key') || '';
      const { data, error: functionError } = await supabase.functions.invoke('k1w1-handler', {
        headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ prompt: prompt, apiKey: groqApiKey }),
      });
      if (functionError) throw functionError;

      const aiText = data?.data?.choices?.[0]?.message?.content;
      if (aiText) {
        const aiMessage: ChatMessage = { _id: Math.random().toString(36).substring(7), text: aiText.trim(), createdAt: new Date(), user: { _id: 2, name: 'AI' } };
        setMessages((prev) => [aiMessage, ...prev]);
      } else {
        setError('Keine gültige Antwort von AI erhalten.');
        console.warn('Unerwartete Antwort:', data);
      }
    } catch (e: any) {
      console.error('Fehler:', e);
      let detailMessage = e.message || 'Unbekannter Fehler';
      if (e.name === 'FunctionsHttpError' || (e instanceof Error && e.message.includes('non-2xx'))) {
        detailMessage = `Edge Function Fehler (Status: ${e.context?.status || '?'}). Grund: ${e.context?.details || e.message}`;
        console.error("EDGE FUNCTION FEHLER DETAILS:", JSON.stringify(e, null, 2));
        if (!detailMessage.includes('DUMMY_CLIENT')) {
          Alert.alert('Sende-Fehler', `${detailMessage}. Bitte Supabase Logs prüfen!`);
        }
      } else {
        Alert.alert('Sende-Fehler', `Nachricht nicht gesendet: ${detailMessage}`);
      }
      setError(detailMessage);
    } finally {
      setIsLoading(false);
    }
  }, [textInput, supabase]);

  const isSupabaseReady = supabase && !supabase.functions.invoke.toString().includes('DUMMY_CLIENT');

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingContainer}
        // === HÖHERER WERT FÜR ANDROID ===
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 130} // Erhöht auf 130 für Android
        // ================================
      >
        {!supabase ? (
          <ActivityIndicator style={styles.loadingIndicator} color={theme.palette.primary} size="large" />
        ) : !isSupabaseReady && error ? (
          <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{error}</Text></View>
        ) : null}

        {/* Container für die Liste */}
        <View style={styles.listContainer}>
          <FlatList
            data={messages}
            renderItem={({ item }) => (
              <View style={[styles.messageBubble, item.user._id === 1 ? styles.userMessage : styles.aiMessage]}>
                <Text style={item.user._id === 1 ? styles.userMessageText : styles.aiMessageText}> {item.text} </Text>
              </View>
            )}
            keyExtractor={(item) => item._id}
            inverted={true}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        </View>

        {/* Fehleranzeige für Sende-Fehler */}
        {isSupabaseReady && error && (
          <View style={styles.errorContainer}>
            <Text style={styles.error}>{error}</Text>
          </View>
        )}

        {/* Input Container */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={!supabase ? "Lade..." : (isSupabaseReady ? "Nachricht..." : "Supabase fehlt...")}
            placeholderTextColor={theme.palette.text.secondary}
            value={textInput}
            onChangeText={setTextInput}
            editable={!isLoading && isSupabaseReady}
            multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={isLoading || !isSupabaseReady}
            style={[styles.sendButton, (!isSupabaseReady || isLoading) && styles.sendButtonDisabled]}
          >
            {isLoading ? <ActivityIndicator size="small" color={theme.palette.background} /> : <Ionicons name="send" size={24} color={theme.palette.background} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  keyboardAvoidingContainer: { flex: 1 },
  listContainer: { flex: 1 },
  list: { paddingHorizontal: 10 },
  listContent: { paddingVertical: 10 },
  messageBubble: { borderRadius: 15, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8, maxWidth: '80%' },
  userMessage: { backgroundColor: theme.palette.primary, alignSelf: 'flex-end', borderBottomRightRadius: 0 },
  aiMessage: { backgroundColor: theme.palette.card, alignSelf: 'flex-start', borderBottomLeftRadius: 0 },
  userMessageText: { fontSize: 16, color: theme.palette.background },
  aiMessageText: { fontSize: 16, color: theme.palette.text.primary },
  inputContainer: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.palette.card, backgroundColor: theme.palette.background, alignItems: 'center' },
  input: { flex: 1, backgroundColor: theme.palette.input.background, borderRadius: 20, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 10 : 8, marginRight: 10, color: theme.palette.text.primary, fontSize: 16, maxHeight: 100 },
  sendButton: { backgroundColor: theme.palette.primary, borderRadius: 25, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginBottom: Platform.OS === 'ios' ? 0 : 0, paddingLeft: 3 },
  sendButtonDisabled: { backgroundColor: theme.palette.text.secondary },
  errorContainer: { paddingHorizontal: 10, paddingBottom: 5 },
  error: { color: 'red', textAlign: 'center'},
  errorBanner: { backgroundColor: 'darkred', paddingVertical: 10, paddingHorizontal: 15 },
  errorBannerText: { color: 'white', textAlign: 'center', fontWeight: 'bold' },
  loadingIndicator: { marginVertical: 30 },
});

export default ChatScreen;
