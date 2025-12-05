// screens/ChatScreen.tsx — Builder mit Bestätigung & Streaming

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
  Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

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

type PendingChange = {
  files: ProjectFile[];
  summary: string;
  created: string[];
  updated: string[];
  skipped: string[];
  aiResponse: any;
};

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
  
  // Streaming state
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  const combinedIsLoading = isProjectLoading || isAiLoading;
  const projectFiles: ProjectFile[] = projectData?.files ?? [];

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Streaming effect - simuliert fließendes Schreiben
  const simulateStreaming = useCallback((fullText: string, onComplete: () => void) => {
    setIsStreaming(true);
    setStreamingMessage('');
    
    let currentIndex = 0;
    const chunkSize = 3; // Zeichen pro Chunk
    const delay = 20; // ms zwischen Chunks
    
    const interval = setInterval(() => {
      if (currentIndex < fullText.length) {
        const nextChunk = fullText.slice(currentIndex, currentIndex + chunkSize);
        setStreamingMessage(prev => prev + nextChunk);
        currentIndex += chunkSize;
        
        // Auto-scroll während Streaming
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 10);
      } else {
        clearInterval(interval);
        setIsStreaming(false);
        onComplete();
      }
    }, delay);
    
    return () => clearInterval(interval);
  }, []);

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

  const applyChanges = useCallback(async () => {
    if (!pendingChange) return;

    try {
      await updateProjectFiles(pendingChange.files);

      const timing =
        pendingChange.aiResponse.timing && pendingChange.aiResponse.timing.durationMs
          ? ` (${(pendingChange.aiResponse.timing.durationMs / 1000).toFixed(1)}s)`
          : '';

      const confirmationText =
        `✅ Änderungen angewendet${timing}\n\n` +
        `🤖 Provider: ${pendingChange.aiResponse.provider || 'unbekannt'}${
          pendingChange.aiResponse.keysRotated ? ` (${pendingChange.aiResponse.keysRotated}x rotiert)` : ''
        }\n` +
        `📝 Neue Dateien: ${pendingChange.created.length}\n` +
        `📝 Geänderte Dateien: ${pendingChange.updated.length}\n` +
        `⏭ Übersprungen: ${pendingChange.skipped.length}`;

      addChatMessage({
        id: uuidv4(),
        role: 'assistant',
        content: confirmationText,
        timestamp: new Date().toISOString(),
        meta: {
          provider: pendingChange.aiResponse.provider,
        },
      });

      if (pendingChange.aiResponse.keysRotated && pendingChange.aiResponse.keysRotated > 0) {
        addChatMessage({
          id: uuidv4(),
          role: 'system',
          content: `🔄 API-Key wurde ${pendingChange.aiResponse.keysRotated}x automatisch rotiert (Rate Limit erreicht)`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      Alert.alert('Fehler', 'Änderungen konnten nicht angewendet werden');
      addChatMessage({
        id: uuidv4(),
        role: 'system',
        content: `⚠️ Fehler beim Anwenden der Änderungen: ${e?.message || 'Unbekannt'}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setShowConfirmModal(false);
      setPendingChange(null);
    }
  }, [pendingChange, updateProjectFiles, addChatMessage]);

  const rejectChanges = useCallback(() => {
    addChatMessage({
      id: uuidv4(),
      role: 'system',
      content: '❌ Änderungen wurden abgelehnt. Keine Dateien wurden geändert.',
      timestamp: new Date().toISOString(),
    });
    setShowConfirmModal(false);
    setPendingChange(null);
  }, [addChatMessage]);

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

      // Erstelle Zusammenfassung der Änderungen für Bestätigung
      const summaryText =
        `🤖 Die KI möchte folgende Änderungen vornehmen:\n\n` +
        `📝 **Neue Dateien** (${mergeResult.created.length}):\n` +
        (mergeResult.created.length > 0 
          ? mergeResult.created.slice(0, 5).map(f => `  • ${f}`).join('\n') + 
            (mergeResult.created.length > 5 ? `\n  ... und ${mergeResult.created.length - 5} weitere` : '')
          : '  (keine)') +
        `\n\n` +
        `📝 **Geänderte Dateien** (${mergeResult.updated.length}):\n` +
        (mergeResult.updated.length > 0 
          ? mergeResult.updated.slice(0, 5).map(f => `  • ${f}`).join('\n') +
            (mergeResult.updated.length > 5 ? `\n  ... und ${mergeResult.updated.length - 5} weitere` : '')
          : '  (keine)') +
        `\n\n` +
        `⏭ **Übersprungen** (${mergeResult.skipped.length}):\n` +
        (mergeResult.skipped.length > 0 
          ? mergeResult.skipped.slice(0, 3).map(f => `  • ${f}`).join('\n') +
            (mergeResult.skipped.length > 3 ? `\n  ... und ${mergeResult.skipped.length - 3} weitere` : '')
          : '  (keine)') +
        `\n\n` +
        `💡 **Auswirkung**: ` +
        (mergeResult.created.length > 0 ? `Erstellt neue Funktionen/Komponenten. ` : '') +
        (mergeResult.updated.length > 0 ? `Verbessert bestehenden Code. ` : '') +
        `\n\nMöchtest du diese Änderungen übernehmen?`;

      // Zeige Streaming-Nachricht
      const streamingId = uuidv4();
      addChatMessage({
        id: streamingId,
        role: 'assistant',
        content: '', // Wird durch Streaming gefüllt
        timestamp: new Date().toISOString(),
      });

      // Simuliere Streaming
      simulateStreaming(summaryText, () => {
        // Nach Streaming ist fertig, zeige Bestätigungsdialog
        setPendingChange({
          files: mergeResult.files,
          summary: summaryText,
          created: mergeResult.created,
          updated: mergeResult.updated,
          skipped: mergeResult.skipped,
          aiResponse: ai,
        });
        setShowConfirmModal(true);
      });

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
    simulateStreaming,
  ]);

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      // Wenn dies die letzte Nachricht ist und wir streamen, zeige Streaming-Text
      if (index === messages.length - 1 && isStreaming && item.role === 'assistant') {
        return (
          <View style={styles.messageWrapper}>
            <View style={[styles.messageBubble, styles.assistantBubble]}>
              <Text style={styles.assistantText}>{streamingMessage}</Text>
              <View style={styles.typingIndicator}>
                <View style={styles.typingDot} />
                <View style={[styles.typingDot, styles.typingDot2]} />
                <View style={[styles.typingDot, styles.typingDot3]} />
              </View>
            </View>
          </View>
        );
      }
      return <MessageItem message={item} />;
    },
    [isStreaming, streamingMessage, messages.length]
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
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
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

      {/* Bestätigungsmodal */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={rejectChanges}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="code-slash" size={28} color={theme.palette.primary} />
              <Text style={styles.modalTitle}>Änderungen bestätigen</Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                {pendingChange?.summary}
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonReject]}
                onPress={rejectChanges}
              >
                <Ionicons name="close-circle" size={20} color={theme.palette.error} />
                <Text style={styles.modalButtonTextReject}>Ablehnen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonAccept]}
                onPress={applyChanges}
              >
                <Ionicons name="checkmark-circle" size={20} color="#000" />
                <Text style={styles.modalButtonTextAccept}>Bestätigen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    paddingBottom: 20,
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
  messageWrapper: {
    marginVertical: 4,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 12,
    maxWidth: '85%',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  assistantText: {
    color: theme.palette.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },
  typingIndicator: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.primary,
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.palette.card,
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderWidth: 2,
    borderColor: theme.palette.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.palette.text.primary,
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  modalText: {
    fontSize: 14,
    color: theme.palette.text.primary,
    lineHeight: 22,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
  },
  modalButtonReject: {
    backgroundColor: 'transparent',
    borderColor: theme.palette.error,
  },
  modalButtonAccept: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
  },
  modalButtonTextReject: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.palette.error,
  },
  modalButtonTextAccept: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
});

export default ChatScreen;
