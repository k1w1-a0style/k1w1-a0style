import React, { useState, useCallback, useEffect, memo, useRef } from 'react';
import {
  View, StyleSheet, FlatList, TextInput, Text, ActivityIndicator,
  Alert, TouchableOpacity, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ensureSupabaseClient } from '../lib/supabase';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SupabaseClient } from '@supabase/supabase-js';
import { useAI, CHAT_PROVIDER, AGENT_PROVIDER, AllAIProviders } from '../contexts/AIContext';
import { useTerminal } from '../contexts/TerminalContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useProject, ProjectFile, ChatMessage } from '../contexts/ProjectContext';
import * as Clipboard from 'expo-clipboard';
import { buildPrompt, ConversationHistory } from '../lib/prompts';
import { jsonrepair } from 'jsonrepair';
import { v4 as uuidv4 } from 'uuid';

type DocumentResultAsset = NonNullable<DocumentPicker.DocumentPickerResult['assets']>[0];
type ChatScreenProps = { navigation: any; route: { params?: { debugCode?: string } } };

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
        (result.length === 0 || (result[0]?.path && typeof result[0].content !== 'undefined'))
      ) {
        console.log('✅ JSON repariert');
        return result.map((file) => ({
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

const ChatScreen: React.FC<ChatScreenProps> = ({ navigation, route }) => {
  const { projectData, updateProjectFiles, messages, updateMessages, isLoading: isProjectLoading } = useProject();
  const { config, getCurrentApiKey, rotateApiKey } = useAI();
  const { addLog } = useTerminal();

  const [textInput, setTextInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [selectedFileAsset, setSelectedFileAsset] = useState<DocumentResultAsset | null>(null);

  const historyRef = useRef(new ConversationHistory());
  const flatListRef = useRef<FlatList>(null); // ✅ REF für Auto-Scroll

  const loadClient = useCallback(async () => {
    setError(null);
    try {
      setSupabase(await ensureSupabaseClient());
      console.log('CS: Supabase OK');
    } catch (e: any) {
      setError('Supabase Fehler');
    }
  }, []);

  useFocusEffect(useCallback(() => { loadClient(); }, [loadClient]));

  useEffect(() => {
    historyRef.current.loadFromMessages(messages);
  }, [messages]);

  // ✅ AUTO-SCROLL bei neuen Nachrichten
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    }
  }, [messages]);

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

  const handleSend = useCallback(
    async (customPrompt?: string) => {
      let userPrompt = customPrompt ?? textInput.trim();
      const fileToSend = selectedFileAsset;
      const displayPrompt =
        textInput.trim() ||
        (fileToSend ? `(Datei: ${fileToSend.name})` : customPrompt ? 'Debug Anfrage' : '');

      if (
        (!userPrompt && !fileToSend && !customPrompt) ||
        !supabase ||
        isProjectLoading ||
        !projectData
      ) {
        if (!supabase) Alert.alert('Fehler', 'Supabase nicht verbunden');
        if (isProjectLoading || !projectData) Alert.alert('Fehler', 'Projekt lädt noch');
        return;
      }

      setError(null);
      setIsAiLoading(true);

      let messageForHistory = userPrompt;
      if (fileToSend && !customPrompt) {
        try {
          const fileContent = await FileSystem.readAsStringAsync(fileToSend.uri, {
            encoding: 'utf8',
          });
          messageForHistory = `--- Datei: ${fileToSend.name} ---\n${fileContent}\n--- Ende ---\n\n${
            userPrompt || '(Siehe Datei)'
          }`;
        } catch (readError: any) {
          console.error('Read Fail:', readError);
          Alert.alert('Lese-Fehler', `Datei "${fileToSend.name}" konnte nicht gelesen werden.`);
          setIsAiLoading(false);
          setSelectedFileAsset(null);
          return;
        }
      }

      const userMessage: ChatMessage = {
        _id: uuidv4(),
        text: displayPrompt || '...',
        createdAt: new Date(),
        user: { _id: 1, name: 'User' },
      };
      setTextInput('');
      if (fileToSend && !customPrompt) setSelectedFileAsset(null);

      historyRef.current.addUser(messageForHistory);
      const originalMessages = messages;
      await updateMessages([userMessage, ...originalMessages]);

      let finalProjectFiles: ProjectFile[] | null = null;
      let finalAiTextMessage: string | null = null;
      let currentProvider: AllAIProviders = CHAT_PROVIDER;
      let aiMessageId = uuidv4();

      const callProviderWithRetry = async (
        provider: AllAIProviders,
        promptMessages: any[],
        model: string,
        maxRetries: number = 3
      ): Promise<any> => {
        let lastError: any = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const apiKey = getCurrentApiKey(provider);

          console.log(`🔄 Versuch ${attempt + 1}/${maxRetries} für ${provider}`);
          console.log(`🔑 Verwende Key Index: ${config.keyIndexes[provider]} von ${config.keys[provider]?.length || 0}`);
          console.log(`🔑 Key: ${apiKey?.substring(0, 10)}...`);

          if (!apiKey) {
            throw new Error(`Keine API Keys für ${provider} verfügbar`);
          }

          try {
            const { data, error } = await supabase.functions.invoke('k1w1-handler', {
              body: {
                messages: promptMessages,
                apiKey: apiKey,
                provider: provider,
                model: model,
              },
            });

            if (error) throw error;
            return data;

          } catch (error: any) {
            lastError = error;
            console.error(`❌ Fehler bei ${provider} (Versuch ${attempt + 1}):`, error.message);

            const errorMsg = error.message?.toLowerCase() || '';
            const shouldRotate =
              errorMsg.includes('invalid') ||
              errorMsg.includes('unauthorized') ||
              errorMsg.includes('restricted') ||
              errorMsg.includes('rate') ||
              error.status === 401 ||
              error.status === 429;

            if (shouldRotate && attempt < maxRetries - 1) {
              console.log(`🔑 Rotiere Key für ${provider}...`);
              const newKey = await rotateApiKey(provider);
              if (newKey) {
                console.log(`✅ Neuer Key aktiv: ${newKey.substring(0, 10)}...`);
                addLog(`Key rotiert für ${provider}`);
                continue;
              } else {
                console.log(`❌ Keine weiteren Keys für ${provider}`);
                break;
              }
            }

            if (errorMsg.includes('organization_restricted') || errorMsg.includes('account gesperrt')) {
              throw new Error(`${provider.toUpperCase()} Account ist GESPERRT! Verwende einen anderen Provider oder erstelle einen neuen Account.`);
            }
          }
        }

        throw lastError || new Error(`Alle Versuche für ${provider} fehlgeschlagen`);
      };

      try {
        console.log(`🚀 Stage 1: ${CHAT_PROVIDER} (${config.selectedChatMode})`);
        currentProvider = CHAT_PROVIDER;

        const groqPromptMessages = buildPrompt(
          'generator',
          CHAT_PROVIDER,
          messageForHistory,
          projectData.files,
          historyRef.current.getHistory()
        );

        console.log(`📝 Sende ${groqPromptMessages.length} Messages an ${CHAT_PROVIDER}`);

        const groqData = await callProviderWithRetry(
          CHAT_PROVIDER,
          groqPromptMessages,
          config.selectedChatMode
        );

        const groqRawResponse = groqData?.response?.trim() || '';
        if (!groqRawResponse) {
          console.warn(`⚠️ ${CHAT_PROVIDER}: Leere Antwort`);
          throw new Error(`${CHAT_PROVIDER} lieferte keine Antwort`);
        }
        console.log(`💬 ${CHAT_PROVIDER} Antwort: ${groqRawResponse.length} chars`);
        historyRef.current.addAssistant(groqRawResponse);

        const potentialJsonString = extractJsonArray(groqRawResponse);

        if (config.qualityMode === 'speed') {
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
        } else {
          console.log(`⚙️ Modus: Qualität - Stage 2: ${AGENT_PROVIDER} (${config.selectedAgentMode})`);
          currentProvider = AGENT_PROVIDER;

          const agentPromptMessages = buildPrompt(
            'agent',
            AGENT_PROVIDER,
            groqRawResponse,
            projectData.files,
            historyRef.current.getHistory(),
            messageForHistory
          );

          const agentData = await callProviderWithRetry(
            AGENT_PROVIDER,
            agentPromptMessages,
            config.selectedAgentMode
          );

          const agentResponse = agentData?.response?.trim() || '';
          if (!agentResponse) {
            console.warn(`⚠️ ${AGENT_PROVIDER} Agent: Leere Antwort`);
            throw new Error('Agent lieferte keine Antwort');
          }
          console.log(`🤖 Agent Antwort: ${agentResponse.length} chars`);

          const currentHist = historyRef.current.getHistory();
          if (currentHist.length > 0 && currentHist[currentHist.length-1].role === 'assistant') {
              currentHist[currentHist.length-1].content = agentResponse;
          } else {
              historyRef.current.addAssistant(agentResponse);
          }

          const agentJsonString = extractJsonArray(agentResponse);
          if (agentJsonString) {
            finalProjectFiles = tryParseJsonWithRepair(agentJsonString);
            if (!finalProjectFiles) {
              console.warn('⚠️ Quality: Agent JSON Parse fehlgeschlagen');
              finalAiTextMessage = agentResponse;
            }
          } else {
            finalAiTextMessage = agentResponse;
          }
        }

        let aiMessageTextToShow: string;

        if (finalProjectFiles) {
          await updateProjectFiles(finalProjectFiles);
          aiMessageTextToShow = `✅ Projekt aktualisiert (${finalProjectFiles.length} Dateien${config.qualityMode === 'quality' ? ' - Agent geprüft' : ''})`;

          const currentHist = historyRef.current.getHistory();
          if (currentHist.length > 0 && currentHist[currentHist.length - 1].role === 'assistant') {
              currentHist[currentHist.length - 1].content = `[Code mit ${finalProjectFiles.length} Dateien generiert]`;
          }
        } else if (finalAiTextMessage) {
          aiMessageTextToShow = finalAiTextMessage;
        } else {
          aiMessageTextToShow = 'Fehler: Keine gültige Antwort erhalten.';
          setError(aiMessageTextToShow);
        }

        const aiMessage: ChatMessage = {
          _id: aiMessageId,
          text: aiMessageTextToShow,
          createdAt: new Date(),
          user: { _id: 2, name: 'AI' },
        };
        await updateMessages([aiMessage, userMessage, ...originalMessages]);

      } catch (e: any) {
        console.error(`❌ Send Fail (${currentProvider}):`, e);
        let detailMsg = e.message || 'Unbekannter Fehler';

        Alert.alert('Fehler', detailMsg);
        setError(detailMsg);

        await updateMessages(originalMessages);
        historyRef.current.loadFromMessages(originalMessages);

      } finally {
        setIsAiLoading(false);
      }
    },
    [
      textInput, selectedFileAsset, supabase, config, projectData, messages,
      isProjectLoading, getCurrentApiKey, rotateApiKey, addLog,
      updateProjectFiles, updateMessages
    ]
  );

  useEffect(() => {
    if (route.params?.debugCode) {
      const code = route.params.debugCode;
      console.log('CS: Debug vom CodeScreen');
      const debugPrompt = `Analysiere:\n\n\`\`\`\n${code}\n\`\`\``;
      setTextInput('Debug Anfrage...');
      handleSend(debugPrompt);
      navigation.setParams({ debugCode: undefined });
    }
  }, [route.params?.debugCode, navigation, handleSend]);

  const handleDebugLastResponse = () => {
    const lastAiMessage = messages.find(m => m.user._id === 2);
    if (!lastAiMessage?.text || lastAiMessage.text.startsWith('✅ Projekt')) {
      Alert.alert('Nichts zu debuggen', 'Keine gültige Textantwort von der KI gefunden.');
      return;
    }
    const prompt = `Analysiere:\n\n\`\`\`\n${lastAiMessage.text}\n\`\`\``;
    setTextInput('Debug Anfrage...');
    handleSend(prompt);
  };

  const handleExpoGo = () => {
    if (!projectData) {
      Alert.alert('Fehler', 'Kein Projekt geladen');
      return;
    }
    const metroHost = "10.212.162.31:8081";
    const expUrl = `exp://${metroHost}`;

    Alert.alert(
      'Expo Go Vorschau',
      `Öffne Expo Go und scanne den QR-Code oder öffne:\n\n${expUrl}`,
      [
        { text: 'URL kopieren', onPress: () => Clipboard.setStringAsync(expUrl) },
        { text: 'OK' },
      ]
    );
    console.log(`📲 Expo Go URL: ${expUrl}`);
    addLog(`Expo Go URL: ${expUrl}`);
  };

  const isSupabaseReady = supabase && !supabase.functions.invoke.toString().includes('DUMMY_CLIENT');
  const combinedIsLoading = isAiLoading || isProjectLoading;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
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

        {(!supabase || (isProjectLoading && messages.length === 0)) && (
          <ActivityIndicator style={styles.loadingIndicator} color={theme.palette.primary} size="large" />
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{String(error)}</Text>
          </View>
        )}

        <View style={styles.inputWrapper}>
          {selectedFileAsset && (
            <View style={styles.attachedFileContainer}>
              <Ionicons name="document-attach-outline" size={16} color={theme.palette.text.secondary} />
              <Text style={styles.attachedFileText} numberOfLines={1}>{selectedFileAsset.name}</Text>
              <TouchableOpacity onPress={()=>setSelectedFileAsset(null)} style={styles.removeFileButton}>
                <Ionicons name="close-circle" size={18} color={theme.palette.text.secondary} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputContainerInner}>
            <TouchableOpacity onPress={handlePickDocument} style={styles.iconButton} disabled={combinedIsLoading}>
              <Ionicons name="add-circle-outline" size={28} color={combinedIsLoading ? theme.palette.text.disabled : theme.palette.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDebugLastResponse} style={styles.iconButton} disabled={combinedIsLoading || messages.filter(m=>m.user._id===2).length===0}>
              <Ionicons name="bug-outline" size={24} color={combinedIsLoading || messages.filter(m=>m.user._id===2).length===0 ? theme.palette.text.disabled : theme.palette.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExpoGo} style={styles.iconButton} disabled={!projectData || combinedIsLoading}>
              <Ionicons name="logo-react" size={24} color={!projectData || combinedIsLoading ? theme.palette.text.disabled : theme.palette.success} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder={!isSupabaseReady ? 'Verbinde...' : selectedFileAsset ? 'Zusatz...' : 'Nachricht...'}
              placeholderTextColor={theme.palette.text.secondary}
              value={textInput}
              onChangeText={setTextInput}
              editable={!combinedIsLoading && isSupabaseReady}
              multiline
              blurOnSubmit={false}
              maxHeight={120}
              textAlignVertical="center"
            />
            <TouchableOpacity
              onPress={() => handleSend()}
              disabled={combinedIsLoading || !isSupabaseReady || (!textInput.trim() && !selectedFileAsset)}
              style={[
                styles.sendButton,
                (!isSupabaseReady || combinedIsLoading || (!textInput.trim() && !selectedFileAsset)) && styles.sendButtonDisabled
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  loadingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    zIndex: 10,
  },
  list: {
    flex: 1
  },
  listContent: {
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
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
  messagePressed: {
    opacity: 0.7
  },
  userMessageText: {
    fontSize: 15,
    color: theme.palette.text.primary
  },
  aiMessageText: {
    fontSize: 15,
    color: theme.palette.text.primary
  },
  inputWrapper: {
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
  removeFileButton: {
    padding: 2
  },
  inputContainerInner: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 8,
    alignItems: 'flex-end',
  },
  iconButton: {
    padding: 8,
    marginBottom: 5
  },
  input: {
    flex: 1,
    backgroundColor: theme.palette.input.background,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    color: theme.palette.text.primary,
    fontSize: 16,
    minHeight: 44,
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
  sendButtonDisabled: {
    backgroundColor: theme.palette.text.disabled
  },
  errorContainer: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: theme.palette.error + '20',
    marginHorizontal: 10,
    marginBottom: 5,
    borderRadius: 8,
  },
  errorText: {
    color: theme.palette.error,
    textAlign: 'center',
    fontSize: 13
  },
});

export default ChatScreen;
