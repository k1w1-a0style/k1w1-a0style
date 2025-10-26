import React, { useState, useCallback, useEffect, memo, useRef } from 'react';
import { View, StyleSheet, FlatList, TextInput, Text, ActivityIndicator, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ensureSupabaseClient } from '../lib/supabase';
import { theme, HEADER_HEIGHT } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SupabaseClient } from '@supabase/supabase-js';
import { useAI } from '../contexts/AIContext';
import { useTerminal } from '../contexts/TerminalContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useProject, ProjectFile, ChatMessage } from '../contexts/ProjectContext';
import * as Clipboard from 'expo-clipboard';
import { buildPrompt, ConversationHistory, PromptMessage } from '../lib/prompts'; // Nutzt das Gehirn

type DocumentResultAsset = NonNullable<DocumentPicker.DocumentPickerResult['assets']>[0];
type ChatScreenProps = { navigation: any; route: { params?: { debugCode?: string } }; };

// ✅ Robuster JSON Array Extraktor (bleibt gleich)
const extractJsonArray = (text: string): string | null => {
  const match = text.match(/```json\s*(\[[\s\S]*\])\s*```|(\[[\s\S]*\])/);
  if (!match) return null;
  const jsonString = match[1] || match[2];
  if (jsonString) {
    console.log(`🔍 JSON-Array gefunden (${jsonString.length} Zeichen)`);
    return jsonString;
  }
  return null;
};

