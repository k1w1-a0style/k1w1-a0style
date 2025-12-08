// screens/ChatScreen.tsx – Builder mit Rotation-Feedback + RichContext (UI + Hook)
import React, { useEffect, useRef, useCallback } from 'react';
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

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

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

  // Animation values for buttons
  const sendButtonScale = useSharedValue(1);
  const attachButtonScale = useSharedValue(1);

  const sendButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
  }));

  const attachButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: attachButtonScale.value }],
  }));

  const handleSendPress = useCallback(() => {
    sendButtonScale.value = withSpring(1, { damping: 15 });
    handleSend();
  }, [handleSend, sendButtonScale]);

  const handleAttachPress = useCallback(() => {
    attachButtonScale.value = withSpring(1, { damping: 15 });
    handlePickDocument();
  }, [handlePickDocument, attachButtonScale]);

  const handleSendPressIn = useCallback(() => {
    sendButtonScale.value = withSpring(0.9, { damping: 15 });
  }, [sendButtonScale]);

  const handleSendPressOut = useCallback(() => {
    sendButtonScale.value = withSpring(1, { damping: 15 });
  }, [sendButtonScale]);

  const handleAttachPressIn = useCallback(() => {
    attachButtonScale.value = withSpring(0.9, { damping: 15 });
  }, [attachButtonScale]);

  const handleAttachPressOut = useCallback(() => {
    attachButtonScale.value = withSpring(1, { damping: 15 });
  }, [attachButtonScale]);

  // Scrollt nach neuen Nachrichten ans Ende, mit sauberem Cleanup
  useEffect(() => {
    let mounted = true;
    const scrollToEnd = () => {
      if (mounted && flatListRef.current && messages.length > 0) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    };

    const timer = setTimeout(scrollToEnd, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [messages.length]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => <MessageItem message={item} />,
    [],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

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
    <KeyboardAvoidingView
      style={styles.root}
      behavior="height"
      keyboardVerticalOffset={80}
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
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              ListFooterComponent={renderFooter}
            />
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.inputWrapper}>
          <View style={styles.inputContainer}>
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
                color={
                  selectedFileAsset
                    ? theme.palette.primary
                    : theme.palette.text.secondary
                }
              />
            </AnimatedTouchableOpacity>

            <TextInput
              style={styles.textInput}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Beschreibe, was der Builder tun soll ..."
              placeholderTextColor={theme.palette.text.secondary}
              multiline
            />

            <AnimatedTouchableOpacity
              style={[styles.sendButton, sendButtonAnimatedStyle]}
              onPress={handleSendPress}
              onPressIn={handleSendPressIn}
              onPressOut={handleSendPressOut}
              disabled={combinedIsLoading}
            >
              {combinedIsLoading ? (
                <ActivityIndicator size="small" color={theme.palette.secondary} />
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={theme.palette.secondary}
                />
              )}
            </AnimatedTouchableOpacity>
          </View>

          {selectedFileAsset && (
            <Animated.View
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(200)}
              style={styles.selectedFileBox}
            >
              <Text style={styles.selectedFileText}>
                📎 {selectedFileAsset.name}
              </Text>
            </Animated.View>
          )}
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
    paddingBottom: 16,
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
  inputWrapper: {
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    paddingBottom: Platform.OS === 'android' ? 4 : 0,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
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
});

export default React.memo(ChatScreen);
