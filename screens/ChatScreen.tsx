import React, { useState, useCallback, useEffect, memo, useRef } from 'react';
import { View, StyleSheet, FlatList, TextInput, Text, ActivityIndicator, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ensureSupabaseClient } from '../lib/supabase';
import { theme, HEADER_HEIGHT } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SupabaseClient } from '@supabase/supabase-js';
import { useAI } from '../contexts/AIContext';
import { useTerminal } from '../contexts/TerminalContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useProject, ProjectFile, ChatMessage } from '../contexts/ProjectContext';
import * as Clipboard from 'expo-clipboard';

type DocumentResultAsset = NonNullable<DocumentPicker.DocumentPickerResult['assets']>[0];
type ChatScreenProps = { navigation: any; route: { params?: { debugCode?: string } }; };

// ✅ ORIGINAL Sanitize (NICHT aggressiv!)
const sanitizeJsonString = (str: string): string => {
  let clean = str;
  
  // 1. Control Characters entfernen
  clean = clean.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  // 2. Backticks → Double Quotes (Groq nutzt Template Strings)
  clean = clean.replace(/`/g, '"');

  // 3. Trailing Commas entfernen
  clean = clean.replace(/,(\s*[}\]])/g, '$1');

  // 4. Unquoted Keys fixen
  clean = clean.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*):/g, '$1"$2"$3:');

  return clean;
};

// ✅ ORIGINAL JSON Extraktion
const extractJSON = (text: string): string | null => {
  let cleaned = text
    .replace(/```[jJ][sS][oO][nN]?\s*/g, '')
    .replace(/```[a-zA-Z]*\s*/g, '')
    .replace(/```/g, '')
    .trim();

  const arrayStart = cleaned.indexOf('[');
  if (arrayStart === -1) return null;

  let depth = 0;
  let arrayEnd = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = arrayStart; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (char === '"' && !escapeNext) {
      inString = !inString;
    }

    if (char === '\\') {
      escapeNext = !escapeNext;
    } else {
      escapeNext = false;
    }

    if (inString) continue;

    if (char === '[' || char === '{') depth++;
    if (char === ']' || char === '}') depth--;

    if (depth === 0 && i > arrayStart) {
      arrayEnd = i;
      break;
    }
  }

  if (arrayEnd === -1) {
    console.warn('⚠️ Kein schließendes ] gefunden!');
    return null;
  }

  const extracted = cleaned.substring(arrayStart, arrayEnd + 1);
  console.log(`🔍 Extrahiert ${extracted.length} Zeichen (Depth-Check OK)`);

  return extracted;
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

  const loadClient = useCallback(async () => { setError(null); try { const c = await ensureSupabaseClient(); setSupabase(c); console.log("CS: Supa OK"); } catch (e: any) { setError("Supa Load Fail"); } }, []);
  useFocusEffect(useCallback(() => { loadClient(); }, [loadClient]));

  const handlePickDocument = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!r.canceled && r.assets && r.assets.length > 0) {
        const a = r.assets[0];
        setSelectedFileAsset(a);
        Alert.alert('Datei ok', `${a.name} (${a.size ? (a.size / 1024).toFixed(2) + ' KB' : '?'}) wird gesendet.`);
      } else {
        setSelectedFileAsset(null);
      }
    } catch (e) {
      console.error('Pick Fail:', e);
      Alert.alert('Fehler', 'Datei Wahl fehlgeschlagen.');
      setSelectedFileAsset(null);
    }
  };

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

    if (!isRetry) {
      rotationCountRef.current = 0;
    }

    let fileContent = '';
    let combinedPrompt = userPrompt;
    if (fileToSend && !customPrompt && !isRetry) {
      setIsAiLoading(true);
      console.log(`Lese: ${fileToSend.uri}`);
      try {
        fileContent = await FileSystem.readAsStringAsync(fileToSend.uri, { encoding: 'utf8' });
        console.log(`Gelesen: ${fileContent.length} chars`);
        combinedPrompt = `--- Datei: ${fileToSend.name} ---\n${fileContent}\n--- Ende ---\n\n${userPrompt || '(Siehe Datei)'}`;
      } catch (readError: any) {
        console.error("Read Fail:", readError);
        Alert.alert("Lese-Fehler", `Datei "${fileToSend.name}" Error.`);
        setIsAiLoading(false);
        setSelectedFileAsset(null);
        return;
      }
    } else if (fileToSend && !customPrompt && isRetry) {
      combinedPrompt = userPrompt;
      if (displayPrompt === `(Datei gesendet: ${fileToSend.name})`) { userPrompt = displayPrompt; }
    }

    let userMessage: ChatMessage | null = null;
    let originalMessages = messages;

    if (!isRetry) {
      userMessage = { _id: Math.random().toString(36).substring(7), text: displayPrompt || '...', createdAt: new Date(), user: { _id: 1, name: 'User' } };
      setTextInput('');
      if (fileToSend && !customPrompt) setSelectedFileAsset(null);
    }

    // ✅ NUR MINIMALER FIX: Zeige Template NUR bei Änderungen
    if (!isRetry && !customPrompt) {
      const currentProjectState = JSON.stringify(projectData?.files || [], null, 2);
      const hasNonTemplateFiles = projectData?.files && projectData.files.length > 0 && 
        projectData.files.some(f => !['package.json', 'app.config.js', 'App.tsx', 'theme.ts', 'README.md'].includes(f.path));

      const AGENT_SYSTEM_PROMPT = `Du bist "k1w1-a0style", ein Experte für **React Native mit Expo SDK 54**.

**WICHTIGE REGEL:**
- Wenn der User über die App redet, Fragen stellt oder chattet → Antworte normal mit Text
- Wenn der User sagt "baue", "erstelle", "ändere", "füge hinzu" → Generiere/Update Code

${hasNonTemplateFiles ? `**AKTUELLES PROJEKT (nicht leer):**
${currentProjectState}

**WICHTIG BEI ÄNDERUNGEN:** Übernimm die existierenden Dateien und ändere nur was gefordert ist!` : `**NEUES PROJEKT:** Erstelle von Grund auf neu (keine Dateien vorhanden).`}

**USER SAGT:**
"${userPrompt}"

**ENTSCHEIDE:**

1. **FALLS CODE-AKTION** (baue, erstelle, ändere, füge hinzu, etc.):
   Antworte NUR mit einem JSON-Array der KOMPLETTEN App-Dateien:
   \`\`\`json
   [
     {"path": "package.json", "content": "{...als String...}"},
     {"path": "app.config.js", "content": "module.exports = {...}"},
     {"path": "App.tsx", "content": "import React..."}
   ]
   \`\`\`

2. **FALLS NORMALE KONVERSATION** (Fragen, Chat):
   Antworte einfach mit normalem Text. Kein JSON.`;

      combinedPrompt = AGENT_SYSTEM_PROMPT;
    }

    setIsAiLoading(true);
    let effectiveModel = config.selectedMode;
    if (currentProvider === 'groq' && effectiveModel === 'auto-groq') { effectiveModel = 'llama-3.1-8b-instant'; console.log(`AutoGroq -> ${effectiveModel}`); }
    const currentKeyIndex = config.keys[currentProvider]?.indexOf(apiKey) ?? -1;
    console.log(`Sende: ${currentProvider}, ${effectiveModel}, KeyIdx:${currentKeyIndex !== -1 ? currentKeyIndex : '?'}`);

    try {
      const { data, error: funcErr } = await supabase.functions.invoke('k1w1-handler', {
        body: { message: combinedPrompt, apiKey: apiKey, provider: currentProvider, model: effectiveModel }
      });
      if (funcErr) {
        console.error('Supabase Function Error:', funcErr);
        const s = funcErr.context?.status || 500;
        const d = funcErr.context?.details || funcErr.message;
        throw { name: 'FunctionsHttpError', status: s, message: d };
      }

      let aiText = data?.response;
      if (aiText && typeof aiText === 'string') { aiText = aiText.trim(); } else { aiText = ""; }

      if (aiText.length > 0) {
        const aiMsg: ChatMessage = { _id: Math.random().toString(36).substring(7), text: aiText, createdAt: new Date(), user: { _id: 2, name: 'AI' } };
        const newMessages = [aiMsg, ...(userMessage ? [userMessage] : []), ...originalMessages];
        await updateMessages(newMessages);

        try {
          const potentialJson = extractJSON(aiText);

          if (potentialJson) {
            console.log(`🔍 JSON gefunden (${potentialJson.length} Zeichen), versuche zu parsen...`);

            let parsedProject: any[] | null = null;
            try {
              const sanitized = sanitizeJsonString(potentialJson);
              parsedProject = JSON.parse(sanitized);

              if (Array.isArray(parsedProject)) {
                parsedProject = parsedProject.map((file) => ({
                  ...file,
                  content: typeof file.content === 'string'
                    ? file.content
                    : JSON.stringify(file.content, null, 2)
                }));
              }
            } catch (parseError: any) {
              console.warn("❌ JSON-Parse-Fehler:", parseError.message);
              console.warn("Extrahierter Text (erste 500 Zeichen):", potentialJson.substring(0, 500));
              throw new Error(`Antwort enthält JSON, aber Parsing fehlgeschlagen: ${parseError.message}`);
            }

            const validatedProject = parsedProject as ProjectFile[];
            if (Array.isArray(validatedProject) && validatedProject.length > 0 && validatedProject[0]?.path && validatedProject[0]?.content !== undefined && typeof validatedProject[0].content === 'string') {
              await updateProjectFiles(validatedProject);
              console.log(`✅ Projekt-Struktur mit ${validatedProject.length} Dateien gespeichert.`);

              const finalMessages = [...newMessages];
              const idx = finalMessages.findIndex(m => m._id === aiMsg._id);
              if (idx !== -1) {
                finalMessages[idx] = { ...aiMsg, text: `[Projekt mit ${validatedProject.length} Dateien aktualisiert. Siehe Code-Tab.]` };
                await updateMessages(finalMessages);
              }
            } else {
              if (Array.isArray(validatedProject) && validatedProject.length === 0) {
                throw new Error("Antwort ist normaler Text (leeres JSON-Array).");
              }
              throw new Error("Geparstes/Konvertiertes JSON ist kein gültiges Projektformat.");
            }
          } else {
            // Kein JSON = normale Chat-Antwort
            console.log("💬 Normale Chat-Antwort (kein JSON gefunden).");
          }
        } catch (jsonError: any) {
          if (jsonError.message.includes("normaler Text")) {
            console.log("💬 Letzte KI-Antwort (als Text) gespeichert.");
          } else {
            console.warn("⚠️ Fehler bei JSON-Verarbeitung:", jsonError.message);
          }
        }
      } else {
        setError('Leere oder ungültige Antwort von KI.');
        console.warn('Leere Antwort erhalten.');
      }
    } catch (e: any) {
      console.error('Send Fail:', e);
      let detailMsg = e.message || '?';
      let status = e.status || 500;

      if (status === 401 || status === 429) {
        const keyListLength = config.keys[currentProvider]?.length || 0;

        if (rotationCountRef.current >= keyListLength) {
          detailMsg = `Alle ${currentProvider.toUpperCase()} Keys verbraucht/ungültig.`;
          Alert.alert("Keys leer", detailMsg);
          addLog(`Alle ${currentProvider} Keys leer.`);
          setError(detailMsg);
          if (fileToSend && !customPrompt) setSelectedFileAsset(null);
          if (userMessage) {
            await updateMessages([userMessage, ...originalMessages]);
          }
        } else {
          console.log(`Key Problem (${status}), rotiere...`);
          addLog(`Key ${currentProvider} (${status}). Rotiere...`);
          rotationCountRef.current++;

          const nextKey = await rotateApiKey(currentProvider);
          if (nextKey && nextKey !== apiKey) {
            console.log("Retry new Key...");
            if (fileToSend && !selectedFileAsset && !customPrompt) {
              console.log("Stelle Datei für Retry wieder her.");
              setSelectedFileAsset(fileToSend);
            }
            handleSend(true, combinedPrompt, nextKey);
            return;
          }
        }
      } else {
        Alert.alert('Sende-Fehler', `${currentProvider.toUpperCase()} (${status}): ${detailMsg}`);
        setError(detailMsg);
        if (fileToSend && !customPrompt) setSelectedFileAsset(null);
        if (userMessage) {
          await updateMessages([userMessage, ...originalMessages]);
        }
      }
    } finally {
      setIsAiLoading(false);
    }
  }, [textInput, supabase, getCurrentApiKey, rotateApiKey, addLog, config, selectedFileAsset, messages, projectData, updateProjectFiles, updateMessages, isProjectLoading]);

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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  keyboardAvoidingContainer: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingVertical: 10, paddingHorizontal: 10 },
  messageBubble: {
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    maxWidth: '80%',
    borderWidth: 2,
  },
  userMessage: {
    backgroundColor: 'transparent',
    borderColor: theme.palette.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 0
  },
  aiMessage: {
    backgroundColor: 'transparent',
    borderColor: theme.palette.card,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 0
  },
  messagePressed: { opacity: 0.7 },
  userMessageText: {
    fontSize: 16,
    color: theme.palette.primary
  },
  aiMessageText: {
    fontSize: 16,
    color: theme.palette.text.primary
  },
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