// ✅ NEU: "Dirty" JSON Parser - Versucht Fehler zu beheben!
const dirtyJsonParse = (jsonString: string): ProjectFile[] | null => {
  try {
    // 1. Erster Versuch: Standard JSON.parse
    const standardParse = JSON.parse(jsonString);
    if (Array.isArray(standardParse) && standardParse[0]?.path) {
       // Konvertiere content sicher zu String
       return standardParse.map(file => ({
         ...file,
         content: typeof file.content === 'string' ? file.content : JSON.stringify(file.content ?? '', null, 2)
       }));
    }
  } catch (e) {
     console.warn(`DirtyParse: Standard parse failed - ${e.message}`);
  }

  try {
    // 2. Zweiter Versuch: Ersetze häufige Fehler und versuche es erneut
    let cleanedString = jsonString
      .replace(/\\'/g, "'") // Ersetze escaped single quotes
      .replace(/\\`/g, "`") // Ersetze escaped backticks
      .replace(/([,{]\s*)'/g, '$1"') // Single quotes für Keys -> Double quotes
      .replace(/'\s*:/g, '":')
      .replace(/:\s*'/g, ':"') // Single quotes für Values -> Double quotes
      .replace(/'\s*([,}])/g, '"$1')
      .replace(/,\s*([}\]])/g, '$1'); // Trailing commas

    // Entferne Kommentare (manche Modelle fügen sie hinzu)
    cleanedString = cleanedString.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

    const repairedParse = JSON.parse(cleanedString);
     if (Array.isArray(repairedParse) && repairedParse[0]?.path) {
        console.log("✅ DirtyParse: Reparatur erfolgreich!");
        return repairedParse.map(file => ({
          ...file,
          content: typeof file.content === 'string' ? file.content : JSON.stringify(file.content ?? '', null, 2)
       }));
     }
  } catch (e) {
    console.error(`❌ DirtyParse: Auch Reparatur fehlgeschlagen - ${e.message}`);
    console.error("Fehlerhafter String (Ausschnitt):", jsonString.substring(0, 500));
  }

  return null; // Konnte nicht geparst werden
};


const MessageItem = memo(({ item }: { item: ChatMessage }) => {
  const messageText = (item && typeof item.text === 'string') ? item.text.trim() : '';
  if (item && item.user && item.user._id === 1 && messageText.length === 0) {
    return null;
  }
  const handleLongPress = () => {
    if (messageText.length > 0) {
      Clipboard.setStringAsync(messageText);
      Alert.alert("Kopiert", "Nachricht in Zwischenablage kopiert.");
    }
  };
  return (
    <Pressable
      style={({ pressed }) => [
        styles.messageBubble,
        item.user._id === 1 ? styles.userMessage : styles.aiMessage,
        pressed && styles.messagePressed
      ]}
      onLongPress={handleLongPress}
    >
      <Text style={item.user._id === 1 ? styles.userMessageText : styles.aiMessageText}>
        {messageText.length > 0 ? messageText : '...'}
      </Text>
    </Pressable>
  );
});

const ChatScreen: React.FC<ChatScreenProps> = ({ navigation, route }) => {
  const { projectData, updateProjectFiles, messages, updateMessages, isLoading: isProjectLoading } = useProject();
  const [textInput, setTextInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const { config, getCurrentApiKey, rotateApiKey } = useAI();
  const { addLog } = useTerminal();
  const [selectedFileAsset, setSelectedFileAsset] = useState<DocumentResultAsset | null>(null);
  const rotationCountRef = useRef(0);
  const historyRef = useRef(new ConversationHistory()); // History Speicher

  // Lade Supabase Client
  const loadClient = useCallback(async () => { setError(null); try { const c = await ensureSupabaseClient(); setSupabase(c); console.log("CS: Supa OK"); } catch (e: any) { setError("Supa Load Fail"); } }, []);
  useFocusEffect(useCallback(() => { loadClient(); }, [loadClient]));

  // Lade History aus Context
  useEffect(() => {
    historyRef.current.loadFromMessages(messages);
  }, [messages]);

  // Datei-Picker
  const handlePickDocument = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!r.canceled && r.assets && r.assets.length > 0) {
        const a = r.assets[0];
        setSelectedFileAsset(a);
        Alert.alert('Datei ok', `${a.name} (${a.size ? (a.size / 1024).toFixed(2) + ' KB' : '?'}) wird gesendet.`);
      } else { setSelectedFileAsset(null); }
    } catch (e) { console.error('Pick Fail:', e); Alert.alert('Fehler', 'Datei Wahl fehlgeschlagen.'); setSelectedFileAsset(null); }
  };

  // Haupt-Sende-Logik
  const handleSend = useCallback(async (isRetry = false, customPrompt?: string, keyToUse?: string | null) => {
    let userPrompt = customPrompt ?? textInput.trim();
    const fileToSend = selectedFileAsset;
    const displayPrompt = textInput.trim() || (fileToSend ? `(Datei gesendet: ${fileToSend.name})` : (customPrompt ? `Debug Anfrage` : ''));
    if (!userPrompt && !fileToSend && !customPrompt) return;
    if (!supabase) { Alert.alert("Fehler", "Supabase ist nicht verbunden."); return; }
    if (isProjectLoading || !projectData) { Alert.alert("Fehler", "Projekt lädt noch."); return; }
    if (!isRetry) setError(null);

    const currentProvider = config.selectedProvider;
    const apiKey = keyToUse ?? getCurrentApiKey(currentProvider);
    if (!apiKey) { Alert.alert('Key fehlt', `Kein API Key für ${currentProvider.toUpperCase()} gefunden.`); return; }

    if (!isRetry) rotationCountRef.current = 0;

    // Datei-Inhalt lesen
    let fileContent = '';
    let messageForHistory = userPrompt; // Das, was in die History kommt
    if (fileToSend && !customPrompt && !isRetry) {
      setIsAiLoading(true);
      console.log(`Lese: ${fileToSend.uri}`);
      try {
        fileContent = await FileSystem.readAsStringAsync(fileToSend.uri, { encoding: 'utf8' });
        console.log(`Gelesen: ${fileContent.length} chars`);
        // Die Nachricht für die KI UND die History enthält den Datei-Kontext
        messageForHistory = `--- Datei: ${fileToSend.name} ---\n${fileContent}\n--- Ende ---\n\n${userPrompt || '(Siehe Datei)'}`;
      } catch (readError: any) {
        console.error("Read Fail:", readError); Alert.alert("Lese-Fehler", `Datei "${fileToSend.name}" Error.`); setIsAiLoading(false); setSelectedFileAsset(null); return;
      }
    } else if (fileToSend && !customPrompt && isRetry) {
       messageForHistory = userPrompt; // Beim Retry haben wir den kombinierten Prompt schon
       if (displayPrompt === `(Datei gesendet: ${fileToSend.name})`) { userPrompt = displayPrompt; } // Korrektur für Anzeige
    }

    // UI-Nachricht erstellen & History aktualisieren (nur beim ersten Senden)
    let userMessage: ChatMessage | null = null;
    let originalMessages = messages;
    if (!isRetry) {
      userMessage = { _id: Math.random().toString(36).substring(7), text: displayPrompt || '...', createdAt: new Date(), user: { _id: 1, name: 'User' } };
      setTextInput('');
      if (fileToSend && !customPrompt) setSelectedFileAsset(null);
      historyRef.current.addUser(messageForHistory); // Wichtig: messageForHistory verwenden!
    }

    // Prompt mit History und Kontext bauen
    const promptMessages = buildPrompt(
      currentProvider,
      messageForHistory, // Wichtig: Immer die volle Info (ggf. mit Datei) an buildPrompt geben
      projectData.files,
      historyRef.current.getHistory()
    );

    setIsAiLoading(true);
    let effectiveModel = config.selectedMode;
    if (currentProvider === 'groq' && effectiveModel === 'auto-groq') { effectiveModel = 'llama-3.1-8b-instant'; } // Oder ein anderes Standardmodell
    const currentKeyIndex = config.keys[currentProvider]?.indexOf(apiKey) ?? -1;
    console.log(`Sende an ${currentProvider} (${effectiveModel}), KeyIdx: ${currentKeyIndex !== -1 ? currentKeyIndex : '?'}`);

    try {
      // API-Call an Supabase Function
      const { data, error: funcErr } = await supabase.functions.invoke('k1w1-handler', {
        body: { messages: promptMessages, apiKey: apiKey, provider: currentProvider, model: effectiveModel }
      });
      if (funcErr) {
        console.error('Supabase Function Error:', funcErr);
        const s = funcErr.context?.status || 500;
        const d = funcErr.context?.details || funcErr.message;
        throw { name: 'FunctionsHttpError', status: s, message: d };
      }

      let aiText = data?.response?.trim() || "";

      if (aiText.length > 0) {
        // KI-Antwort zur History hinzufügen (macht History-Manager intelligent)
        historyRef.current.addAssistant(aiText);

        // KI-Antwort im UI anzeigen
        const aiMsg: ChatMessage = { _id: Math.random().toString(36).substring(7), text: aiText, createdAt: new Date(), user: { _id: 2, name: 'AI' } };
        const newMessages = [aiMsg, ...(userMessage ? [userMessage] : []), ...originalMessages];
        await updateMessages(newMessages);

        // JSON-Verarbeitung mit robustem Parser
        const potentialJsonString = extractJsonArray(aiText);
        if (potentialJsonString) {
            const parsedProject = dirtyJsonParse(potentialJsonString); // ✅ NEU: Nutze dirty parser

            if (parsedProject) { // ✅ Prüfe ob Parsing erfolgreich war
                 // Validierung (bleibt einfach, da dirtyParse schon auf path prüft)
                if (parsedProject.length > 0) {
                    await updateProjectFiles(parsedProject);
                    console.log(`✅ Projekt mit ${parsedProject.length} Dateien via DirtyParse gespeichert.`);

                    // Chat-Nachricht aktualisieren
                    const confirmationText = `[Projekt mit ${parsedProject.length} Dateien aktualisiert. Siehe Code-Tab.]`;
                    const finalMessages = messages.map(m => m._id === aiMsg._id ? { ...m, text: confirmationText } : m);
                    // Füge die neue User-Nachricht hinzu, falls noch nicht geschehen
                    if (userMessage && !finalMessages.some(m => m._id === userMessage._id)) {
                         finalMessages.unshift(userMessage);
                    }
                    await updateMessages(finalMessages);

                    // Auch History korrigieren
                    const currentHist = historyRef.current.getHistory();
                    if(currentHist.length > 0 && currentHist[currentHist.length-1].role === 'assistant') {
                         currentHist[currentHist.length-1].content = confirmationText;
                    }

                } else {
                    console.warn("⚠️ DirtyParse lieferte leeres Array.");
                }
            } else {
                // Parsing fehlgeschlagen, wird als normaler Text behandelt
                console.warn("⚠️ JSON-Array extrahiert, aber Parsing fehlgeschlagen (auch mit DirtyParse). Behandle als Text.");
            }
        } else {
          console.log("💬 Normale Chat-Antwort (kein JSON-Array gefunden).");
        }
      } else {
        setError('Leere Antwort von KI.');
        console.warn('Leere Antwort erhalten.');
        // Füge leere Antwort zur History hinzu, damit der Turn nicht fehlt
        historyRef.current.addAssistant("");
      }
    } catch (e: any) {
      console.error('Send Fail:', e);
      let detailMsg = e.message || '?';
      let status = e.status || 500;

       // Füge Fehler zur History hinzu? Optional.
       // historyRef.current.addAssistant(`Fehler: ${detailMsg}`);

      // Key Rotation (bleibt gleich)
      if (status === 401 || status === 429) {
        const keyListLength = config.keys[currentProvider]?.length || 0;
        if (rotationCountRef.current >= keyListLength) {
          detailMsg = `Alle ${currentProvider.toUpperCase()} Keys verbraucht/ungültig.`;
          Alert.alert("Keys leer", detailMsg); addLog(`Alle ${currentProvider} Keys leer.`); setError(detailMsg);
          if (fileToSend && !customPrompt) setSelectedFileAsset(null);
          if (userMessage) await updateMessages([userMessage, ...originalMessages]); // User-Nachricht anzeigen
        } else {
          console.log(`Key Problem (${status}), rotiere...`); addLog(`Key ${currentProvider} (${status}). Rotiere...`);
          rotationCountRef.current++;
          const nextKey = await rotateApiKey(currentProvider);
          if (nextKey && nextKey !== apiKey) {
            console.log("Retry new Key...");
            if (fileToSend && !selectedFileAsset && !customPrompt) {
               console.log("Stelle Datei für Retry wieder her.");
               setSelectedFileAsset(fileToSend); // Stelle Asset wieder her
            }
             // Sende die *ursprüngliche* User-Nachricht für den Retry
            handleSend(true, userPrompt, nextKey);
            return; // Wichtig: Beende die aktuelle fehlerhafte Ausführung
          } else {
             // Rotation fehlgeschlagen oder kein anderer Key da
             detailMsg = `Key-Rotation fehlgeschlagen (${status}).`;
             Alert.alert('Sende-Fehler', `${currentProvider.toUpperCase()} (${status}): ${detailMsg}`); setError(detailMsg);
             if (fileToSend && !customPrompt) setSelectedFileAsset(null);
             if (userMessage) await updateMessages([userMessage, ...originalMessages]);
          }
        }
      } else {
        Alert.alert('Sende-Fehler', `${currentProvider.toUpperCase()} (${status}): ${detailMsg}`); setError(detailMsg);
        if (fileToSend && !customPrompt) setSelectedFileAsset(null);
        if (userMessage) await updateMessages([userMessage, ...originalMessages]);
      }
    } finally {
      setIsAiLoading(false);
    }
  }, [textInput, supabase, getCurrentApiKey, rotateApiKey, addLog, config, selectedFileAsset, messages, projectData, updateProjectFiles, updateMessages, isProjectLoading]);

  // Debug-Anfragen vom CodeScreen (bleibt gleich)
  useEffect(() => {
    if (route.params?.debugCode) {
      const codeToDebug = route.params.debugCode;
      console.log("ChatScreen: Debug-Anfrage vom CodeScreen empfangen.");
      const debugPrompt = `Analysiere den folgenden Code auf Fehler, schlage Verbesserungen vor und erkläre deine Analyse:\n\n\`\`\`\n${codeToDebug}\n\`\`\``;
      setTextInput(`Debug Anfrage...`);
      handleSend(false, debugPrompt);
      navigation.setParams({ debugCode: undefined });
    }
  }, [route.params?.debugCode, navigation, handleSend]);

  // Debug-Button für letzte KI-Antwort (bleibt gleich)
  const handleDebugLastResponse = () => {
    const lastAiMsg = messages.find(m => m.user._id === 2);
    if (!lastAiMsg || !lastAiMsg.text) { Alert.alert("Nix da", "Keine KI Antwort zum Debuggen."); return; }
    const code = lastAiMsg.text;
    const prompt = `Analysiere den folgenden Code (oder Text) auf Fehler, schlage Verbesserungen vor:\n\n\`\`\`\n${code}\n\`\`\``;
    setTextInput(`Debug Anfrage...`);
    handleSend(false, prompt);
  };

  const isSupabaseReady = supabase && !supabase.functions.invoke.toString().includes('DUMMY_CLIENT');
  const combinedIsLoading = isAiLoading || isProjectLoading;

  // JSX (bleibt unverändert)
  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        style={styles.keyboardAvoidingContainer}
        keyboardVerticalOffset={Platform.OS === "ios" ? HEADER_HEIGHT + 20 : HEADER_HEIGHT + 40}
      >
        {(!supabase || (isProjectLoading && messages.length === 0)) && (
          <ActivityIndicator style={styles.loadingIndicator} color={theme.palette.primary} size="large" />
        )}
        <FlatList
          data={messages}
          renderItem={({ item }) => <MessageItem item={item} />}
          keyExtractor={(item) => item._id}
          inverted={true}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={10}
        />
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.error}>{String(error)}</Text>
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
            <TouchableOpacity onPress={handlePickDocument} style={styles.attachButton} disabled={combinedIsLoading}>
              <Ionicons name="add-circle-outline" size={28} color={combinedIsLoading ? theme.palette.text.disabled : theme.palette.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDebugLastResponse} style={styles.debugButton} disabled={combinedIsLoading || messages.filter(m => m.user._id === 2).length === 0}>
              <Ionicons name="bug-outline" size={24} color={combinedIsLoading || messages.filter(m => m.user._id === 2).length === 0 ? theme.palette.text.disabled : theme.palette.primary} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder={!isSupabaseReady ? "Lade..." : (selectedFileAsset ? "Zusätzl..." : "Nachricht...")}
              placeholderTextColor={theme.palette.text.secondary}
              value={textInput}
              onChangeText={setTextInput}
              editable={!combinedIsLoading && isSupabaseReady}
              multiline
            />
            <TouchableOpacity
              onPress={() => handleSend(false)}
              disabled={combinedIsLoading || !isSupabaseReady || (!textInput.trim() && !selectedFileAsset)}
              style={[styles.sendButton, (!isSupabaseReady || combinedIsLoading || (!textInput.trim() && !selectedFileAsset)) && styles.sendButtonDisabled]}
            >
              {isAiLoading ? <ActivityIndicator size="small" color={theme.palette.background} /> : <Ionicons name="send" size={24} color={theme.palette.background} />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Styles (bleiben unverändert)
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  keyboardAvoidingContainer: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingVertical: 10, paddingHorizontal: 10 },
  messageBubble: { borderRadius: 15, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8, maxWidth: '80%', borderWidth: 2, },
  userMessage: { backgroundColor: 'transparent', borderColor: theme.palette.primary, alignSelf: 'flex-end', borderBottomRightRadius: 0 },
  aiMessage: { backgroundColor: 'transparent', borderColor: theme.palette.card, alignSelf: 'flex-start', borderBottomLeftRadius: 0 },
  messagePressed: { opacity: 0.7 },
  userMessageText: { fontSize: 16, color: theme.palette.primary },
  aiMessageText: { fontSize: 16, color: theme.palette.text.primary },
  inputContainerOuter: { borderTopWidth: 1, borderTopColor: theme.palette.card, backgroundColor: theme.palette.background },
  attachedFileContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.palette.input.background, paddingVertical: 6, paddingHorizontal: 12, marginHorizontal: 10, marginTop: 8, borderRadius: 15, borderWidth: 1, borderColor: theme.palette.card },
  attachedFileText: { flex: 1, marginLeft: 8, marginRight: 8, fontSize: 13, color: theme.palette.text.secondary },
  removeFileButton: { padding: 2 },
  inputContainerInner: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  attachButton: { paddingRight: 5, justifyContent: 'center', alignItems: 'center', height: 44 },
  debugButton: { paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center', height: 44 },
  input: { flex: 1, backgroundColor: theme.palette.input.background, borderRadius: 20, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 10 : 8, color: theme.palette.text.primary, fontSize: 16, maxHeight: 100 },
  sendButton: { backgroundColor: theme.palette.primary, borderRadius: 25, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', paddingLeft: 3, marginLeft: 5 },
  sendButtonDisabled: { backgroundColor: theme.palette.text.secondary },
  errorContainer: { paddingHorizontal: 10, paddingBottom: 5 },
  error: { color: theme.palette.error, textAlign: 'center' },
  loadingIndicator: { marginVertical: 30 },
});

export default ChatScreen;
