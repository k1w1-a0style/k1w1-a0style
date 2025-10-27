import React, { useState, useCallback, useEffect, memo, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Text,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ensureSupabaseClient } from '../lib/supabase';
import { theme, HEADER_HEIGHT } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SupabaseClient } from '@supabase/supabase-js';
import { useAI, CHAT_PROVIDER, AGENT_PROVIDER, AllAIProviders } from '../contexts/AIContext';
import { useTerminal } from '../contexts/TerminalContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useProject, ProjectFile, ChatMessage } from '../contexts/ProjectContext';
import * as Clipboard from 'expo-clipboard';
import { buildPrompt, ConversationHistory } from '../lib/prompts';
import { jsonrepair } from 'jsonrepair';
import { v4 as uuidv4 } from 'uuid';

type DocumentResultAsset = NonNullable<DocumentPicker.DocumentPickerResult['assets']>[0];

// ============================================================================
// HELPERS
// ============================================================================

const extractJsonArray = (text: string): string | null => {
  const match = text.match(/```json\s*(\[[\s\S]*\])\s*```|(\[[\s\S]*\])/);
  if (!match) return null;
  const jsonString = match[1] || match[2];
  if (jsonString) {
    console.log(`🔍 JSON gefunden (${jsonString.length} chars)`);
    return jsonString;
  }
  return null;
};

const tryParseJsonWithRepair = (jsonString: string): ProjectFile[] | null => {
  try {
    return JSON.parse(jsonString) as ProjectFile[];
  } catch (e) {
    try {
      const repaired = jsonrepair(jsonString);
      const result = JSON.parse(repaired);
      
      if (
        Array.isArray(result) &&
        (result.length === 0 ||
          (result[0]?.path && typeof result[0].content !== 'undefined'))
      ) {
        console.log('✅ JSON repariert');
        return result.map(file => ({
          ...file,
          content:
            typeof file.content === 'string'
              ? file.content
              : JSON.stringify(file.content ?? '', null, 2),
        }));
      } else {
        console.warn('⚠️ JSON repariert, aber Format ungültig');
        return null;
      }
    } catch (error) {
      console.error('❌ JSON Parse fehlgeschlagen:', error);
      return null;
    }
  }
};

// ============================================================================
// MESSAGE COMPONENT
// ============================================================================

const MessageItem = memo(({ item }: { item: ChatMessage }) => {
  const messageText = item?.text?.trim() ?? '';
  if (item?.user?._id === 1 && messageText.length === 0) return null;

  const handleLongPress = () => {
    if (messageText) {
      Clipboard.setStringAsync(messageText);
      Alert.alert('Kopiert');
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.messageBubble,
        item.user._id === 1 ? styles.userMessage : styles.aiMessage,
        pressed && styles.messagePressed,
      ]}
      onLongPress={handleLongPress}
    >
      <Text style={item.user._id === 1 ? styles.userMessageText : styles.aiMessageText}>
        {messageText || '...'}
      </Text>
    </Pressable>
  );
});

// ============================================================================
// CHAT SCREEN
// ============================================================================

