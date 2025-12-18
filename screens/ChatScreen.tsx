// screens/ChatScreen.tsx — Builder mit Bestätigung & Streaming
// FIXES:
// 1) Chat startet zuverlässig unten (Initial-AutoScroll, auch bei Virtualization)
// 2) Scroll-Pfeil: 1x drücken -> wirklich ganz runter (scrollToEnd + retry)
// 3) 2-Call Flow: Planner (Fragen/Plan) -> erst nach deiner Antwort Builder
// 4) Extra: Vor dem Bestätigen gibt’s eine kurze Erklärung "warum/was" (kleiner Explain-Call)
// 5) ✅ LIST FIX: contentContainer füllt die Höhe, Messages kleben unten (flexGrow + justifyContent)

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
  InteractionManager,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';
import { ChatMessage, ProjectFile } from '../contexts/types';
import MessageItem from '../components/MessageItem';
import { runOrchestrator } from '../lib/orchestrator';
import { normalizeAiResponse } from '../lib/normalizer';
import { applyFilesToProject } from '../lib/fileWriter';
import { buildBuilderMessages, buildPlannerMessages, buildValidatorMessages, LlmMessage } from '../lib/promptEngine';
import { useAI } from '../contexts/AIContext';
import { handleMetaCommand } from '../utils/metaCommands';
import { v4 as uuidv4 } from 'uuid';

type DocumentResultAsset = NonNullable<import('expo-document-picker').DocumentPickerResult['assets']>[0];

type PendingChange = {
  files: ProjectFile[];
  summary: string;
  created: string[];
  updated: string[];
  skipped: string[];
  aiResponse: any;
  agentResponse?: any;
};

type PendingPlan = {
  originalRequest: string;
  planText: string;
  mode: 'advice' | 'build';
};

const INPUT_BAR_MIN_H = 56;
const SELECTED_FILE_ROW_H = 42;
const KEYBOARD_NUDGE = 2;
const FOOTER_LIFT_WHEN_BUSY = 72;

// ---- Heuristiken ----
const looksLikeExplicitFileTask = (s: string) => {
  return (
    /\b[\w.-]+\/[\w./-]+\.(tsx?|jsx?|ts|js|json|md|yml|yaml|sh|css)\b/i.test(s) ||
    /\bin datei\b/i.test(s) ||
    /\b(package\.json|tsconfig\.json|app\.json|app\.config\.js|eas\.json|metro\.config\.js)\b/i.test(s)
  );
};

const looksLikeAdviceRequest = (s: string) => {
  const t = String(s || '').trim();
  if (!t) return false;
  return /\b(vorschlag|vorschläge|ideen|review|analyse|bewerte|feedback|verbesserungsvorschläge)\b/i.test(t);
};

const looksAmbiguousBuilderRequest = (s: string) => {
  const t = String(s || '').trim();
  if (!t) return false;

  const genericVerb =
    /\b(baue|bauen|erstelle|erstellen|mach|mache|implementiere|füge hinzu|erweitere|optimiere|korrigiere|fix|repariere|prüfe|checke|verbessere)\b/i.test(
      t,
    );

  if (looksLikeAdviceRequest(t)) return true;
  if (!genericVerb) return false;
  if (looksLikeExplicitFileTask(t)) return false;

  const wc = t.split(/\s+/).filter(Boolean).length;
  if (wc <= 12) return true;
  if (/\b(alles|komplett|gesamt|überall)\b/i.test(t)) return true;

  const hasConcreteNouns =
    /\b(playlist|id3|download|login|auth|api|cache|offline|sync|player|ui|screen|settings|github|terminal|orchestrator|prompt|normalizer)\b/i.test(
      t,
    );

  return !hasConcreteNouns;
};

