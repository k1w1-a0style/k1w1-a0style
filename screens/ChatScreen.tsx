import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, StyleSheet, FlatList, TextInput, Text, ActivityIndicator,
  Alert, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import { ensureSupabaseClient } from '../lib/supabase';
import { theme, HEADER_HEIGHT } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SupabaseClient } from '@supabase/supabase-js';
import { useAI } from '../contexts/AIContext';
import { useTerminal } from '../contexts/TerminalContext';
import * as DocumentPicker from 'expo-document-picker';
// === KORRIGIERTER IMPORT ===
import * as FileSystem from 'expo-file-system/legacy'; // Nutze die Legacy-API
// === ENDE KORREKTUR ===


// Interface/Typ Definitionen
interface ChatMessage { _id: string; text: string; createdAt: Date; user: { _id: number; name: string; }; isStreaming?: boolean; }
type DocumentResultAsset = NonNullable<DocumentPicker.DocumentPickerResult['assets']>[0];

const ChatScreen = () => {
  // ... (Rest des Codes bleibt EXAKT GLEICH wie in der letzten funktionierenden Version) ...
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const { config, getCurrentApiKey, rotateApiKey } = useAI();
  const { selectedProvider, selectedMode } = config;
  const { addLog } = useTerminal();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [selectedFileAsset, setSelectedFileAsset] = useState<DocumentResultAsset | null>(null);

  const loadClient = useCallback(async () => {
     setError(null); try { const client = await ensureSupabaseClient(); setSupabase(client); console.log("ChatScreen: Supabase Client ist bereit."); } catch (e: any) { setError("Supabase konnte nicht geladen werden."); }
  }, []);

  useFocusEffect(useCallback(() => { loadClient(); }, [loadClient]));

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFileAsset(asset);
        Alert.alert('Datei angehängt', `${asset.name} (${asset.size ? (asset.size / 1024).toFixed(2) + ' KB' : 'Unbekannt'}) wird mit der nächsten Nachricht gesendet.`);
      } else { setSelectedFileAsset(null); }
    } catch (err) { console.error('Fehler beim Auswählen der Datei:', err); Alert.alert('Fehler', 'Datei konnte nicht ausgewählt werden.'); setSelectedFileAsset(null); }
  };

  const handleSend = useCallback(async (isRetry = false) => {
    let userPrompt = textInput.trim();
    const fileToSend = selectedFileAsset;
    if (!userPrompt && !fileToSend) return;
    if (!supabase) return;
    if (!isRetry) setError(null);

    const apiKey = getCurrentApiKey(selectedProvider);
    if (!apiKey) { Alert.alert('API Key fehlt', `${selectedProvider.toUpperCase()} Key in Settings setzen.`); return; }

    let fileContent = '';
    let combinedPrompt = userPrompt;

    if (fileToSend) {
      setIsLoading(true);
      console.log(`Lese Datei: ${fileToSend.uri}`);
      try {
        // Verwende den korrekten Encoding String
        fileContent = await FileSystem.readAsStringAsync(fileToSend.uri, {
          encoding: 'utf8', // Direkt als String
        });
        console.log(`Datei gelesen: ${fileContent.length} Zeichen`);
        combinedPrompt = `--- Datei: ${fileToSend.name} ---\n${fileContent}\n--- Ende Datei ---\n\n${userPrompt || '(Siehe angehängte Datei)'}`;
        if (!userPrompt) { userPrompt = `(Datei gesendet: ${fileToSend.name})`; }
      } catch (readError: any) {
        // Die Fehlermeldung kommt jetzt von hier, wenn das Lesen fehlschlägt
        console.error("Fehler beim Lesen der Datei:", readError);
        console.log("Details des Lesefehlers:", JSON.stringify(readError));
        // Zeige den Fehler dem Benutzer an
        Alert.alert("Fehler beim Lesen", `Konnte Datei "${fileToSend.name}" nicht lesen. Grund: ${readError.message || 'Unbekannt'}`);
        setIsLoading(false);
        setSelectedFileAsset(null); // Datei entfernen bei Lesefehler
        return; // Breche den Sendevorgang ab
      }
    }

    if (!isRetry) {
      const userMessage: ChatMessage = { _id: Math.random().toString(36).substring(7), text: userPrompt, createdAt: new Date(), user: { _id: 1, name: 'User' } };
      setMessages((prev) => [userMessage, ...prev]);
      setTextInput('');
      if(fileToSend) setSelectedFileAsset(null);
    }

    setIsLoading(true);

    let effectiveModel = selectedMode;
    if (selectedProvider === 'groq' && selectedMode === 'auto-groq') {
      effectiveModel = 'llama-3.1-8b-instant';
      console.log(`'auto-groq' erkannt. Sende stattdessen: ${effectiveModel}`);
    }

    try {
      console.log(`Sende an 'k1w1-handler': Provider=${selectedProvider}, Model=${effectiveModel}, Key-Index=${config.keyIndexes[selectedProvider]}`);
      const { data, error: functionError } = await supabase.functions.invoke('k1w1-handler', {
        body: { message: combinedPrompt, apiKey: apiKey, provider: selectedProvider, model: effectiveModel },
      });

      if (functionError) {
          const status = functionError.context?.status || 500;
          const detail = functionError.context?.details || functionError.message;
          throw { name: 'FunctionsHttpError', status: status, message: detail };
      }

      const aiText = data?.response;
      if (aiText) {
        const aiMessage: ChatMessage = { _id: Math.random().toString(36).substring(7), text: aiText.trim(), createdAt: new Date(), user: { _id: 2, name: 'AI' } };
        setMessages((prev) => [aiMessage, ...prev]);
      } else { setError('Keine gültige Antwort von AI erhalten.'); console.warn('Unerwartete Antwort:', data); }

    } catch (e: any) {
        console.error('Fehler:', e); let detailMessage = e.message || 'Unbekannter Fehler'; let status = e.status || 500;
        if (status === 400 || status === 401 || status === 404 || status === 429) {
            console.log(`Key-Problem erkannt (Status ${status}), versuche Rotation...`);
            addLog(`Key-Problem (Status ${status}) bei ${selectedProvider}. Wechsle Key...`);
            const nextKey = await rotateApiKey(selectedProvider);
            if (nextKey && nextKey !== apiKey) {
                console.log("Versuche es erneut mit neuem Key...");
                 if (fileToSend && !selectedFileAsset) { setSelectedFileAsset(fileToSend); }
                handleSend(true);
                return;
             } else {
                 detailMessage = `Alle Keys für ${selectedProvider} sind verbraucht oder ungültig.`;
                 Alert.alert("Alle Keys verbraucht", detailMessage);
                 addLog(`Alle Keys für ${selectedProvider} durchrotiert und fehlgeschlagen.`);
                 if (fileToSend) setSelectedFileAsset(null);
             }
        } else {
             Alert.alert('Sende-Fehler', `Nachricht nicht gesendet: ${detailMessage}`);
             if (fileToSend) setSelectedFileAsset(null);
        }
        setError(detailMessage);
        if (!isRetry) {
             if (!fileToSend || (fileToSend && detailMessage.includes("Alle Keys"))) { setMessages(prev => prev.slice(1)); }
        }
    } finally {
      setIsLoading(false);
    }
  }, [textInput, supabase, selectedProvider, selectedMode, getCurrentApiKey, rotateApiKey, addLog, config, selectedFileAsset]);


  const isSupabaseReady = supabase && !supabase.functions.invoke.toString().includes('DUMMY_CLIENT');

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "padding"} style={styles.keyboardAvoidingContainer} keyboardVerticalOffset={Platform.OS === "ios" ? HEADER_HEIGHT + 20 : HEADER_HEIGHT + 40}>
        {!supabase && <ActivityIndicator style={styles.loadingIndicator} color={theme.palette.primary} size="large" />}
        <FlatList data={messages} renderItem={({ item }) => (
            <View style={[ styles.messageBubble, item.user._id === 1 ? styles.userMessage : styles.aiMessage ]}>
                <Text style={item.user._id === 1 ? styles.userMessageText : styles.aiMessageText}>
                    {item.text ? ` ${item.text} ` : ''}
                </Text>
            </View>
         )} keyExtractor={(item) => item._id} inverted={true} style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled" />
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.error}>{error}</Text>
          </View>
        )}
        <View style={styles.inputContainerOuter}>
            {selectedFileAsset && (
              <View style={styles.attachedFileContainer}>
                <Ionicons name="document-attach-outline" size={16} color={theme.palette.text.secondary} />
                <Text style={styles.attachedFileText} numberOfLines={1}>{selectedFileAsset.name}</Text>
                <TouchableOpacity onPress={() => setSelectedFileAsset(null)} style={styles.removeFileButton}>
                  <Ionicons name="close-circle" size={18} color={theme.palette.text.secondary} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.inputContainerInner}>
                <TouchableOpacity onPress={handlePickDocument} style={styles.attachButton} disabled={isLoading}>
                    <Ionicons name="add-circle-outline" size={28} color={isLoading ? theme.palette.text.disabled : theme.palette.primary} />
                </TouchableOpacity>
                <TextInput style={styles.input} placeholder={!supabase ? "Lade..." : (selectedFileAsset ? "Zusätzliche Nachricht..." : "Nachricht...")} placeholderTextColor={theme.palette.text.secondary} value={textInput} onChangeText={setTextInput} editable={!isLoading && isSupabaseReady} multiline />
                <TouchableOpacity onPress={() => handleSend(false)} disabled={isLoading || !isSupabaseReady || (!textInput.trim() && !selectedFileAsset)} style={[styles.sendButton, (!isSupabaseReady || isLoading || (!textInput.trim() && !selectedFileAsset)) && styles.sendButtonDisabled]}>
                    {isLoading ? <ActivityIndicator size="small" color={theme.palette.background} /> : <Ionicons name="send" size={24} color={theme.palette.background} />}
                </TouchableOpacity>
            </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Styles
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  keyboardAvoidingContainer: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingVertical: 10, paddingHorizontal: 10 },
  messageBubble: { borderRadius: 15, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8, maxWidth: '80%' },
  userMessage: { backgroundColor: theme.palette.primary, alignSelf: 'flex-end', borderBottomRightRadius: 0 },
  aiMessage: { backgroundColor: theme.palette.card, alignSelf: 'flex-start', borderBottomLeftRadius: 0 },
  userMessageText: { fontSize: 16, color: theme.palette.background },
  aiMessageText: { fontSize: 16, color: theme.palette.text.primary },
  inputContainerOuter: { borderTopWidth: 1, borderTopColor: theme.palette.card, backgroundColor: theme.palette.background },
  attachedFileContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.palette.input.background, paddingVertical: 6, paddingHorizontal: 12, marginHorizontal: 10, marginTop: 8, borderRadius: 15, borderWidth: 1, borderColor: theme.palette.card },
  attachedFileText: { flex: 1, marginLeft: 8, marginRight: 8, fontSize: 13, color: theme.palette.text.secondary },
  removeFileButton: { padding: 2 },
  inputContainerInner: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  attachButton: { paddingRight: 10, justifyContent: 'center', alignItems: 'center', height: 44 },
  input: { flex: 1, backgroundColor: theme.palette.input.background, borderRadius: 20, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 10 : 8, color: theme.palette.text.primary, fontSize: 16, maxHeight: 100 },
  sendButton: { backgroundColor: theme.palette.primary, borderRadius: 25, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', paddingLeft: 3, marginLeft: 10 },
  sendButtonDisabled: { backgroundColor: theme.palette.text.secondary },
  errorContainer: { paddingHorizontal: 10, paddingBottom: 5 },
  error: { color: theme.palette.error, textAlign: 'center'},
  errorBanner: { backgroundColor: theme.palette.error, paddingVertical: 10, paddingHorizontal: 15 },
  errorBannerText: { color: 'white', textAlign: 'center', fontWeight: 'bold' },
  loadingIndicator: { marginVertical: 30 },
});

export default ChatScreen;

