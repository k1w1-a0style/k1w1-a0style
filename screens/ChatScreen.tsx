// screens/ChatScreen.tsx – Optimierter Builder Chat mit Performance-Verbesserungen
import React, { useEffect, useRef, useCallback, useMemo } from 'react';
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
  Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import { ChatMessage } from '../contexts/types';
import MessageItem from '../components/MessageItem';
import { useChatLogic } from '../hooks/useChatLogic';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// Estimated item height for getItemLayout
const ESTIMATED_ITEM_HEIGHT = 80;

// Loading footer component - memoized outside main component
const LoadingFooter = () => (
  <View style={styles.loadingFooter}>
    <ActivityIndicator size="small" color={theme.palette.primary} />
    <Text style={styles.loadingText}>Builder arbeitet ...</Text>
  </View>
);

// Empty state component - memoized outside main component  
const EmptyState = () => (
  <View style={styles.emptyState}>
    <Ionicons name="chatbubble-ellipses-outline" size={48} color={theme.palette.text.muted} />
    <Text style={styles.emptyStateTitle}>Willkommen!</Text>
    <Text style={styles.emptyStateSubtitle}>
      Beschreibe dein Projekt und der Builder hilft dir beim Coden.
    </Text>
  </View>
);

// Loading overlay component
const LoadingOverlay = () => (
  <View style={styles.loadingOverlay}>
    <ActivityIndicator size="large" color={theme.palette.primary} />
    <Text style={styles.loadingOverlayText}>Projekt und Chat werden geladen...</Text>
  </View>
);

const ChatScreen: React.FC = () => {
  const {
    messages,
    textInput,
    setTextInput,
    selectedFileAsset,
    handlePickDocument,
    handleSend,
    combinedIsLoading,
    error,
  } = useChatLogic();

  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Animation values
  const sendButtonScale = useSharedValue(1);
  const attachButtonScale = useSharedValue(1);

  const sendButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
  }));

  const attachButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: attachButtonScale.value }],
  }));

  // Memoized handlers to prevent unnecessary re-renders
  const handleSendPress = useCallback(() => {
    sendButtonScale.value = withSpring(1, { damping: 15 });
    Keyboard.dismiss();
    handleSend();
  }, [handleSend, sendButtonScale]);

  const handleAttachPress = useCallback(() => {
    attachButtonScale.value = withSpring(1, { damping: 15 });
    handlePickDocument();
  }, [handlePickDocument, attachButtonScale]);

  const handleSendPressIn = useCallback(() => {
    sendButtonScale.value = withSpring(0.92, { damping: 15 });
  }, [sendButtonScale]);

  const handleSendPressOut = useCallback(() => {
    sendButtonScale.value = withSpring(1, { damping: 15 });
  }, [sendButtonScale]);

  const handleAttachPressIn = useCallback(() => {
    attachButtonScale.value = withSpring(0.92, { damping: 15 });
  }, [attachButtonScale]);

  const handleAttachPressOut = useCallback(() => {
    attachButtonScale.value = withSpring(1, { damping: 15 });
  }, [attachButtonScale]);

  // Scroll to end when new messages arrive
  useEffect(() => {
    if (messages.length === 0) return;

    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 150);

    return () => clearTimeout(timer);
  }, [messages.length]);

  // Memoized render item function
  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => <MessageItem message={item} />,
    [],
  );

  // Memoized key extractor
  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  // Memoized footer component
  const ListFooterComponent = useMemo(() => {
    if (!combinedIsLoading || messages.length === 0) return null;
    return <LoadingFooter />;
  }, [combinedIsLoading, messages.length]);

  // Memoized empty component
  const ListEmptyComponent = useMemo(() => {
    if (combinedIsLoading) return null;
    return <EmptyState />;
  }, [combinedIsLoading]);

  // getItemLayout for better scrolling performance
  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: ESTIMATED_ITEM_HEIGHT,
      offset: ESTIMATED_ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  // Check if send button should be disabled
  const isSendDisabled = combinedIsLoading || (!textInput.trim() && !selectedFileAsset);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        {/* Messages List */}
        <View style={styles.listContainer}>
          {combinedIsLoading && messages.length === 0 ? (
            <LoadingOverlay />
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={[
                styles.listContent,
                messages.length === 0 && styles.listContentEmpty,
              ]}
              ListFooterComponent={ListFooterComponent}
              ListEmptyComponent={ListEmptyComponent}
              // Performance optimizations
              initialNumToRender={10}
              maxToRenderPerBatch={8}
              windowSize={7}
              removeClippedSubviews={Platform.OS === 'android'}
              getItemLayout={getItemLayout}
              // Maintain scroll position
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
              }}
            />
          )}
        </View>

        {/* Error Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={theme.palette.error} />
            <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
          </View>
        )}

        {/* Input Area */}
        <View style={styles.inputWrapper}>
          {/* Selected File Indicator */}
          {selectedFileAsset && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={styles.selectedFileBox}
            >
              <Ionicons name="document-attach" size={14} color={theme.palette.primary} />
              <Text style={styles.selectedFileText} numberOfLines={1}>
                {selectedFileAsset.name}
              </Text>
            </Animated.View>
          )}

          <View style={styles.inputContainer}>
            {/* Attach Button */}
            <AnimatedTouchableOpacity
              style={[
                styles.iconButton,
                attachButtonAnimatedStyle,
                selectedFileAsset && styles.iconButtonActive,
              ]}
              onPress={handleAttachPress}
              onPressIn={handleAttachPressIn}
              onPressOut={handleAttachPressOut}
            >
              <Ionicons
                name="attach"
                size={20}
                color={selectedFileAsset ? theme.palette.primary : theme.palette.text.secondary}
              />
            </AnimatedTouchableOpacity>

            {/* Text Input */}
            <TextInput
              style={styles.textInput}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Was soll der Builder tun?"
              placeholderTextColor={theme.palette.text.muted}
              multiline
              maxLength={4000}
              editable={!combinedIsLoading}
            />

            {/* Send Button */}
            <AnimatedTouchableOpacity
              style={[
                styles.sendButton,
                sendButtonAnimatedStyle,
                isSendDisabled && styles.sendButtonDisabled,
              ]}
              onPress={handleSendPress}
              onPressIn={handleSendPressIn}
              onPressOut={handleSendPressOut}
              disabled={isSendDisabled}
            >
              {combinedIsLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </AnimatedTouchableOpacity>
          </View>
        </View>
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
    paddingBottom: 8,
  },
  listContentEmpty: {
    flex: 1,
  },

  // Loading States
  loadingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingOverlayText: {
    fontSize: 14,
    color: theme.palette.text.secondary,
  },
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: theme.palette.text.secondary,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderTopWidth: 1,
    borderTopColor: theme.palette.error,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: theme.palette.error,
  },

  // Input Wrapper
  inputWrapper: {
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    paddingBottom: Platform.OS === 'android' ? 8 : 0,
  },
  selectedFileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  selectedFileText: {
    fontSize: 12,
    color: theme.palette.primary,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },

  // Buttons
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.background,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  iconButtonActive: {
    borderColor: theme.palette.primary,
    backgroundColor: theme.palette.primarySoft,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },

  // Text Input
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    color: theme.palette.text.primary,
    fontSize: 15,
    backgroundColor: theme.palette.background,
  },
});

export default React.memo(ChatScreen);
