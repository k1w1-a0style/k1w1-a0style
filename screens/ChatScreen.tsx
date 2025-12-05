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
  Animated,
  Easing,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const [textInput, setTextInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileAsset, setSelectedFileAsset] =
    useState<DocumentResultAsset | null>(null);
  
  // Streaming state
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  // Animation values
  const thinkingOpacity = useRef(new Animated.Value(0)).current;
  const thinkingScale = useRef(new Animated.Value(0.8)).current;
  const typingDot1 = useRef(new Animated.Value(0)).current;
  const typingDot2 = useRef(new Animated.Value(0)).current;
  const typingDot3 = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0.8)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const sendButtonScale = useRef(new Animated.Value(1)).current;

  const combinedIsLoading = isProjectLoading || isAiLoading;
  const projectFiles: ProjectFile[] = projectData?.files ?? [];

  // Auto-scroll when messages change
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Typing dots animation (when AI is thinking/loading)
  useEffect(() => {
    if (isAiLoading || isStreaming) {
      // Start thinking indicator animation
      Animated.parallel([
        Animated.timing(thinkingOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(thinkingScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();

      // Animate typing dots in sequence
      const animateDots = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(typingDot1, {
              toValue: 1,
              duration: 400,
              easing: Easing.ease,
              useNativeDriver: true,
            }),
            Animated.timing(typingDot2, {
              toValue: 1,
              duration: 400,
              easing: Easing.ease,
              useNativeDriver: true,
            }),
            Animated.timing(typingDot3, {
              toValue: 1,
              duration: 400,
              easing: Easing.ease,
              useNativeDriver: true,
            }),
            Animated.parallel([
              Animated.timing(typingDot1, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
              }),
              Animated.timing(typingDot2, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
              }),
              Animated.timing(typingDot3, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
              }),
            ]),
          ])
        ).start();
      };

      animateDots();
    } else {
      // Hide thinking indicator
      Animated.parallel([
        Animated.timing(thinkingOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(thinkingScale, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Reset dots
      typingDot1.setValue(0);
      typingDot2.setValue(0);
      typingDot3.setValue(0);
    }
  }, [isAiLoading, isStreaming]);

  // Modal animation
  useEffect(() => {
    if (showConfirmModal) {
      Animated.parallel([
        Animated.spring(modalScale, {
          toValue: 1,
          friction: 10,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      modalScale.setValue(0.8);
      modalOpacity.setValue(0);
    }
  }, [showConfirmModal]);

  // Cleanup streaming interval on unmount
  useEffect(() => {
    return () => {
      if (streamingIntervalRef.current) {
        clearTimeout(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }
    };
  }, []);

  // Streaming effect - simuliert fließendes Schreiben (OPTIMIERT)
  const simulateStreaming = useCallback((fullText: string, onComplete: () => void) => {
    // Clear any existing interval
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }

    setIsStreaming(true);
    setStreamingMessage('');
    
    let currentIndex = 0;
    const chunkSize = 8; // Optimiert für bessere Performance
    const delay = 25; // ms zwischen Chunks
    let scrollCounter = 0;
    let rafId: number | null = null;
    
    const updateStream = () => {
      if (currentIndex < fullText.length) {
        const nextChunk = fullText.slice(currentIndex, currentIndex + chunkSize);
        setStreamingMessage(prev => prev + nextChunk);
        currentIndex += chunkSize;
        
        // Auto-scroll nur alle 5 Chunks (Performance-Optimierung)
        scrollCounter++;
        if (scrollCounter % 5 === 0) {
          rafId = requestAnimationFrame(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          });
        }
        
        streamingIntervalRef.current = setTimeout(updateStream, delay);
      } else {
        if (streamingIntervalRef.current) {
          clearTimeout(streamingIntervalRef.current);
          streamingIntervalRef.current = null;
        }
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        setIsStreaming(false);
        // Final scroll
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        });
        onComplete();
      }
    };
    
    streamingIntervalRef.current = setTimeout(updateStream, delay);
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

    // Send button animation
    Animated.sequence([
      Animated.timing(sendButtonScale, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(sendButtonScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    setError(null);

    const userContent =
      textInput.trim() ||
      (selectedFileAsset ? `Datei gesendet: ${selectedFileAsset.name}` : '');

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

      const ai = await runOrchestrator(
        config.selectedChatProvider,
        config.selectedChatMode,
        config.qualityMode,
        llmMessages
      );

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
        '⚠️ Es ist ein Fehler im Builder-Flow aufgetreten.';
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
                <Animated.View
                  style={[
                    styles.typingDot,
                    {
                      opacity: typingDot1.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1],
                      }),
                      transform: [
                        {
                          translateY: typingDot1.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -4],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.typingDot,
                    {
                      opacity: typingDot2.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1],
                      }),
                      transform: [
                        {
                          translateY: typingDot2.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -4],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.typingDot,
                    {
                      opacity: typingDot3.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1],
                      }),
                      transform: [
                        {
                          translateY: typingDot3.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -4],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        );
      }
      return <MessageItem message={item} />;
    },
    [isStreaming, streamingMessage, messages.length, typingDot1, typingDot2, typingDot3]
  );

  const renderFooter = useCallback(() => {
    if (!combinedIsLoading) return null;
    return (
      <Animated.View
        style={[
          styles.loadingFooter,
          {
            opacity: thinkingOpacity,
            transform: [{ scale: thinkingScale }],
          },
        ]}
      >
        <ActivityIndicator size="small" color={theme.palette.primary} />
        <Text style={styles.loadingText}>🧠 KI denkt nach...</Text>
        <View style={styles.thinkingDots}>
          <Animated.View
            style={[
              styles.thinkingDot,
              {
                opacity: typingDot1.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.thinkingDot,
              {
                opacity: typingDot2.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.thinkingDot,
              {
                opacity: typingDot3.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                }),
              },
            ]}
          />
        </View>
      </Animated.View>
    );
  }, [combinedIsLoading, thinkingOpacity, thinkingScale, typingDot1, typingDot2, typingDot3]);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.container}>
          <View style={styles.listContainer}>
            {combinedIsLoading && messages.length === 0 ? (
              <View style={styles.loadingOverlay}>
                <Animated.View
                  style={{
                    opacity: thinkingOpacity,
                    transform: [{ scale: thinkingScale }],
                  }}
                >
                  <ActivityIndicator size="large" color={theme.palette.primary} />
                  <Text style={styles.loadingOverlayText}>
                    🧠 Projekt und Chat werden geladen...
                  </Text>
                </Animated.View>
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
                initialNumToRender={15}
              />
            )}
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={16} color={theme.palette.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <TouchableOpacity
              style={[
                styles.iconButton,
                selectedFileAsset && styles.iconButtonActive,
              ]}
              onPress={handlePickDocument}
              activeOpacity={0.7}
            >
              <Ionicons
                name="attach-outline"
                size={22}
                color={
                  selectedFileAsset
                    ? theme.palette.primary
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
              maxLength={2000}
            />

            <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  combinedIsLoading && styles.sendButtonDisabled,
                ]}
                onPress={handleSend}
                disabled={combinedIsLoading}
                activeOpacity={0.8}
              >
                {combinedIsLoading ? (
                  <ActivityIndicator size="small" color={theme.palette.background} />
                ) : (
                  <Ionicons
                    name="send"
                    size={20}
                    color={theme.palette.background}
                  />
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>

          {selectedFileAsset && (
            <View style={[styles.selectedFileBox, { paddingBottom: Math.max(insets.bottom, 8) }]}>
              <Ionicons name="document" size={16} color={theme.palette.primary} />
              <Text style={styles.selectedFileText}>
                {selectedFileAsset.name}
              </Text>
              <TouchableOpacity onPress={() => setSelectedFileAsset(null)}>
                <Ionicons name="close-circle" size={20} color={theme.palette.text.secondary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Bestätigungsmodal mit Animation */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="none"
        onRequestClose={rejectChanges}
      >
        <Animated.View
          style={[
            styles.modalOverlay,
            {
              opacity: modalOpacity,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{ scale: modalScale }],
                opacity: modalOpacity,
              },
            ]}
          >
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
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle" size={20} color={theme.palette.error} />
                <Text style={styles.modalButtonTextReject}>Ablehnen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonAccept]}
                onPress={applyChanges}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={20} color="#000" />
                <Text style={styles.modalButtonTextAccept}>Bestätigen</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
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
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    marginVertical: 8,
    gap: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: theme.palette.text.secondary,
    fontWeight: '500',
  },
  thinkingDots: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 4,
  },
  thinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.primary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.palette.error + '20',
    borderLeftWidth: 3,
    borderLeftColor: theme.palette.error,
  },
  errorText: {
    flex: 1,
    color: theme.palette.error,
    fontSize: 13,
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
    shadowColor: theme.palette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  selectedFileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: theme.palette.card,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
  },
  selectedFileText: {
    flex: 1,
    fontSize: 13,
    color: theme.palette.text.primary,
    fontWeight: '500',
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
    gap: 6,
    alignItems: 'center',
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: theme.palette.primary,
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
