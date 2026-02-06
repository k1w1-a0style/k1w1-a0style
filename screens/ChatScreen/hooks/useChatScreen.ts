import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  InteractionManager,
  Keyboard,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useProject } from "../../../contexts/ProjectContext";
import { ChatMessage, ProjectFile } from "../../../contexts/types";
import { useAI } from "../../../contexts/AIContext";

import { useKeyboardHeight } from "../../../hooks/useKeyboardHeight";
import { useChatAIFlow } from "../../../hooks/useChatAIFlow";

type DocumentResultAsset = NonNullable<
  import("expo-document-picker").DocumentPickerResult["assets"]
>[0];

const INPUT_BAR_MIN_H = 56;

// ✅ Mini-Fix Android: Composer 1–2px näher an die Tastatur (wenn offen)
const KEYBOARD_NUDGE = 4;

const FOOTER_LIFT_WHEN_BUSY = 72;

export const useChatScreen = () => {
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

  const [textInput, setTextInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileAsset, setSelectedFileAsset] =
    useState<DocumentResultAsset | null>(null);

  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const didInitialScrollRef = useRef(false);

  // ✅ neu: echte Composer-Höhe (damit Bilder nicht hinterm Eingabefeld verschwinden)
  const [composerHeight, setComposerHeight] = useState<number>(INPUT_BAR_MIN_H);

  // Keyboard (Offset bleibt 1:1)
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

  // ✅ statt Konstanten: echte Composer-Höhe nutzen
  const bottomBarVisualH = Math.max(INPUT_BAR_MIN_H, composerHeight);

  const listBottomPadding =
    bottomBarVisualH + keyboardOffsetInScreen + 14 + busyLift;
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
    } catch (e: any) {
      Alert.alert("Fehler", e?.message || "Dateiauswahl fehlgeschlagen");
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

  const handleScroll = useCallback(
    (event: any) => {
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
    setTimeout(() => hardScrollToBottom(true), 160);
    setShowScrollButton(false);
  }, [hardScrollToBottom, setAtBottom]);

  const handleContentSizeChange = useCallback(() => {
    if (!didInitialScrollRef.current && messages.length > 0) {
      didInitialScrollRef.current = true;
      setAtBottom(true);
      hardScrollToBottom(false);
      setTimeout(() => hardScrollToBottom(false), 160);
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