// ---- Explain helper ----
const buildChangeDigest = (projectFiles: ProjectFile[], finalFiles: ProjectFile[], created: string[], updated: string[]) => {
  const oldMap = new Map(projectFiles.map((f) => [f.path, String(f.content ?? '')]));
  const newMap = new Map(finalFiles.map((f) => [f.path, String(f.content ?? '')]));

  const pick = [
    ...created.map((p) => ({ p, kind: 'NEW' as const })),
    ...updated.map((p) => ({ p, kind: 'UPD' as const })),
  ].slice(0, 8);

  const chunks = pick.map(({ p, kind }) => {
    const oldC = oldMap.get(p) ?? '';
    const newC = newMap.get(p) ?? '';
    const oldLines = oldC ? oldC.split('\n').length : 0;
    const newLines = newC ? newC.split('\n').length : 0;
    const delta = newLines - oldLines;

    const preview = newC.split('\n').slice(0, 14).join('\n');

    return [
      `• ${kind === 'NEW' ? 'NEU' : 'UPDATE'}: ${p}`,
      `  Zeilen: ${oldLines} -> ${newLines} (${delta >= 0 ? '+' : ''}${delta})`,
      `  Preview (Anfang):`,
      preview ? preview : '(leer)',
      '',
    ].join('\n');
  });

  return chunks.join('\n');
};

