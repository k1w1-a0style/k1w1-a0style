// screens/ChatScreen.tsx — Builder mit Bestätigung & Streaming
// FIXES:
// 1) Kein "Gap" über der Tabbar (SafeArea ohne bottom-edge)
// 2) ✅ Keyboard hebt Input korrekt an (keyboardHeight - insets.bottom) und wird minimal "genudged" -> kein Mini-Spalt
// 3) ✅ Autoscroll stabil + Scroll-Button scrollt wirklich bis ganz unten (keine "nur ein Stück"-Scrolls mehr)
// 4) ✅ Entfernt den 1cm-Gap im Normalzustand: KEIN insets.bottom Padding in der Bottom-Leiste
// 5) ✅ Optimiert gegen "Chat ist kurz leer / flackert" beim Scrollen (removeClippedSubviews aus, Streaming nicht mehr als leere Message gespeichert)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  Animated,
  Easing,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
  NativeSyntheticEvent,
  TextInputSubmitEditingEventData,
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
import { buildBuilderMessages, buildValidatorMessages, LlmMessage } from '../lib/promptEngine';
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
  agentResponse?: any;
};

const INPUT_BAR_MIN_H = 56;
const SELECTED_FILE_ROW_H = 42;

// Mini-Feintuning (visuell ~1mm, je nach Device-Dichte)
const KEYBOARD_NUDGE = 2;

// Scroll Threshold: ab wann gilt "du bist unten"
const BOTTOM_THRESHOLD_PX = 80;

const ChatScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  const {
    projectData,
    messages,
    isLoading: isProjectLoading,
    addChatMessage,
    updateProjectFiles,
    autoFixRequest,
    clearAutoFixRequest,
  } = useProject();

  const { config } = useAI();

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);

  const [textInput, setTextInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFileAsset, setSelectedFileAsset] = useState<DocumentResultAsset | null>(null);

  // Streaming state (nur UI, wird NICHT als leere Message gespeichert)
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  const isAtBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Scroll metrics (für zuverlässiges Auto-Scroll + Button-Verhalten)
  const scrollStateRef = useRef({ y: 0, contentH: 0, layoutH: 0 });

  // Keyboard height
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

  // ---- KEYBOARD FIX ----
  // keyboardHeight enthält (je nach Gerät) auch Bottom-Inset/NavBar-Anteile.
  // => insets.bottom abziehen, sonst entsteht bei geöffneter Tastatur oben ein Spalt.
  // => KEYBOARD_NUDGE zieht minimal ab (damit die BottomBar ~1mm tiefer sitzt, Spalt weg)
  const keyboardOffsetInScreen =
    keyboardHeight > 0 ? Math.max(0, keyboardHeight - insets.bottom - KEYBOARD_NUDGE) : 0;

  // ✅ WICHTIG: KEIN insets.bottom hier! (sonst Gap im Normalzustand (BottomTabs))
  const bottomBarVisualH = INPUT_BAR_MIN_H + (selectedFileAsset ? SELECTED_FILE_ROW_H : 0);

  const listBottomPadding = bottomBarVisualH + keyboardOffsetInScreen + 14;
  const scrollBtnBottom = bottomBarVisualH + keyboardOffsetInScreen + 14;

  const computeBottomOffset = useCallback(() => {
    const { contentH, layoutH } = scrollStateRef.current;
    const target = Math.max(0, contentH - layoutH);
    return target;
  }, []);

  const scrollToBottom = useCallback(
    (animated: boolean) => {
      const target = computeBottomOffset();

      const doScroll = () => {
        // Ziel-Offset ist stabiler als "MAX_SAFE_INTEGER"
        try {
          flatListRef.current?.scrollToOffset({ offset: target, animated });
          return;
        } catch {}
        try {
          flatListRef.current?.scrollToEnd({ animated });
        } catch {}
      };

      requestAnimationFrame(doScroll);
      setTimeout(doScroll, 60);
    },
    [computeBottomOffset],
  );

  // Auto-scroll when messages change (only if user is at bottom)
  useEffect(() => {
    if (messages.length > 0 && isAtBottomRef.current) {
      const timer = setTimeout(() => scrollToBottom(true), 40);
      return () => clearTimeout(timer);
    }
  }, [messages, scrollToBottom]);

  // Keyboard Events
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvt as any, (e: any) => {
      setKeyboardHeight(e?.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvt as any, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Typing dots / thinking animation
  useEffect(() => {
    let animationRef: Animated.CompositeAnimation | null = null;

    if (isAiLoading || isStreaming) {
      Animated.parallel([
        Animated.timing(thinkingOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(thinkingScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start();

      animationRef = Animated.loop(
        Animated.sequence([
          Animated.timing(typingDot1, { toValue: 1, duration: 400, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(typingDot2, { toValue: 1, duration: 400, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(typingDot3, { toValue: 1, duration: 400, easing: Easing.ease, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(typingDot1, { toValue: 0, duration: 400, useNativeDriver: true }),
            Animated.timing(typingDot2, { toValue: 0, duration: 400, useNativeDriver: true }),
            Animated.timing(typingDot3, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]),
        ]),
      );
      animationRef.start();
    } else {
      Animated.parallel([
        Animated.timing(thinkingOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(thinkingScale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
      ]).start();

      typingDot1.setValue(0);
      typingDot2.setValue(0);
      typingDot3.setValue(0);
    }

    return () => animationRef?.stop();
  }, [isAiLoading, isStreaming, thinkingOpacity, thinkingScale, typingDot1, typingDot2, typingDot3]);

  // Modal animation and keyboard dismiss
  useEffect(() => {
    if (showConfirmModal) {
      Keyboard.dismiss();

      Animated.parallel([
        Animated.spring(modalScale, { toValue: 1, friction: 10, tension: 80, useNativeDriver: true }),
        Animated.timing(modalOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      modalScale.setValue(0.8);
      modalOpacity.setValue(0);
    }
  }, [showConfirmModal, modalScale, modalOpacity]);

  // Cleanup streaming interval on unmount
  useEffect(() => {
    return () => {
      if (streamingIntervalRef.current) {
        clearTimeout(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }
    };
  }, []);

  const updateIsAtBottom = useCallback(() => {
    const { y, contentH, layoutH } = scrollStateRef.current;
    const distanceFromBottom = contentH - (y + layoutH);
    const isAtBottom = distanceFromBottom < BOTTOM_THRESHOLD_PX;
    isAtBottomRef.current = isAtBottom;
    setShowScrollButton(!isAtBottom && messages.length > 3);
  }, [messages.length]);

  // Streaming
  const simulateStreaming = useCallback(
    (fullText: string, onComplete: () => void) => {
      if (streamingIntervalRef.current) {
        clearTimeout(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }

      setIsStreaming(true);
      setStreamingMessage('');

      let currentIndex = 0;
      const chunkSize = 10;
      const delay = 18;

      let scrollCounter = 0;

      const tick = () => {
        if (currentIndex < fullText.length) {
          const nextChunk = fullText.slice(currentIndex, currentIndex + chunkSize);
          currentIndex += chunkSize;

          setStreamingMessage(prev => prev + nextChunk);

          scrollCounter++;
          if (scrollCounter % 3 === 0 && isAtBottomRef.current) {
            requestAnimationFrame(() => scrollToBottom(false));
          }

          streamingIntervalRef.current = setTimeout(tick, delay);
          return;
        }

        // done
        if (streamingIntervalRef.current) {
          clearTimeout(streamingIntervalRef.current);
          streamingIntervalRef.current = null;
        }

        setIsStreaming(false);

        if (isAtBottomRef.current) {
          requestAnimationFrame(() => scrollToBottom(true));
        }

        onComplete();
      };

      streamingIntervalRef.current = setTimeout(tick, delay);
    },
    [scrollToBottom],
  );

  // AI Processing
  const processAIRequest = useCallback(
    async (userContent: string, isAutoFix: boolean = false): Promise<void> => {
      setIsAiLoading(true);
      setError(null);

      try {
        // ✅ Kritisch: keine leeren Chat-Messages an LLM schicken (Anthropic meckert sonst)
        const historyAsLlm: LlmMessage[] = messages
          .filter(m => String(m.content ?? '').trim().length > 0)
          .map(m => ({ role: m.role, content: m.content }));

        const llmMessages = buildBuilderMessages(historyAsLlm, userContent, projectFiles);

        let ai = await runOrchestrator(
          config.selectedChatProvider,
          config.selectedChatMode,
          config.qualityMode,
          llmMessages,
        );

        // Wenn Provider kurz zickt (Rate Limit / Overload), einmal "soft" neu versuchen.
        if (!ai?.ok) {
          const errText = String((ai as any)?.error ?? '');
          const shouldRetry =
            /\b429\b|\brate\s*limit\b|\b503\b|overloaded|timeout|timed\s*out|ECONNRESET|network/i.test(errText);
          if (shouldRetry) {
            ai = await runOrchestrator(
              config.selectedChatProvider,
              config.selectedChatMode,
              config.qualityMode,
              llmMessages,
            );
          }
        }

        if (!ai || !ai.ok) {
          const details =
            (ai as any)?.error || (ai as any)?.errors?.join?.('\n') || 'Kein ok=true (unbekannter Fehler).';
          throw new Error(`KI-Request fehlgeschlagen: ${details}`);
        }

        if (!(ai as any).text && !(ai as any).files) {
          throw new Error('Die KI-Antwort war leer oder ohne Dateien.');
        }

        const rawForNormalizer =
          (ai as any).files && Array.isArray((ai as any).files)
            ? (ai as any).files
            : (ai as any).text
              ? (ai as any).text
              : (ai as any).raw;

        let normalized = normalizeAiResponse(rawForNormalizer);

        // Fallback: wenn das Modell Text liefert der NICHT sauber JSON ist,
        // versuchen wir einmal, das Modell selbst in "JSON-only" zu reparieren.
        if (!normalized && typeof (ai as any).text === 'string' && (ai as any).text.trim().length > 0) {
          const uniquePaths = Array.from(
            new Set(projectFiles.map(f => String(f.path || '').trim()).filter(Boolean)),
          ).sort();

          const listHint = uniquePaths.length
            ? `Erlaubte Pfade (nur aus dieser Liste verwenden, keine erfinden):\n${uniquePaths.map(p => '- ' + p).join('\n')}`
            : 'Es existieren aktuell keine Projektdateien.';

          const rawText = String((ai as any).text);
          const clipped = rawText.length > 40000 ? rawText.slice(0, 40000) + '\n\n... (gekürzt)' : rawText;

          const repairMessages: LlmMessage[] = [
            {
              role: 'system',
              content:
                'Du bist ein strenger JSON-Reparatur-Worker. ' +
                'Du bekommst eine fehlerhafte/unsichere KI-Ausgabe und MUSST daraus ein valides JSON-Array machen.\n\n' +
                'Output-Regel: Antworte ausschließlich mit einem JSON-Array im Format: ' +
                '[{ "path": "...", "content": "..." }, ...]. Kein Text davor/dahinter.\n' +
                'Wenn du keine Dateien erkennen kannst, gib [] zurück.\n' +
                'WICHTIG: Erfinde keine neuen Pfade oder Inhalte. Nutze nur, was im RAW-Text steht.\n\n' +
                listHint,
            },
            {
              role: 'user',
              content: `User-Aufgabe: ${userContent}\n\nRAW-KI-Ausgabe (zu reparieren):\n${clipped}`,
            },
          ];

          const repaired = await runOrchestrator(
            config.selectedChatProvider,
            config.selectedChatMode,
            'speed',
            repairMessages,
          );

          if (repaired?.ok && typeof repaired.text === 'string') {
            normalized = normalizeAiResponse(repaired.text);
          }
        }

        if (!normalized) {
          const preview =
            typeof (ai as any).text === 'string'
              ? String((ai as any).text).slice(0, 600).replace(/\s+/g, ' ')
              : '';
          throw new Error(
            'Normalizer/Validator konnte die Dateien nicht verarbeiten.' + (preview ? `\n\nOutput-Preview: ${preview}` : ''),
          );
        }

        // Optional: 2. Pass (Agent) zur Validierung/Verbesserung
        let finalFiles = normalized;
        let agentMeta: any = null;

        if ((config as any)?.agentEnabled) {
          try {
            const validatorMsgs = buildValidatorMessages(
              userContent,
              normalized.map(f => ({ path: f.path, content: f.content })),
              projectFiles,
            );

            const agentRes = await runOrchestrator(
              (config as any)?.selectedAgentProvider ?? config.selectedChatProvider,
              (config as any)?.selectedAgentMode ?? config.selectedChatMode,
              'quality',
              validatorMsgs,
            );

            if (agentRes && agentRes.ok) {
              const agentRaw =
                (agentRes as any).files && Array.isArray((agentRes as any).files)
                  ? (agentRes as any).files
                  : agentRes.text
                    ? agentRes.text
                    : (agentRes as any).raw;

              const normalizedAgent = normalizeAiResponse(agentRaw);
              if (normalizedAgent && normalizedAgent.length > 0) {
                finalFiles = normalizedAgent;
                agentMeta = agentRes;
              }
            }
          } catch {
            // Agent darf den Haupt-Flow nicht killen
          }
        }

        const mergeResult = applyFilesToProject(projectFiles, finalFiles);

        const prefix = isAutoFix ? '🤖 **Auto-Fix Vorschlag:**' : '🤖 Die KI möchte folgende Änderungen vornehmen:';

        const summaryText =
          `${prefix}\n\n` +
          `📝 **Neue Dateien** (${mergeResult.created.length}):\n` +
          (mergeResult.created.length > 0
            ? mergeResult.created
                .slice(0, 5)
                .map(f => `  • ${f}`)
                .join('\n') +
              (mergeResult.created.length > 5 ? `\n  ... und ${mergeResult.created.length - 5} weitere` : '')
            : '  (keine)') +
          `\n\n` +
          `📝 **Geänderte Dateien** (${mergeResult.updated.length}):\n` +
          (mergeResult.updated.length > 0
            ? mergeResult.updated
                .slice(0, 5)
                .map(f => `  • ${f}`)
                .join('\n') +
              (mergeResult.updated.length > 5 ? `\n  ... und ${mergeResult.updated.length - 5} weitere` : '')
            : '  (keine)') +
          (!isAutoFix
            ? `\n\n` +
              `⏭ **Übersprungen** (${mergeResult.skipped.length}):\n` +
              (mergeResult.skipped.length > 0
                ? mergeResult.skipped
                    .slice(0, 3)
                    .map(f => `  • ${f}`)
                    .join('\n') + (mergeResult.skipped.length > 3 ? `\n  ... und ${mergeResult.skipped.length - 3} weitere` : '')
                : '  (keine)')
            : '') +
          `\n\nMöchtest du diese Änderungen übernehmen?`;

        // ✅ Streaming nur im UI-Footer. Wenn fertig: echte Message speichern.
        simulateStreaming(summaryText, () => {
          addChatMessage({
            id: uuidv4(),
            role: 'assistant',
            content: summaryText,
            timestamp: new Date().toISOString(),
          });

          setPendingChange({
            files: mergeResult.files,
            summary: summaryText,
            created: mergeResult.created,
            updated: mergeResult.updated,
            skipped: mergeResult.skipped,
            aiResponse: ai,
            agentResponse: agentMeta ?? undefined,
          });

          setShowConfirmModal(true);
        });
      } catch (e: any) {
        const msg = `⚠️ ${e?.message || 'Es ist ein Fehler im Builder-Flow aufgetreten.'}`;
        setError(msg);

        addChatMessage({
          id: uuidv4(),
          role: 'assistant',
          content: msg,
          timestamp: new Date().toISOString(),
          meta: { error: true },
        });
      } finally {
        setIsAiLoading(false);
      }
    },
    [messages, projectFiles, config, addChatMessage, simulateStreaming],
  );

  // Auto-Fix Handler
  useEffect(() => {
    if (autoFixRequest && !isAiLoading && !isStreaming) {
      const processAutoFix = async () => {
        const userMessage: ChatMessage = {
          id: uuidv4(),
          role: 'user',
          content: autoFixRequest.message,
          timestamp: new Date().toISOString(),
          meta: { autoFix: true },
        };

        addChatMessage(userMessage);
        clearAutoFixRequest();

        await processAIRequest(autoFixRequest.message, true);
      };

      processAutoFix();
    }
  }, [autoFixRequest, isAiLoading, isStreaming, clearAutoFixRequest, addChatMessage, processAIRequest]);

  // Document picker
  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const sizeKB = asset.size ? (asset.size / 1024).toFixed(2) : '?';

        setSelectedFileAsset(asset);

        if (asset.size && asset.size > 100000) {
          Alert.alert(
            '📎 Große Datei ausgewählt',
            `${asset.name} (${sizeKB} KB)\n\nHinweis: Große Dateien können die Verarbeitung verlangsamen.`,
          );
        }
      } else {
        setSelectedFileAsset(null);
      }
    } catch (e: any) {
      Alert.alert('Fehler', e?.message || 'Dateiauswahl fehlgeschlagen');
      setSelectedFileAsset(null);
    }
  }, []);

  // Apply changes
  const applyChanges = useCallback(async () => {
    if (!pendingChange) return;

    setShowConfirmModal(false);

    try {
      await updateProjectFiles(pendingChange.files);

      const timing =
        pendingChange.aiResponse.timing && pendingChange.aiResponse.timing.durationMs
          ? ` (${(pendingChange.aiResponse.timing.durationMs / 1000).toFixed(1)}s)`
          : '';

      const confirmationText =
        `✅ Änderungen erfolgreich angewendet${timing}\n\n` +
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
        meta: { provider: pendingChange.aiResponse.provider },
      });
    } catch (e: any) {
      Alert.alert('Fehler beim Anwenden', e?.message || 'Änderungen konnten nicht angewendet werden. Bitte versuche es erneut.');

      addChatMessage({
        id: uuidv4(),
        role: 'system',
        content: `⚠️ Fehler beim Anwenden der Änderungen: ${e?.message || 'Unbekannt'}`,
        timestamp: new Date().toISOString(),
        meta: { error: true },
      });
    } finally {
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

  // Send handler
  const handleSend = useCallback(async () => {
    if (!textInput.trim() && !selectedFileAsset) return;
    if (isAiLoading || isStreaming) return;

    Animated.sequence([
      Animated.timing(sendButtonScale, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.spring(sendButtonScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();

    setError(null);

    const userContent = textInput.trim() || (selectedFileAsset ? `Datei gesendet: ${selectedFileAsset.name}` : '');

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: userContent,
      timestamp: new Date().toISOString(),
    };

    addChatMessage(userMessage);

    const currentInput = textInput;
    setTextInput('');
    setSelectedFileAsset(null);

    Keyboard.dismiss();

    const metaResult = handleMetaCommand(currentInput.trim(), projectFiles);
    if (metaResult.handled && metaResult.message) {
      addChatMessage(metaResult.message);
      return;
    }

    await processAIRequest(userContent, false);
  }, [
    textInput,
    selectedFileAsset,
    projectFiles,
    isAiLoading,
    isStreaming,
    addChatMessage,
    processAIRequest,
    sendButtonScale,
  ]);

  // Scroll tracking
  const handleScroll = useCallback(
    (event: any) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

      scrollStateRef.current = {
        y: contentOffset.y,
        contentH: contentSize.height,
        layoutH: layoutMeasurement.height,
      };

      updateIsAtBottom();
    },
    [updateIsAtBottom],
  );

  const scrollButtonPress = useCallback(() => {
    scrollToBottom(true);
    setShowScrollButton(false);
  }, [scrollToBottom]);

  const renderItem = useCallback(({ item }: { item: ChatMessage }) => {
    return <MessageItem message={item} />;
  }, []);

  const renderFooter = useCallback(() => {
    // Footer enthält Streaming-Bubble + optionalen "denkt nach" Indikator
    if (!combinedIsLoading && !isStreaming) return null;

    return (
      <View>
        {isStreaming && (
          <View style={styles.messageWrapper}>
            <View style={[styles.messageBubble, styles.assistantBubble]}>
              <Text style={styles.assistantText}>{streamingMessage}</Text>

              <View style={styles.typingIndicator}>
                <Animated.View
                  style={[
                    styles.typingDot,
                    {
                      opacity: typingDot1.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                      transform: [{ translateY: typingDot1.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.typingDot,
                    {
                      opacity: typingDot2.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                      transform: [{ translateY: typingDot2.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.typingDot,
                    {
                      opacity: typingDot3.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                      transform: [{ translateY: typingDot3.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        )}

        {combinedIsLoading && (
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
                  { opacity: typingDot1.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                ]}
              />
              <Animated.View
                style={[
                  styles.thinkingDot,
                  { opacity: typingDot2.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                ]}
              />
              <Animated.View
                style={[
                  styles.thinkingDot,
                  { opacity: typingDot3.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                ]}
              />
            </View>
          </Animated.View>
        )}
      </View>
    );
  }, [
    combinedIsLoading,
    isStreaming,
    streamingMessage,
    thinkingOpacity,
    thinkingScale,
    typingDot1,
    typingDot2,
    typingDot3,
  ]);

  return (
    // IMPORTANT: KEIN bottom-edge -> verhindert SafeArea-Gap über der Tabbar
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View
            style={styles.listContainer}
            onLayout={e => {
              scrollStateRef.current.layoutH = e.nativeEvent.layout.height;
              updateIsAtBottom();
            }}
          >
            {combinedIsLoading && messages.length === 0 ? (
              <View style={styles.loadingOverlay}>
                <Animated.View style={{ opacity: thinkingOpacity, transform: [{ scale: thinkingScale }] }}>
                  <ActivityIndicator size="large" color={theme.palette.primary} />
                  <Text style={styles.loadingOverlayText}>🧠 Projekt und Chat werden geladen...</Text>
                </Animated.View>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
                ListFooterComponent={renderFooter}
                // ✅ Fix für "Chat wird zwischendurch leer": removeClippedSubviews aus
                removeClippedSubviews={false}
                maxToRenderPerBatch={12}
                windowSize={12}
                initialNumToRender={12}
                updateCellsBatchingPeriod={50}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={(_w, h) => {
                  scrollStateRef.current.contentH = h;
                  updateIsAtBottom();
                  if (isAtBottomRef.current) scrollToBottom(false);
                }}
              />
            )}
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={16} color={theme.palette.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {showScrollButton && (
            <TouchableOpacity
              style={[styles.scrollToBottomButton, { bottom: scrollBtnBottom }]}
              onPress={scrollButtonPress}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-down" size={20} color={theme.palette.background} />
            </TouchableOpacity>
          )}

          {/* Bottom-Bereich absolut, und bei Keyboard um keyboardOffsetInScreen anheben */}
          <View style={[styles.bottomArea, { bottom: keyboardOffsetInScreen }]}>
            {selectedFileAsset && (
              <View style={styles.selectedFileBox}>
                <Ionicons name="document" size={16} color={theme.palette.primary} />
                <Text style={styles.selectedFileText} numberOfLines={1}>
                  {selectedFileAsset.name}
                </Text>
                <TouchableOpacity onPress={() => setSelectedFileAsset(null)}>
                  <Ionicons name="close-circle" size={20} color={theme.palette.text.secondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* !!! Eingabefeld/Styles/Keyboard-Offset bleiben unverändert !!! */}
            <View style={styles.inputContainer}>
              <TouchableOpacity
                style={[styles.iconButton, selectedFileAsset && styles.iconButtonActive]}
                onPress={handlePickDocument}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="attach-outline"
                  size={22}
                  color={selectedFileAsset ? theme.palette.primary : theme.palette.text.secondary}
                />
              </TouchableOpacity>

              <TextInput
                ref={inputRef}
                style={styles.textInput}
                placeholder="Beschreibe deine App oder den nächsten Schritt ..."
                placeholderTextColor={theme.palette.text.secondary}
                value={textInput}
                onChangeText={setTextInput}
                onSubmitEditing={(e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
                  if (e.nativeEvent?.text?.trim()) handleSend();
                }}
                blurOnSubmit={false}
                multiline
                maxLength={2000}
              />

              <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
                <TouchableOpacity
                  style={[styles.sendButton, combinedIsLoading && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={combinedIsLoading}
                  activeOpacity={0.8}
                >
                  {combinedIsLoading ? (
                    <ActivityIndicator size="small" color={theme.palette.background} />
                  ) : (
                    <Ionicons name="send" size={20} color={theme.palette.background} />
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          {/* Bestätigungsmodal */}
          <Modal
            visible={showConfirmModal}
            transparent={true}
            animationType="none"
            onRequestClose={rejectChanges}
          >
            <Animated.View style={[styles.modalOverlay, { opacity: modalOpacity }]}>
              <Animated.View style={[styles.modalContent, { transform: [{ scale: modalScale }], opacity: modalOpacity }]}>
                <View style={styles.modalHeader}>
                  <Ionicons name="code-slash" size={28} color={theme.palette.primary} />
                  <Text style={styles.modalTitle}>Änderungen bestätigen</Text>
                </View>

                <View style={styles.modalBody}>
                  <Text style={styles.modalText}>{pendingChange?.summary}</Text>
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
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
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

  bottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: theme.palette.card,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
  },

  selectedFileBox: {
    height: SELECTED_FILE_ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  selectedFileText: {
    flex: 1,
    fontSize: 13,
    color: theme.palette.text.primary,
    fontWeight: '500',
  },

  inputContainer: {
    minHeight: INPUT_BAR_MIN_H,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
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

  scrollToBottomButton: {
    position: 'absolute',
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default ChatScreen;
