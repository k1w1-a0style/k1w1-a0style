// screens/ChatScreen.tsx — Builder mit Rotation-Feedback (TS-clean)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';
import { ChatMessage, ProjectFile } from '../contexts/types';
import MessageItem from '../components/MessageItem';
import { runOrchestrator } from '../lib/orchestrator';
import { normalizeAiResponse } from '../lib/normalizer';
import { applyFilesToProject } from '../lib/fileWriter';
import { buildBuilderMessages, LlmMessage } from '../lib/promptEngine';
import { useAI } from '../contexts/AIContext';
import { handleMetaCommand } from '../utils/metaCommands';
import { v4 as uuidv4 } from 'uuid';

type DocumentResultAsset = NonNullable<
  import('expo-document-picker').DocumentPickerResult['assets']
>[0];

const ChatScreen: React.FC = () => {
  const {
    projectData,
    messages,
    isLoading: isProjectLoading,
    addChatMessage,
    updateProjectFiles,
  } = useProject();

  const { config } = useAI();

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const [textInput, setTextInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileAsset, setSelectedFileAsset] =
    useState<DocumentResultAsset | null>(null);

  const combinedIsLoading = isProjectLoading || isAiLoading;
  const projectFiles: ProjectFile[] = projectData?.files ?? [];

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setSelectedFileAsset(asset);
        Alert.alert(
          '✅ Datei ausgewählt',
          `${asset.name} (${
            asset.size ? (asset.size / 1024).toFixed(2) + ' KB' : '?'
          })`
        );
      } else {
        setSelectedFileAsset(null);
      }
    } catch (e) {
      Alert.alert('Fehler', 'Dateiauswahl fehlgeschlagen');
      setSelectedFileAsset(null);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!textInput.trim() && !selectedFileAsset) {
      return;
    }

    setError(null);

    const userContent =
      textInput.trim() ||
      (selectedFileAsset ? `Datei gesendet: ${selectedFileAsset.name}` : '');

    const lower = userContent.toLowerCase();
    console.log('[ChatScreen] ▶️ Sende an KI:', userContent);

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: userContent,
      timestamp: new Date().toISOString(),
    };

    addChatMessage(userMessage);
    setTextInput('');
    setSelectedFileAsset(null);

    // 🧠 Check for Meta-Commands (instant responses without AI)
    const metaResult = handleMetaCommand(userContent, projectFiles);
    if (metaResult.handled && metaResult.message) {
      addChatMessage(metaResult.message);
      return;
    }

    // 🧠 KI-Flow
    setIsAiLoading(true);

    try {
      const historyWithCurrent = [...messages, userMessage];
      const historyAsLlm: LlmMessage[] = historyWithCurrent.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const llmMessages = buildBuilderMessages(
        historyAsLlm,
        userContent,
        projectFiles
      );

      console.log(
        '[ChatScreen] 🧠 LLM-Messages vorbereitet, Länge:',
        llmMessages.length
      );

      const ai = await runOrchestrator(
        config.selectedChatProvider,
        config.selectedChatMode,
        config.qualityMode,
        llmMessages
      );

      console.log('[ChatScreen] 🤖 Orchestrator Ergebnis:', ai);

      if (!ai || !ai.ok) {
        const msg =
          '⚠️ Die KI konnte keinen gültigen Output liefern (kein ok=true).';
        setError(msg);
        addChatMessage({
          id: uuidv4(),
          role: 'assistant',
          content: msg,
          timestamp: new Date().toISOString(),
        });
        setIsAiLoading(false);
        return;
      }

      if (!ai.text && !ai.files) {
        const msg = '⚠️ Die KI-Antwort war leer oder ohne Dateien.';
        setError(msg);
        addChatMessage({
          id: uuidv4(),
          role: 'assistant',
          content: msg,
          timestamp: new Date().toISOString(),
        });
        setIsAiLoading(false);
        return;
      }

      console.log(
        '[ChatScreen] 📄 Rohe KI-Antwort-Länge:',
        (ai.text || '').length
      );

      const rawForNormalizer =
        ai.files && Array.isArray(ai.files)
          ? ai.files
          : ai.text
          ? ai.text
          : ai.raw;

      const normalized = normalizeAiResponse(rawForNormalizer);

      if (!normalized) {
        const msg =
          '⚠️ Normalizer/Validator konnte die Dateien nicht verarbeiten.';
        setError(msg);
        addChatMessage({
          id: uuidv4(),
          role: 'assistant',
          content: msg,
          timestamp: new Date().toISOString(),
        });
        setIsAiLoading(false);
        return;
      }

      console.log(
        '[ChatScreen] 📦 Normalisierte Dateien:',
        normalized.length
      );

      const mergeResult = applyFilesToProject(projectFiles, normalized);
      await updateProjectFiles(mergeResult.files);

      const timing =
        ai.timing && ai.timing.durationMs
          ? ` (${(ai.timing.durationMs / 1000).toFixed(1)}s)`
          : '';

      const summaryText =
        `✅ KI-Update erfolgreich${timing}\n\n` +
        `🤖 Provider: ${ai.provider || 'unbekannt'}${
          ai.keysRotated ? ` (${ai.keysRotated}x rotiert)` : ''
        }\n` +
        `📝 Neue Dateien: ${mergeResult.created.length}\n` +
        `📝 Geänderte Dateien: ${mergeResult.updated.length}\n` +
        `⏭ Übersprungen: ${mergeResult.skipped.length}`;

      addChatMessage({
        id: uuidv4(),
        role: 'assistant',
        content: summaryText,
        timestamp: new Date().toISOString(),
        meta: {
          provider: ai.provider,
        },
      });

      if (ai.keysRotated && ai.keysRotated > 0) {
        addChatMessage({
          id: uuidv4(),
          role: 'system',
          content: `🔄 API-Key wurde ${ai.keysRotated}x automatisch rotiert (Rate Limit erreicht)`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      const msg =
        '⚠️ Es ist ein Fehler im Builder-Flow aufgetreten. Siehe Konsole.';
      console.log('[ChatScreen] ⚠️ Fehler:', e?.message || e);
      setError(msg);
      addChatMessage({
        id: uuidv4(),
        role: 'assistant',
        content: `${msg}\n\n${e?.message || 'Unbekannter Fehler'}`,
        timestamp: new Date().toISOString(),
        meta: { error: true },
      });
    } finally {
      setIsAiLoading(false);
    }
  }, [
    textInput,
    selectedFileAsset,
    projectFiles,
    messages,
    config,
    addChatMessage,
    updateProjectFiles,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => <MessageItem message={item} />,
    []
  );

  const renderFooter = useCallback(() => {
    if (!combinedIsLoading) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={theme.palette.primary} />
        <Text style={styles.loadingText}>Builder arbeitet ...</Text>
      </View>
    );
  }, [combinedIsLoading]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      <View style={styles.container}>
        <View style={styles.listContainer}>
          {combinedIsLoading && messages.length === 0 ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={theme.palette.primary} />
              <Text style={styles.loadingOverlayText}>
                Projekt und Chat werden geladen ...
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListFooterComponent={renderFooter}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={21}
            />
          )}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={[
              styles.iconButton,
              selectedFileAsset && styles.iconButtonActive,
            ]}
            onPress={handlePickDocument}
          >
            <Ionicons
              name="attach-outline"
              size={22}
              color={
                selectedFileAsset
                  ? theme.palette.secondary
                  : theme.palette.text.secondary
              }
            />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Beschreibe deine App oder den nächsten Schritt ..."
            placeholderTextColor={theme.palette.text.secondary}
            value={textInput}
            onChangeText={setTextInput}
            multiline
          />

          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSend}
            disabled={combinedIsLoading}
          >
            {combinedIsLoading ? (
              <ActivityIndicator size="small" color={theme.palette.background} />
            ) : (
              <Ionicons
                name="send-outline"
                size={20}
                color={theme.palette.background}
              />
            )}
          </TouchableOpacity>
        </View>

        {selectedFileAsset && (
          <View style={styles.selectedFileBox}>
            <Text style={styles.selectedFileText}>
              📎 {selectedFileAsset.name}
            </Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  container: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    paddingBottom: 80,
  },
  loadingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlayText: {
    marginTop: 12,
    color: theme.palette.text.secondary,
  },
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: theme.palette.text.secondary,
  },
  errorText: {
    color: theme.palette.error,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  iconButtonActive: {
    borderColor: theme.palette.secondary,
  },
  textInput: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: theme.palette.text.primary,
    fontSize: 14,
    backgroundColor: theme.palette.background,
  },
  sendButton: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedFileBox: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: theme.palette.card,
  },
  selectedFileText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
});

export default ChatScreen;
