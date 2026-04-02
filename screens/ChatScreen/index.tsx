import React, { useCallback } from "react";
import { View, FlatList, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


import MessageItem from "../../components/MessageItem";

import ConfirmChangesModal from "../../components/chat/ConfirmChangesModal";
import ChatComposer from "../../components/chat/ChatComposer";
import ChatLoadingOverlay from "../../components/chat/ChatLoadingOverlay";
import ChatLoadingFooter from "../../components/chat/ChatLoadingFooter";
import ChatErrorBanner from "../../components/chat/ChatErrorBanner";
import ChatScrollToBottomButton from "../../components/chat/ChatScrollToBottomButton";

import { styles } from "../../styles/chatScreenStyles";

import { useChatScreen } from "./hooks/useChatScreen";

import type { ChatMessage } from "../../shared/types/chat";
const ChatScreen: React.FC = () => {
  const {
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

    setComposerHeight,
  } = useChatScreen();

  const renderItem = useCallback(({ item }: { item: ChatMessage }) => {
    return <MessageItem message={item} />;
  }, []);

  // ✅ FIX #6: Stable keyExtractor — always use id, fallback to timestamp+index
  const guardWriteStatus = React.useMemo<"normal" | "guarded">(() => {
    const errs = pendingChange?.errors ?? [];
    const hasGuardHint = errs.some((entry) => /manual-only|kritisch|read-only|baseline|guarded|ownership block/i.test(String(entry)));
    return hasGuardHint ? "guarded" : "normal";
  }, [pendingChange?.errors]);

  const keyExtractor = useCallback(
    (item: ChatMessage, index: number) =>
      item.id || `${item.timestamp}-${index}`,
    [],
  );

  return (
    <SafeAreaView style={styles.root} edges={["left", "right"]}>
      {/* ✅ FIX #4: Removed TouchableWithoutFeedback wrapper.
          Keyboard dismiss is handled by onScrollBeginDrag on the FlatList.
          The wrapper was blocking scroll gestures on some Android devices. */}
      <View style={styles.container}>
        <View style={styles.listContainer}>
          <ChatLoadingOverlay
            visible={combinedIsLoading && messages.length === 0}
            thinkingOpacity={thinkingOpacity}
            thinkingScale={thinkingScale}
          />

          {/* FIX #16: keep removeClippedSubviews off — prevents blank-area bugs with flex-end layouts */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
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
            removeClippedSubviews={false}
            maxToRenderPerBatch={10}
            windowSize={21}
            initialNumToRender={15}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onScrollBeginDrag={() => Keyboard.dismiss()}
            onContentSizeChange={handleContentSizeChange}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
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
          guardWriteStatus={guardWriteStatus}
          selectedFileAsset={selectedFileAsset}
          onPickDocument={handlePickDocument}
          onClearSelectedFile={() => setSelectedFileAsset(null)}
          onSend={handleSend}
          combinedIsLoading={combinedIsLoading}
          keyboardOffsetInScreen={keyboardOffsetInScreen}
          sendButtonScale={sendButtonScale}
          onHeightChange={(h) => setComposerHeight(h)}
        />

        <ConfirmChangesModal
          visible={showConfirmModal}
          pendingChange={pendingChange}
          onAccept={applyChanges}
          onReject={rejectChanges}
        />
      </View>
    </SafeAreaView>
  );
};

export default ChatScreen;