const ChatScreen: React.FC<{ navigation: any; route: { params?: { debugCode?: string } } }> = ({
  navigation,
  route,
}) => {
  const { projectData, updateProjectFiles, messages, updateMessages, isLoading: isProjectLoading } =
    useProject();
  const { config, getCurrentApiKey, rotateApiKey } = useAI();
  const { addLog } = useTerminal();

  const [textInput, setTextInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [selectedFileAsset, setSelectedFileAsset] = useState<DocumentResultAsset | null>(null);
  
  const historyRef = useRef(new ConversationHistory());
  const rotationCounters = useRef<Record<string, number>>({ groq: 0, gemini: 0 });

  // Load Supabase
  const loadClient = useCallback(async () => {
    setError(null);
    try {
      setSupabase(await ensureSupabaseClient());
      console.log('CS: Supabase OK');
    } catch (e: any) {
      setError('Supabase Fehler');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadClient();
    }, [loadClient])
  );

  // Load history
  useEffect(() => {
    if (messages.length > 0) {
      historyRef.current.loadFromMessages(messages);
    }
  }, [messages.length]); // Only on length change

  // File picker
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setSelectedFileAsset(asset);
        Alert.alert(
          'Datei ausgewählt',
          `${asset.name} (${asset.size ? (asset.size / 1024).toFixed(2) + ' KB' : '?'})`
        );
      } else {
        setSelectedFileAsset(null);
      }
    } catch (e) {
      console.error('Pick Error:', e);
      Alert.alert('Fehler', 'Dateiauswahl fehlgeschlagen');
      setSelectedFileAsset(null);
    }
  };

  // ============================================================================
  // MAIN SEND LOGIC
  // ============================================================================

  const handleSend = useCallback(
    async (customPrompt?: string) => {
      let userPrompt = customPrompt ?? textInput.trim();
      const fileToSend = selectedFileAsset;
      const displayPrompt =
        textInput.trim() || (fileToSend ? `(Datei: ${fileToSend.name})` : customPrompt ? 'Debug' : '');

      if ((!userPrompt && !fileToSend && !customPrompt) || !supabase || isProjectLoading || !projectData) {
        if (!supabase) Alert.alert('Fehler', 'Supabase nicht verbunden');
        if (isProjectLoading || !projectData) Alert.alert('Fehler', 'Projekt lädt noch');
        return;
      }

      setError(null);
      rotationCounters.current = { groq: 0, gemini: 0 };
      setIsAiLoading(true);

      // Prepare message
      let messageForHistory = userPrompt;
      if (fileToSend && !customPrompt) {
        try {
          const fileContent = await FileSystem.readAsStringAsync(fileToSend.uri, {
            encoding: 'utf8',
          });
          messageForHistory = `--- Datei: ${fileToSend.name} ---\n${fileContent}\n--- Ende ---\n\n${userPrompt || '(Siehe Datei)'}`;
        } catch (readError: any) {
          console.error('Read Error:', readError);
          Alert.alert('Lese-Fehler', `Datei "${fileToSend.name}" konnte nicht gelesen werden`);
          setIsAiLoading(false);
          setSelectedFileAsset(null);
          return;
        }
      }

      // Add user message
      const userMessage: ChatMessage = {
        _id: uuidv4(),
        text: displayPrompt || '...',
        createdAt: new Date(),
        user: { _id: 1, name: 'User' },
      };

      setTextInput('');
      if (fileToSend && !customPrompt) setSelectedFileAsset(null);
      
      historyRef.current.addUser(messageForHistory);
      await updateMessages([userMessage, ...messages]);

      let finalProjectFiles: ProjectFile[] | null = null;
      let finalAiTextMessage: string | null = null;
      let currentProvider: AllAIProviders = CHAT_PROVIDER;

      try {
        // ========================================================================
        // STAGE 1: GROQ
        // ========================================================================
        
        console.log(`🚀 Stage 1: Groq (${config.selectedChatMode})`);
        currentProvider = CHAT_PROVIDER;

        const groqApiKey = getCurrentApiKey(CHAT_PROVIDER);
        if (!groqApiKey) throw new Error(`Kein API Key für ${CHAT_PROVIDER.toUpperCase()}`);

        const groqPromptMessages = buildPrompt(
          'generator',
          CHAT_PROVIDER,
          messageForHistory,
          projectData.files,
          historyRef.current.getHistory()
        );

        const { data: groqData, error: groqFuncErr } = await supabase.functions.invoke(
          'k1w1-handler',
          {
            body: {
              messages: groqPromptMessages,
              apiKey: groqApiKey,
              provider: CHAT_PROVIDER,
              model: config.selectedChatMode,
            },
          }
        );

        if (groqFuncErr) throw groqFuncErr;

        const groqRawResponse = groqData?.response?.trim() || '';
        if (!groqRawResponse) {
          console.warn('⚠️ Groq: Leere Antwort');
          throw new Error('Groq lieferte keine Antwort');
        }

        console.log(`💬 Groq Antwort: ${groqRawResponse.length} chars`);

        // ========================================================================
        // QUALITY MODE DECISION
        // ========================================================================

        const potentialJsonString = extractJsonArray(groqRawResponse);

        if (config.qualityMode === 'speed') {
          // SPEED MODE
          console.log('⚙️ Modus: Geschwindigkeit');
          
          if (potentialJsonString) {
            finalProjectFiles = tryParseJsonWithRepair(potentialJsonString);
            if (!finalProjectFiles) {
              console.warn('⚠️ Speed: JSON Parse fehlgeschlagen');
              finalAiTextMessage = groqRawResponse;
            }
          } else {
            finalAiTextMessage = groqRawResponse;
          }

          // Add to history
          historyRef.current.addAssistant(
            finalProjectFiles
              ? `[Code mit ${finalProjectFiles.length} Dateien generiert]`
              : groqRawResponse
          );
          
        } else {
          // QUALITY MODE
          console.log(`⚙️ Modus: Qualität - Stage 2: Gemini (${config.selectedAgentMode})`);
          currentProvider = AGENT_PROVIDER;

          const geminiApiKey = getCurrentApiKey(AGENT_PROVIDER);
          if (!geminiApiKey) throw new Error(`Kein API Key für ${AGENT_PROVIDER.toUpperCase()}`);

          const agentPromptMessages = buildPrompt(
            'agent',
            AGENT_PROVIDER,
            groqRawResponse,
            projectData.files,
            historyRef.current.getHistory(),
            messageForHistory
          );

          const { data: agentData, error: agentFuncErr } = await supabase.functions.invoke(
            'k1w1-handler',
            {
              body: {
                messages: agentPromptMessages,
                apiKey: geminiApiKey,
                provider: AGENT_PROVIDER,
                model: config.selectedAgentMode,
              },
            }
          );

          if (agentFuncErr) throw agentFuncErr;

          const agentResponse = agentData?.response?.trim() || '';
          if (!agentResponse) {
            console.warn('⚠️ Gemini Agent: Leere Antwort');
            throw new Error('Gemini Agent lieferte keine Antwort');
          }

          console.log(`🤖 Agent Antwort: ${agentResponse.length} chars`);

          const agentJsonString = extractJsonArray(agentResponse);
          if (agentJsonString) {
            finalProjectFiles = tryParseJsonWithRepair(agentJsonString);
            if (!finalProjectFiles) {
              console.warn('⚠️ Quality: Agent JSON Parse fehlgeschlagen');
              finalAiTextMessage = agentResponse;
            }
          } else {
            console.warn('⚠️ Quality: Agent lieferte kein JSON');
            finalAiTextMessage = agentResponse;
          }

          // Add ONLY agent response to history
          historyRef.current.addAssistant(
            finalProjectFiles
              ? `[Code mit ${finalProjectFiles.length} Dateien generiert]`
              : agentResponse
          );
        }

        // ========================================================================
        // PROCESS RESULT
        // ========================================================================

        if (finalProjectFiles) {
          // Code update
          await updateProjectFiles(finalProjectFiles);
          
          const confirmationText = `✅ Projekt aktualisiert (${finalProjectFiles.length} Dateien)`;
          
          const aiMessage: ChatMessage = {
            _id: uuidv4(),
            text: confirmationText,
            createdAt: new Date(),
            user: { _id: 2, name: 'AI' },
          };
          
          await updateMessages([aiMessage, userMessage, ...messages]);
          
        } else if (finalAiTextMessage) {
          // Text response
          const aiMessage: ChatMessage = {
            _id: uuidv4(),
            text: finalAiTextMessage,
            createdAt: new Date(),
            user: { _id: 2, name: 'AI' },
          };
          
          await updateMessages([aiMessage, userMessage, ...messages]);
          
        } else {
          throw new Error('Weder Code noch Text erhalten');
        }
        
      } catch (e: any) {
        // ========================================================================
        // ERROR HANDLING
        // ========================================================================
        
        console.error('Send Error:', e);
        
        let detailMsg = e.message || 'Unbekannter Fehler';
        const status = e.status || 500;

        // Key rotation on 401/429
        if (status === 401 || status === 429) {
          const keyListLength = config.keys[currentProvider]?.length || 0;
          const currentRotationCount = rotationCounters.current[currentProvider] || 0;

          if (currentRotationCount >= keyListLength) {
            detailMsg = `Alle ${currentProvider.toUpperCase()} Keys verbraucht (${status})`;
            Alert.alert('Keys erschöpft', detailMsg);
            addLog(detailMsg);
            setError(detailMsg);
          } else {
            console.log(`🔑 Key Problem (${status}) bei ${currentProvider}, rotiere...`);
            addLog(`Key ${currentProvider} (${status}). Rotiere...`);
            rotationCounters.current[currentProvider] = currentRotationCount + 1;
            
            const nextKey = await rotateApiKey(currentProvider);
            if (nextKey) {
              detailMsg = `Key rotiert für ${currentProvider.toUpperCase()}. Bitte erneut senden.`;
              setError(detailMsg);
            } else {
              detailMsg = `Key-Rotation fehlgeschlagen (${status})`;
              Alert.alert('Fehler', detailMsg);
              setError(detailMsg);
            }
          }
        } else {
          Alert.alert('Fehler', `${currentProvider.toUpperCase()} (${status}): ${detailMsg}`);
          setError(detailMsg);
        }
        
      } finally {
        setIsAiLoading(false);
      }
    },
    [
      textInput,
      selectedFileAsset,
      supabase,
      config,
      projectData,
      messages,
      isProjectLoading,
      getCurrentApiKey,
      rotateApiKey,
      addLog,
      updateProjectFiles,
      updateMessages,
    ]
  );

  // Debug handler
  useEffect(() => {
    if (route.params?.debugCode) {
      const code = route.params.debugCode;
      console.log('CS: Debug vom CodeScreen');
      const debugPrompt = `Analysiere:\n\n\`\`\`\n${code}\n\`\`\``;
      setTextInput('Debug...');
      handleSend(debugPrompt);
      navigation.setParams({ debugCode: undefined });
    }
  }, [route.params?.debugCode, navigation, handleSend]);

  const handleDebugLastResponse = () => {
    const lastAiMessage = messages.find(m => m.user._id === 2);
    if (!lastAiMessage?.text) {
      Alert.alert('Nichts zu debuggen');
      return;
    }
    const prompt = `Analysiere:\n\n\`\`\`\n${lastAiMessage.text}\n\`\`\``;
    setTextInput('Debug...');
    handleSend(prompt);
  };

  // Expo Go button handler
  const handleExpoGo = () => {
    if (!projectData) {
      Alert.alert('Fehler', 'Kein Projekt geladen');
      return;
    }

    // Generate exp:// URL (simplified - actual implementation would need server)
    const projectName = projectData.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const expUrl = `exp://localhost:8081`;

    Alert.alert(
      'Expo Go',
      `Öffne Expo Go App und scanne den QR-Code oder öffne:\n\n${expUrl}`,
      [
        { text: 'URL kopieren', onPress: () => Clipboard.setStringAsync(expUrl) },
        { text: 'OK' },
      ]
    );
  };

  const isSupabaseReady = supabase && !supabase.functions.invoke.toString().includes('DUMMY_CLIENT');
  const combinedIsLoading = isAiLoading || isProjectLoading;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingContainer}
        keyboardVerticalOffset={HEADER_HEIGHT + (Platform.OS === 'ios' ? 20 : -50)}
      >
        {/* Loading */}
        {(!supabase || (isProjectLoading && messages.length === 0)) && (
          <ActivityIndicator style={styles.loadingIndicator} color={theme.palette.primary} size="large" />
        )}

        {/* Messages */}
        <FlatList
          data={messages}
          renderItem={({ item }) => <MessageItem item={item} />}
          keyExtractor={item => item._id}
          inverted={true}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={11}
        />

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{String(error)}</Text>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainerOuter}>
          {/* Attached file */}
          {selectedFileAsset && (
            <View style={styles.attachedFileContainer}>
              <Ionicons name="document-attach-outline" size={16} color={theme.palette.text.secondary} />
              <Text style={styles.attachedFileText} numberOfLines={1}>
                {selectedFileAsset.name}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedFileAsset(null)}
                style={styles.removeFileButton}
              >
                <Ionicons name="close-circle" size={18} color={theme.palette.text.secondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Input row */}
          <View style={styles.inputContainerInner}>
            {/* Attach */}
            <TouchableOpacity
              onPress={handlePickDocument}
              style={styles.iconButton}
              disabled={combinedIsLoading}
            >
              <Ionicons
                name="add-circle-outline"
                size={28}
                color={combinedIsLoading ? theme.palette.text.disabled : theme.palette.primary}
              />
            </TouchableOpacity>

            {/* Debug */}
            <TouchableOpacity
              onPress={handleDebugLastResponse}
              style={styles.iconButton}
              disabled={combinedIsLoading || messages.filter(m => m.user._id === 2).length === 0}
            >
              <Ionicons
                name="bug-outline"
                size={24}
                color={
                  combinedIsLoading || messages.filter(m => m.user._id === 2).length === 0
                    ? theme.palette.text.disabled
                    : theme.palette.primary
                }
              />
            </TouchableOpacity>

            {/* Expo Go */}
            <TouchableOpacity
              onPress={handleExpoGo}
              style={styles.iconButton}
              disabled={!projectData || combinedIsLoading}
            >
              <Ionicons
                name="logo-react"
                size={24}
                color={
                  !projectData || combinedIsLoading ? theme.palette.text.disabled : theme.palette.success
                }
              />
            </TouchableOpacity>

            {/* Input */}
            <TextInput
              style={styles.input}
              placeholder={
                !isSupabaseReady
                  ? 'Verbinde...'
                  : selectedFileAsset
                  ? 'Zusatz...'
                  : 'Nachricht...'
              }
              placeholderTextColor={theme.palette.text.secondary}
              value={textInput}
              onChangeText={setTextInput}
              editable={!combinedIsLoading && isSupabaseReady}
              multiline
              blurOnSubmit={false}
            />

            {/* Send */}
            <TouchableOpacity
              onPress={() => handleSend()}
              disabled={
                combinedIsLoading || !isSupabaseReady || (!textInput.trim() && !selectedFileAsset)
              }
              style={[
                styles.sendButton,
                (!isSupabaseReady ||
                  combinedIsLoading ||
                  (!textInput.trim() && !selectedFileAsset)) &&
                  styles.sendButtonDisabled,
              ]}
            >
              {isAiLoading ? (
                <ActivityIndicator size="small" color={theme.palette.background} />
              ) : (
                <Ionicons name="send" size={24} color={theme.palette.background} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  keyboardAvoidingContainer: { flex: 1 },
  loadingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    zIndex: 10,
  },
  list: { flex: 1 },
  listContent: { paddingVertical: 10, paddingHorizontal: 10 },
  messageBubble: {
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    maxWidth: '85%',
    borderWidth: 1,
  },
  userMessage: {
    backgroundColor: theme.palette.primary + '20',
    borderColor: theme.palette.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 3,
  },
  aiMessage: {
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.border,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 3,
  },
  messagePressed: { opacity: 0.7 },
  userMessageText: { fontSize: 15, color: theme.palette.text.primary },
  aiMessageText: { fontSize: 15, color: theme.palette.text.primary },
  inputContainerOuter: {
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
    backgroundColor: theme.palette.background,
  },
  attachedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.input.background + '80',
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginHorizontal: 10,
    marginTop: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  attachedFileText: {
    flex: 1,
    marginLeft: 6,
    marginRight: 6,
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  removeFileButton: { padding: 2 },
  inputContainerInner: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  iconButton: { padding: 8, marginBottom: 5 },
  input: {
    flex: 1,
    backgroundColor: theme.palette.input.background,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    color: theme.palette.text.primary,
    fontSize: 16,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: theme.palette.primary,
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  sendButtonDisabled: { backgroundColor: theme.palette.text.disabled },
  errorContainer: {
    paddingHorizontal: 15,
    paddingVertical: 5,
    backgroundColor: theme.palette.error + '20',
  },
  errorText: { color: theme.palette.error, textAlign: 'center', fontSize: 13 },
});

export default ChatScreen;
