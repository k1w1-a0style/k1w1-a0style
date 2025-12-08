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
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
  FadeInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import { ChatMessage } from '../contexts/types';
import MessageItem from '../components/MessageItem';
import { useChatLogic } from '../hooks/useChatLogic';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// Loading footer component - memoized outside main component
const LoadingFooter = React.memo(() => (
  <View style={styles.loadingFooter}>
    <ActivityIndicator size="small" color={theme.palette.primary} />
    <Text style={styles.loadingText}>Builder arbeitet ...</Text>
  </View>
));
LoadingFooter.displayName = 'LoadingFooter';

// Empty state component - memoized outside main component  
const EmptyState = React.memo(() => (
  <View style={styles.emptyState}>
    <Ionicons name="chatbubble-ellipses-outline" size={48} color={theme.palette.text.muted} />
    <Text style={styles.emptyStateTitle}>Willkommen!</Text>
    <Text style={styles.emptyStateSubtitle}>
      Beschreibe dein Projekt und der Builder hilft dir beim Coden.
    </Text>
    <View style={styles.emptyStateHints}>
      <Text style={styles.emptyStateHint}>💡 "Erstelle einen Login-Screen"</Text>
      <Text style={styles.emptyStateHint}>💡 "Füge Dark Mode hinzu"</Text>
      <Text style={styles.emptyStateHint}>💡 "Wie viele Dateien?"</Text>
    </View>
  </View>
));
EmptyState.displayName = 'EmptyState';

// Loading overlay component
const LoadingOverlay = React.memo(() => (
  <View style={styles.loadingOverlay}>
    <ActivityIndicator size="large" color={theme.palette.primary} />
    <Text style={styles.loadingOverlayText}>Projekt und Chat werden geladen...</Text>
  </View>
));
LoadingOverlay.displayName = 'LoadingOverlay';

// Error Banner Component
interface ErrorBannerProps {
  error: string;
  onDismiss: () => void;
  onRetry?: () => void;
}

const ErrorBanner = React.memo<ErrorBannerProps>(({ error, onDismiss, onRetry }) => (
  <Animated.View
    entering={FadeInDown.duration(200)}
    exiting={FadeOut.duration(150)}
    style={styles.errorBanner}
  >
    <View style={styles.errorContent}>
      <Ionicons name="alert-circle" size={18} color={theme.palette.error} />
      <Text style={styles.errorText} numberOfLines={3}>{error}</Text>
    </View>
    <View style={styles.errorActions}>
      {onRetry && (
        <TouchableOpacity
          style={styles.errorRetryButton}
          onPress={onRetry}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="refresh" size={16} color={theme.palette.primary} />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.errorDismissButton}
        onPress={onDismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Fehler schließen"
      >
        <Ionicons name="close" size={18} color={theme.palette.text.secondary} />
      </TouchableOpacity>
    </View>
  </Animated.View>
));
ErrorBanner.displayName = 'ErrorBanner';

const ChatScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    messages,
    textInput,
    setTextInput,
    selectedFileAsset,
    handlePickDocument,
    handleSend,
    combinedIsLoading,
    error,
    clearError,
    cancelRequest,
    isAiLoading,
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

  // Memoized render item function - Animation nur für neue Nachrichten
  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      // Animation nur für die letzten 2 Nachrichten (Performance)
      const disableAnimation = index < messages.length - 2;
      return <MessageItem message={item} disableAnimation={disableAnimation} />;
    },
    [messages.length],
  );

  // Memoized key extractor
  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  // Memoized footer component
  const ListFooterComponent = useMemo(() => {
    if (!isAiLoading || messages.length === 0) return null;
    return <LoadingFooter />;
  }, [isAiLoading, messages.length]);

  // Memoized empty component
  const ListEmptyComponent = useMemo(() => {
    if (combinedIsLoading) return null;
    return <EmptyState />;
  }, [combinedIsLoading]);

  // Check if send button should be disabled
  const isSendDisabled = combinedIsLoading || (!textInput.trim() && !selectedFileAsset);

  // Handle retry - sendet die letzte User-Nachricht nochmal
  const handleRetry = useCallback(() => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      setTextInput(lastUserMessage.content);
      clearError();
    }
  }, [messages, setTextInput, clearError]);

  const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : undefined;
  const inputBottomPadding = Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 8;
  const listBottomPadding = 90; // Fixed padding for input area height

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={keyboardBehavior}
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
                { paddingBottom: listBottomPadding },
              ]}
              ListFooterComponent={ListFooterComponent}
              ListEmptyComponent={ListEmptyComponent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              // Performance optimizations
              initialNumToRender={12}
              maxToRenderPerBatch={10}
              windowSize={9}
              removeClippedSubviews={Platform.OS === 'android'}
              // Kein getItemLayout - dynamische Höhen funktionieren besser
              // Maintain scroll position
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
              }}
              // Accessibility
              accessibilityRole="list"
              accessibilityLabel="Chat-Nachrichten"
            />
          )}
        </View>

        {/* Error Banner mit Dismiss und Retry */}
        {error && (
          <ErrorBanner
            error={error}
            onDismiss={clearError}
            onRetry={handleRetry}
          />
        )}

        {/* Input Area */}
        <View style={[styles.inputWrapper, { paddingBottom: inputBottomPadding }]}>
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
              disabled={isAiLoading}
              accessibilityRole="button"
              accessibilityLabel="Datei anhängen"
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
              editable={!isAiLoading}
              accessibilityLabel="Nachricht eingeben"
              accessibilityHint="Beschreibe was du bauen möchtest"
            />

            {/* Cancel Button (nur während Loading) */}
            {isAiLoading ? (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={cancelRequest}
                accessibilityRole="button"
                accessibilityLabel="Request abbrechen"
              >
                <Ionicons name="stop-circle" size={24} color={theme.palette.error} />
              </TouchableOpacity>
            ) : (
              /* Send Button */
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
                accessibilityRole="button"
                accessibilityLabel="Nachricht senden"
                accessibilityState={{ disabled: isSendDisabled }}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </AnimatedTouchableOpacity>
            )}
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

  // Empty State Hints
  emptyStateHints: {
    marginTop: 16,
    gap: 8,
  },
  emptyStateHint: {
    fontSize: 13,
    color: theme.palette.text.muted,
    textAlign: 'center',
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderTopWidth: 1,
    borderTopColor: theme.palette.error,
  },
  errorContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: theme.palette.error,
    lineHeight: 18,
  },
  errorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  errorRetryButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorDismissButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Input Wrapper
  inputWrapper: {
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    paddingTop: 4,
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
    paddingTop: 6,
    paddingBottom: 6,
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
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.palette.error,
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