const buildExplainMessages = (userRequest: string, digest: string): LlmMessage[] => {
  return [
    {
      role: 'system',
      content:
        'Du bist ein kurzer, pragmatischer Code-Reviewer für eine Expo/React-Native Builder-App.\n' +
        'Aufgabe: Erkläre knapp, was sich an den Dateien ändert und warum das zur Nutzeranfrage passt.\n' +
        'Regeln:\n' +
        '- Max 6 Bulletpoints, sehr kurz.\n' +
        '- Wenn sinnvoll: 1 kleines Snippet (max 12 Zeilen) als ```ts``` oder ```tsx```.\n' +
        '- Keine neuen Dateien erfinden. Keine langen Texte. Kein Roman.',
    },
    {
      role: 'user',
      content:
        `Nutzerwunsch:\n${userRequest}\n\n` +
        `Änderungs-Digest (Auszug):\n${digest}\n\n` +
        'Bitte kurz erklären (was/warum).',
    },
  ];
};

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

  // Streaming state
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  // Planner state
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null);

  const isAtBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // ✅ Initial scroll lock
  const didInitialScrollRef = useRef(false);

  // Keyboard height
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Animations
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

  const keyboardOffsetInScreen =
    keyboardHeight > 0 ? Math.max(0, keyboardHeight - insets.bottom - KEYBOARD_NUDGE) : 0;

  const bottomBarVisualH = INPUT_BAR_MIN_H + (selectedFileAsset ? SELECTED_FILE_ROW_H : 0);
  const busyLift = combinedIsLoading || isStreaming ? FOOTER_LIFT_WHEN_BUSY : 0;

  const listBottomPadding = bottomBarVisualH + keyboardOffsetInScreen + 14 + busyLift;
  const scrollBtnBottom = bottomBarVisualH + keyboardOffsetInScreen + 14;

  const hardScrollToBottom = useCallback((animated: boolean) => {
    const doIt = () => {
      try {
        flatListRef.current?.scrollToEnd({ animated });
      } catch {}
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToEnd({ animated });
        } catch {}
      }, 140);
    };
    requestAnimationFrame(doIt);
  }, []);

  useFocusEffect(
    useCallback(() => {
      didInitialScrollRef.current = false;
      const task = InteractionManager.runAfterInteractions(() => {
        hardScrollToBottom(false);
      });
      const t1 = setTimeout(() => hardScrollToBottom(false), 90);
      const t2 = setTimeout(() => hardScrollToBottom(false), 260);
      return () => {
        task?.cancel?.();
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }, [hardScrollToBottom]),
  );

  useEffect(() => {
    if (messages.length > 0 && isAtBottomRef.current) {
      const timer = setTimeout(() => hardScrollToBottom(true), 40);
      return () => clearTimeout(timer);
    }
  }, [messages, hardScrollToBottom]);

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

  useEffect(() => {
    return () => {
      if (streamingIntervalRef.current) {
        clearTimeout(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }
    };
  }, []);

  const simulateStreaming = useCallback(
    (fullText: string, onComplete: () => void) => {
      if (streamingIntervalRef.current) {
        clearTimeout(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }

      setIsStreaming(true);
      setStreamingMessage('');

      let currentIndex = 0;
      const chunkSize = 12;
      const delay = 18;

      const updateStream = () => {
        if (currentIndex < fullText.length) {
          const nextChunk = fullText.slice(currentIndex, currentIndex + chunkSize);
          setStreamingMessage((prev) => prev + nextChunk);
          currentIndex += chunkSize;

          if (isAtBottomRef.current) requestAnimationFrame(() => hardScrollToBottom(false));
          streamingIntervalRef.current = setTimeout(updateStream, delay);
        } else {
          if (streamingIntervalRef.current) {
            clearTimeout(streamingIntervalRef.current);
            streamingIntervalRef.current = null;
          }
          setIsStreaming(false);

          if (isAtBottomRef.current) requestAnimationFrame(() => hardScrollToBottom(true));
          onComplete();
        }
      };

      streamingIntervalRef.current = setTimeout(updateStream, delay);
    },
    [hardScrollToBottom],
  );

  const processAIRequest = useCallback(
    async (userContent: string, isAutoFix: boolean = false, forceBuilder: boolean = false): Promise<void> => {
      setIsAiLoading(true);
      setError(null);

      try {
        const historyAsLlm: LlmMessage[] = messages
          .map((m) => ({ role: m.role, content: m.content }))
          .filter((m) => String(m.content ?? '').trim().length > 0);

        // ✅ CALL 1: Planner
        if (!isAutoFix && !forceBuilder && !pendingPlan) {
          const advice = looksLikeAdviceRequest(userContent);
          const shouldPlanner = advice || (looksAmbiguousBuilderRequest(userContent) && !looksLikeExplicitFileTask(userContent));

          if (shouldPlanner) {
            const plannerMsgs = buildPlannerMessages(historyAsLlm, userContent, projectFiles);

            const planRes = await runOrchestrator(
              config.selectedChatProvider,
              config.selectedChatMode,
              'speed',
              plannerMsgs,
            );

            if (planRes?.ok && typeof planRes.text === 'string' && planRes.text.trim().length > 0) {
              const planText = planRes.text.trim();

              addChatMessage({
                id: uuidv4(),
                role: 'assistant',
                content:
                  '🧩 **Kurz bevor ich Code anfasse:**\n\n' +
                  planText +
                  '\n\n➡️ Antworte kurz auf die Fragen **oder** sag „weiter“, dann starte ich den Build (Call 2).',
                timestamp: new Date().toISOString(),
                meta: { planner: true },
              });

              setPendingPlan({ originalRequest: userContent, planText, mode: advice ? 'advice' : 'build' });
              return;
            }
          }
        }

        // ✅ CALL 2: Builder
        const llmMessages = buildBuilderMessages(historyAsLlm, userContent, projectFiles);

        let ai = await runOrchestrator(
          config.selectedChatProvider,
          config.selectedChatMode,
          config.qualityMode,
          llmMessages,
        );

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
            (ai as any)?.error ||
            (ai as any)?.errors?.join?.('\n') ||
            'Kein ok=true (unbekannter Fehler).';
          throw new Error(`KI-Request fehlgeschlagen: ${details}`);
        }

        const rawForNormalizer =
          (ai as any).files && Array.isArray((ai as any).files)
            ? (ai as any).files
            : (ai as any).text
              ? (ai as any).text
              : (ai as any).raw;

        let normalized = normalizeAiResponse(rawForNormalizer);
        if (!normalized) {
          const preview =
            typeof (ai as any).text === 'string'
              ? String((ai as any).text).slice(0, 600).replace(/\s+/g, ' ')
              : '';
          throw new Error('Normalizer/Validator konnte die Dateien nicht verarbeiten.' + (preview ? `\n\nOutput-Preview: ${preview}` : ''));
        }

        // Optional Agent (Validator)
        let finalFiles = normalized;
        let agentMeta: any = null;

        if ((config as any)?.agentEnabled) {
          try {
            const validatorMsgs = buildValidatorMessages(
              userContent,
              normalized.map((f: any) => ({ path: f.path, content: f.content })),
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
          } catch {}
        }

        const mergeResult = applyFilesToProject(projectFiles, finalFiles);

        // ✅ Explain-Call
        let explainText = '';
        if (!isAutoFix && (mergeResult.created.length + mergeResult.updated.length) > 0) {
          try {
            const digest = buildChangeDigest(projectFiles, mergeResult.files, mergeResult.created, mergeResult.updated);
            const explainMsgs = buildExplainMessages(userContent, digest);
            const explainRes = await runOrchestrator(
              config.selectedChatProvider,
              config.selectedChatMode,
              'speed',
              explainMsgs,
            );
            if (explainRes?.ok && typeof explainRes.text === 'string') explainText = explainRes.text.trim();
          } catch {}
        }

        const prefix = isAutoFix ? '🤖 **Auto-Fix Vorschlag:**' : '🤖 Die KI möchte folgende Änderungen vornehmen:';

        const summaryText =
          `${prefix}\n\n` +
          (explainText ? `🧾 **Kurz erklärt (warum/was):**\n${explainText}\n\n---\n\n` : '') +
          `📝 **Neue Dateien** (${mergeResult.created.length}):\n` +
          (mergeResult.created.length > 0
            ? mergeResult.created.slice(0, 6).map((f: string) => `  • ${f}`).join('\n') +
              (mergeResult.created.length > 6 ? `\n  ... und ${mergeResult.created.length - 6} weitere` : '')
            : '  (keine)') +
          `\n\n` +
          `📝 **Geänderte Dateien** (${mergeResult.updated.length}):\n` +
          (mergeResult.updated.length > 0
            ? mergeResult.updated.slice(0, 6).map((f: string) => `  • ${f}`).join('\n') +
              (mergeResult.updated.length > 6 ? `\n  ... und ${mergeResult.updated.length - 6} weitere` : '')
            : '  (keine)') +
          (!isAutoFix
            ? `\n\n` +
              `⏭ **Übersprungen** (${mergeResult.skipped.length}):\n` +
              (mergeResult.skipped.length > 0
                ? mergeResult.skipped.slice(0, 3).map((f: string) => `  • ${f}`).join('\n') +
                  (mergeResult.skipped.length > 3 ? `\n  ... und ${mergeResult.skipped.length - 3} weitere` : '')
                : '  (keine)')
            : '') +
          `\n\nMöchtest du diese Änderungen übernehmen?`;

        simulateStreaming(summaryText, () => {
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
    [messages, projectFiles, config, addChatMessage, simulateStreaming, pendingPlan, hardScrollToBottom],
  );

  // AutoFix Handler
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

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

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

      requestAnimationFrame(() => hardScrollToBottom(true));
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
  }, [pendingChange, updateProjectFiles, addChatMessage, hardScrollToBottom]);

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
    if (!textInput.trim() && !selectedFileAsset) return;
    if (isAiLoading || isStreaming) return;

    Animated.sequence([
      Animated.timing(sendButtonScale, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.spring(sendButtonScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();

    setError(null);

    const userContent = textInput.trim() || (selectedFileAsset ? `Datei gesendet: ${selectedFileAsset.name}` : '');

    addChatMessage({
      id: uuidv4(),
      role: 'user',
      content: userContent,
      timestamp: new Date().toISOString(),
    });

    const currentInput = textInput;
    setTextInput('');
    setSelectedFileAsset(null);

    Keyboard.dismiss();

    const metaResult = handleMetaCommand(currentInput.trim(), projectFiles);
    if (metaResult.handled && metaResult.message) {
      addChatMessage(metaResult.message);
      return;
    }

    if (pendingPlan) {
      const lower = userContent.trim().toLowerCase();
      const wantsProceed = lower === 'weiter' || lower === 'mach weiter' || lower === 'ok' || lower === 'ja' || lower === 'go';

      if (pendingPlan.mode === 'advice' && !wantsProceed) {
        addChatMessage({
          id: uuidv4(),
          role: 'assistant',
          content: 'Alles klar. Wenn du willst, kann ich das direkt umsetzen – sag einfach **„weiter“** oder nenn die Features, die ich einbauen soll.',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const combined =
        pendingPlan.originalRequest +
        '\n\n---\nPlaner-Ausgabe:\n' +
        pendingPlan.planText +
        '\n\n---\nNutzer-Antwort/Details:\n' +
        (wantsProceed ? '(User sagt: weiter)' : userContent);

      setPendingPlan(null);
      await processAIRequest(combined, false, true);
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
    pendingPlan,
  ]);

  const handleScroll = useCallback(
    (event: any) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      const isAtBottom = distanceFromBottom < 60;

      isAtBottomRef.current = isAtBottom;
      setShowScrollButton(!isAtBottom && messages.length > 3);
    },
    [messages.length],
  );

  const scrollButtonPress = useCallback(() => {
    isAtBottomRef.current = true;
    hardScrollToBottom(true);
    setTimeout(() => hardScrollToBottom(true), 160);
    setShowScrollButton(false);
  }, [hardScrollToBottom]);

  const renderItem = useCallback(({ item }: { item: ChatMessage; index: number }) => {
    return <MessageItem message={item} />;
  }, []);

  const renderFooter = useCallback(() => {
    if (!combinedIsLoading && !isStreaming) return null;

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
        <View style={{ flex: 1 }}>
          {isStreaming ? (
            <>
              <Text style={styles.loadingText}>🤖 KI schreibt…</Text>
              <Text style={styles.streamingText}>{streamingMessage}</Text>
            </>
          ) : (
            <Text style={styles.loadingText}>🧠 KI denkt nach...</Text>
          )}
        </View>

        <View style={styles.thinkingDots}>
          <Animated.View style={[styles.thinkingDot, { opacity: typingDot1.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]} />
          <Animated.View style={[styles.thinkingDot, { opacity: typingDot2.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]} />
          <Animated.View style={[styles.thinkingDot, { opacity: typingDot3.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]} />
        </View>
      </Animated.View>
    );
  }, [combinedIsLoading, isStreaming, thinkingOpacity, thinkingScale, typingDot1, typingDot2, typingDot3, streamingMessage]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={styles.listContainer}>
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
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
                ListFooterComponent={renderFooter}
                removeClippedSubviews={Platform.OS === 'ios'}
                maxToRenderPerBatch={10}
                windowSize={21}
                initialNumToRender={15}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onScrollBeginDrag={Keyboard.dismiss}
                onContentSizeChange={() => {
                  if (!didInitialScrollRef.current && messages.length > 0) {
                    didInitialScrollRef.current = true;
                    isAtBottomRef.current = true;
                    hardScrollToBottom(false);
                    setTimeout(() => hardScrollToBottom(false), 160);
                    return;
                  }
                  if (isAtBottomRef.current) hardScrollToBottom(false);
                }}
                keyboardShouldPersistTaps="handled"
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
                placeholder={pendingPlan ? 'Antwort auf die Fragen… (oder „weiter“)' : 'Beschreibe deine App oder den nächsten Schritt ...'}
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

          <Modal visible={showConfirmModal} transparent={true} animationType="none" onRequestClose={rejectChanges}>
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
                  <TouchableOpacity style={[styles.modalButton, styles.modalButtonReject]} onPress={rejectChanges} activeOpacity={0.8}>
                    <Ionicons name="close-circle" size={20} color={theme.palette.error} />
                    <Text style={styles.modalButtonTextReject}>Ablehnen</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.modalButton, styles.modalButtonAccept]} onPress={applyChanges} activeOpacity={0.8}>
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
  root: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1 },
  listContainer: { flex: 1 },

  // ✅ WICHTIG: damit wenige Messages unten kleben und Layout nicht “oben hängt”
  listContent: { padding: 12, width: '100%', flexGrow: 1, justifyContent: 'flex-end' },

  loadingOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingOverlayText: { marginTop: 12, color: theme.palette.text.secondary },

  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    marginVertical: 8,
    gap: 8,
  },
  loadingText: { color: theme.palette.text.secondary, fontWeight: '600' },
  streamingText: { marginTop: 6, color: theme.palette.text.primary, fontSize: 14, lineHeight: 20 },

  thinkingDots: { flexDirection: 'row', gap: 4, marginLeft: 4, marginTop: 2 },
  thinkingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.palette.primary },

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
  errorText: { flex: 1, color: theme.palette.error, fontSize: 13 },

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
  selectedFileText: { flex: 1, fontSize: 13, color: theme.palette.text.primary, fontWeight: '500' },

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
  iconButtonActive: { borderColor: theme.palette.secondary },

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
  sendButtonDisabled: { opacity: 0.6 },

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
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.palette.text.primary },
  modalBody: { padding: 20, maxHeight: 420 },
  modalText: { fontSize: 14, color: theme.palette.text.primary, lineHeight: 22 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: theme.palette.border },
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
  modalButtonReject: { backgroundColor: 'transparent', borderColor: theme.palette.error },
  modalButtonAccept: { backgroundColor: theme.palette.primary, borderColor: theme.palette.primary },
  modalButtonTextReject: { fontSize: 14, fontWeight: '600', color: theme.palette.error },
  modalButtonTextAccept: { fontSize: 14, fontWeight: '600', color: '#000' },

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
