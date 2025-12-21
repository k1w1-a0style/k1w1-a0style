// screens/ChatScreen.tsx — Builder mit Bestätigung & Streaming
// FIXES:
// 1) Chat startet zuverlässig unten (Initial-AutoScroll, auch bei Virtualization)
// 2) Scroll-Pfeil: 1x drücken -> wirklich ganz runter (scrollToEnd + retry)
// 3) 2-Call Flow: Planner (Fragen/Plan) -> erst nach deiner Antwort Builder
// 4) Vor dem Bestätigen: kurzer Explain-Call "warum/was"
// 5) LIST FIX: contentContainer füllt die Höhe, Messages kleben unten (flexGrow + justifyContent)

import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  View,
  FlatList,
  Alert,
  Animated,
  Easing,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
  InteractionManager,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import { useProject } from "../contexts/ProjectContext";
import { ChatMessage, ProjectFile } from "../contexts/types";
import MessageItem from "../components/MessageItem";
import { useAI } from "../contexts/AIContext";

import ConfirmChangesModal from "../components/chat/ConfirmChangesModal";
import ChatComposer from "../components/chat/ChatComposer";
import ChatLoadingOverlay from "../components/chat/ChatLoadingOverlay";
import ChatLoadingFooter from "../components/chat/ChatLoadingFooter";
import ChatErrorBanner from "../components/chat/ChatErrorBanner";
import ChatScrollToBottomButton from "../components/chat/ChatScrollToBottomButton";

import { styles } from "../styles/chatScreenStyles";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import { useChatAIFlow } from "../hooks/useChatAIFlow";

type DocumentResultAsset = NonNullable<
  import("expo-document-picker").DocumentPickerResult["assets"]
>[0];

const INPUT_BAR_MIN_H = 56;
const SELECTED_FILE_ROW_H = 42;
const KEYBOARD_NUDGE = 2;
const FOOTER_LIFT_WHEN_BUSY = 72;

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

  const [textInput, setTextInput] = useState("");
  const [selectedFileAsset, setSelectedFileAsset] =
    useState<DocumentResultAsset | null>(null);

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const didInitialScrollRef = useRef(false);

  // ✅ Keyboard (1:1 ausgelagert) – NICHT anfassen
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

  // ✅ Berechnungen unverändert
  const keyboardOffsetInScreen =
    keyboardHeight > 0
      ? Math.max(0, keyboardHeight - insets.bottom - KEYBOARD_NUDGE)
      : 0;

  const bottomBarVisualH =
    INPUT_BAR_MIN_H + (selectedFileAsset ? SELECTED_FILE_ROW_H : 0);
  const busyLift = combinedIsLoading || isStreaming ? FOOTER_LIFT_WHEN_BUSY : 0;

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
  }, [messages, hardScrollToBottom]);

  // Animation (unverändert)
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
    setError,
  ]);

  const handleScroll = useCallback(
    (event: any) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      const atBottom = distanceFromBottom < 60;

      setAtBottom(atBottom);
      setShowScrollButton(!atBottom && messages.length > 3);
    },
    [messages.length, setAtBottom],
  );

  const scrollButtonPress = useCallback(() => {
    setAtBottom(true);
    hardScrollToBottom(true);
    setTimeout(() => hardScrollToBottom(true), 160);
    setShowScrollButton(false);
  }, [hardScrollToBottom, setAtBottom]);

  const renderItem = useCallback(({ item }: { item: ChatMessage }) => {
    return <MessageItem message={item} />;
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={styles.listContainer}>
            <ChatLoadingOverlay
              visible={combinedIsLoading && messages.length === 0}
              thinkingOpacity={thinkingOpacity}
              thinkingScale={thinkingScale}
            />

            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: listBottomPadding },
              ]}
              ListFooterComponent={
                combinedIsLoading || isStreaming ? (
                  <ChatLoadingFooter
                    visible={combinedIsLoading || isStreaming}
                    isStreaming={isStreaming}
                    streamingMessage={streamingMessage}
                    thinkingOpacity={thinkingOpacity}
                    thinkingScale={thinkingScale}
                    typingDot1={typingDot1}
                    typingDot2={typingDot2}
                    typingDot3={typingDot3}
                  />
                ) : null
              }
              removeClippedSubviews={Platform.OS === "ios"}
              maxToRenderPerBatch={10}
              windowSize={21}
              initialNumToRender={15}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onScrollBeginDrag={Keyboard.dismiss}
              onContentSizeChange={() => {
                if (!didInitialScrollRef.current && messages.length > 0) {
                  didInitialScrollRef.current = true;
                  setAtBottom(true);
                  hardScrollToBottom(false);
                  setTimeout(() => hardScrollToBottom(false), 160);
                  return;
                }
                if (isAtBottomRef.current) hardScrollToBottom(false);
              }}
              keyboardShouldPersistTaps="handled"
            />
          </View>

          <ChatErrorBanner message={error} />

          <ChatScrollToBottomButton
            visible={showScrollButton}
            bottom={scrollBtnBottom}
            onPress={scrollButtonPress}
          />

          <ChatComposer
            textInput={textInput}
            onChangeText={setTextInput}
            pendingPlan={pendingPlan}
            selectedFileAsset={selectedFileAsset}
            onPickDocument={handlePickDocument}
            onClearSelectedFile={() => setSelectedFileAsset(null)}
            onSend={handleSend}
            combinedIsLoading={combinedIsLoading}
            keyboardOffsetInScreen={keyboardOffsetInScreen}
            sendButtonScale={sendButtonScale}
          />

          <ConfirmChangesModal
            visible={showConfirmModal}
            summary={pendingChange?.summary ?? ""}
            onAccept={applyChanges}
            onReject={rejectChanges}
          />
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

export default ChatScreen;
