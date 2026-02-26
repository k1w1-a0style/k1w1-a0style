import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  InteractionManager,
  Keyboard,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useProject } from "../../../contexts/ProjectContext";
import type { ChatMessage } from "../../../shared/types/chat";
import type { ProjectFile } from "../../../shared/types/project";
import { useAI } from "../../../contexts/AIContext";

import { useKeyboardHeight } from "../../../hooks/useKeyboardHeight";
import { useChatAIFlow } from "../../../hooks/useChatAIFlow";

type DocumentResultAsset = NonNullable<
  import("expo-document-picker").DocumentPickerResult["assets"]
>[0];

const INPUT_BAR_MIN_H = 56;

// Composer 1–2px näher an die Tastatur (wenn offen)
const KEYBOARD_NUDGE = 2;

const FOOTER_LIFT_WHEN_BUSY = 72;

export const useChatScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
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

  // ✅ FIX #17/#18: Removed .unref() — it doesn't exist in React Native runtime.
  // Track short-lived timers so cleanup can clear them on unmount.
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
      if (scrollRetryRef.current) {
        clearTimeout(scrollRetryRef.current);
        scrollRetryRef.current = null;
      }
    };
  }, []);

  const [textInput, setTextInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileAsset, setSelectedFileAsset] =
    useState<DocumentResultAsset | null>(null);

  // Allow other screens to prefill the composer (e.g. Diagnostic -> Debug)
  useFocusEffect(
    useCallback(() => {
      const prefill = route?.params?.prefillText;
      if (typeof prefill === "string" && prefill.trim()) {
        setTextInput((prev) => (prev ? prev : prefill));
        try {
          navigation.setParams({ prefillText: undefined });
        } catch {
          // ignore
        }
      }
      return () => {};
    }, [navigation, route?.params?.prefillText]),
  );

  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const didInitialScrollRef = useRef(false);

  // Echte Composer-Höhe (damit Inhalte nicht hinterm Eingabefeld verschwinden)
  const [composerHeight, setComposerHeight] = useState<number>(INPUT_BAR_MIN_H);

  // Keyboard
  const keyboardHeight = useKeyboardHeight();

  // Animations
  const thinkingOpacity = useRef(new Animated.Value(0)).current;
  const thinkingScale = useRef(new Animated.Value(0.8)).current;
  const typingDot1 = useRef(new Animated.Value(0)).current;
  const typingDot2 = useRef(new Animated.Value(0)).current;
  const typingDot3 = useRef(new Animated.Value(0)).current;
  const sendButtonScale = useRef(new Animated.Value(1)).current;

  const combinedIsLoading = isProjectLoading || isAiLoading;
  const projectFiles: ProjectFile[] = projectData?.files ?? [];

  const keyboardOffsetInScreen =
    keyboardHeight > 0
      ? Math.max(0, keyboardHeight - insets.bottom - KEYBOARD_NUDGE)
      : 0;

  const busyLift = combinedIsLoading || isStreaming ? FOOTER_LIFT_WHEN_BUSY : 0;

  const bottomBarVisualH = Math.max(INPUT_BAR_MIN_H, composerHeight);

  const listBottomPadding =
    bottomBarVisualH + keyboardOffsetInScreen + 14 + busyLift;
  const scrollBtnBottom = bottomBarVisualH + keyboardOffsetInScreen + 14;

  // ✅ FIX #5: Debounced scroll-to-bottom to prevent 10+ calls in 300ms
  // Single retry if first scroll didn't reach bottom (layout not yet final)
  const scrollPendingRef = useRef(false);
  const scrollAnimatedRef = useRef(false);

  const hardScrollToBottom = useCallback((animated: boolean) => {
    if (animated) scrollAnimatedRef.current = true;

    if (scrollPendingRef.current) return;
    scrollPendingRef.current = true;

    // Clear any pending retry from a previous call
    if (scrollRetryRef.current) {
      clearTimeout(scrollRetryRef.current);
      scrollRetryRef.current = null;
    }

    requestAnimationFrame(() => {
      const shouldAnimate = scrollAnimatedRef.current;
      scrollPendingRef.current = false;
      scrollAnimatedRef.current = false;

      try {
        flatListRef.current?.scrollToEnd({ animated: shouldAnimate });
      } catch {
        // FlatList may throw if not yet mounted
      }

      // One retry after 150ms — covers cases where the list layout
      // wasn't final yet when the first scrollToEnd fired.
      // Always retries once; scrollToEnd at bottom is a no-op.
      scrollRetryRef.current = setTimeout(() => {
        scrollRetryRef.current = null;
        try {
          // Retry without animation to avoid a visible double-scroll.
          flatListRef.current?.scrollToEnd({ animated: false });
        } catch {
          // FlatList may throw if not yet mounted / measured.
        }
      }, 150);
    });
  }, []);

  const {
    pendingPlan,
    pendingChange,
    isAtBottomRef,
    setAtBottom,
    handleSendWithMeta,
    applyChanges,
    rejectChanges,
  } = useChatAIFlow({
    config,
    messages,
    projectFiles,
    addChatMessage,
    updateProjectFiles,
    autoFixRequest,
    clearAutoFixRequest,
    hardScrollToBottom,
    setIsStreaming,
    setStreamingMessage,
    setIsAiLoading,
    setError,
    setShowConfirmModal,
  });

  useFocusEffect(
    useCallback(() => {
      didInitialScrollRef.current = false;
      const task = InteractionManager.runAfterInteractions(() => {
        hardScrollToBottom(false);
      });
      // Single follow-up instead of two separate timers
      const t1 = setTimeout(() => hardScrollToBottom(false), 200);
      return () => {
        task?.cancel?.();
        clearTimeout(t1);
      };
    }, [hardScrollToBottom]),
  );

  useEffect(() => {
    if (messages.length > 0 && isAtBottomRef.current) {
      const timer = setTimeout(() => hardScrollToBottom(true), 40);
      return () => clearTimeout(timer);
    }
  }, [messages, hardScrollToBottom, isAtBottomRef]);

  useEffect(() => {
    let animationRef: Animated.CompositeAnimation | null = null;

    if (isAiLoading || isStreaming) {
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

      animationRef = Animated.loop(
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
        ]),
      );
      animationRef.start();
    } else {
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
      typingDot1.setValue(0);
      typingDot2.setValue(0);
      typingDot3.setValue(0);
    }

    return () => animationRef?.stop();
  }, [
    isAiLoading,
    isStreaming,
    thinkingOpacity,
    thinkingScale,
    typingDot1,
    typingDot2,
    typingDot3,
  ]);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const sizeKB = asset.size ? (asset.size / 1024).toFixed(2) : "?";
        setSelectedFileAsset(asset);

        if (asset.size && asset.size > 100000) {
          Alert.alert(
            "📎 Große Datei ausgewählt",
            `${asset.name} (${sizeKB} KB)\n\nHinweis: Große Dateien können die Verarbeitung verlangsamen.`,
          );
        }
      } else {
        setSelectedFileAsset(null);
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      Alert.alert("Fehler", error.message || "Dateiauswahl fehlgeschlagen");
      setSelectedFileAsset(null);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!textInput.trim() && !selectedFileAsset) return;
    if (isAiLoading || isStreaming) return;

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

    const currentInput = textInput;
    const fileName = selectedFileAsset?.name;

    setTextInput("");
    setSelectedFileAsset(null);

    Keyboard.dismiss();

    await handleSendWithMeta(currentInput, fileName);
  }, [
    textInput,
    selectedFileAsset,
    isAiLoading,
    isStreaming,
    sendButtonScale,
    handleSendWithMeta,
  ]);

  // ✅ FIX #11: Properly typed scroll handler
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      const isAtBottom = distanceFromBottom < 60;

      setAtBottom(isAtBottom);
      setShowScrollButton(!isAtBottom && messages.length > 3);
    },
    [messages.length, setAtBottom],
  );

  const scrollButtonPress = useCallback(() => {
    setAtBottom(true);
    hardScrollToBottom(true);
    setShowScrollButton(false);
  }, [hardScrollToBottom, setAtBottom]);

  const handleContentSizeChange = useCallback(() => {
    if (!didInitialScrollRef.current && messages.length > 0) {
      didInitialScrollRef.current = true;
      setAtBottom(true);
      hardScrollToBottom(false);
      return;
    }
    if (isAtBottomRef.current) hardScrollToBottom(false);
  }, [hardScrollToBottom, isAtBottomRef, messages.length, setAtBottom]);

  return {
    insets,
    messages,
    flatListRef,

    textInput,
    setTextInput,
    selectedFileAsset,
    setSelectedFileAsset,

    isStreaming,
    streamingMessage,

    showConfirmModal,
    pendingPlan,
    pendingChange,
    applyChanges,
    rejectChanges,

    showScrollButton,
    error,

    combinedIsLoading,
    keyboardOffsetInScreen,
    listBottomPadding,
    scrollBtnBottom,

    thinkingOpacity,
    thinkingScale,
    typingDot1,
    typingDot2,
    typingDot3,
    sendButtonScale,

    handlePickDocument,
    handleSend,
    handleScroll,
    scrollButtonPress,
    handleContentSizeChange,

    didInitialScrollRef,
    isAtBottomRef,
    setAtBottom,

    setComposerHeight,
  };
};
