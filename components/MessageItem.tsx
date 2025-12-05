import React, { memo, useEffect, useRef } from 'react';
import { Text, Pressable, StyleSheet, Alert, Animated } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../theme';

// NEUES ChatMessage Format
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

type MessageItemProps = {
  message: ChatMessage;
};

const MessageItem = memo(({ message }: MessageItemProps) => {
  const messageText = message?.content?.trim() ?? '';
  const isUser = message?.role === 'user';
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isUser ? 20 : -20)).current;

  useEffect(() => {
    // Animate message entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (isUser && messageText.length === 0) return null;

  const handleLongPress = () => {
    if (messageText) {
      Clipboard.setStringAsync(messageText);
      Alert.alert('📋 Kopiert', 'Nachricht wurde in die Zwischenablage kopiert.');
    }
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateX: slideAnim }],
      }}
    >
      <Pressable
        style={({ pressed }) => [
          styles.messageBubble,
          isUser ? styles.userMessage : styles.aiMessage,
          pressed && styles.messagePressed,
        ]}
        onLongPress={handleLongPress}
      >
        <Text style={isUser ? styles.userMessageText : styles.aiMessageText}>
          {messageText || '...'}
        </Text>
      </Pressable>
    </Animated.View>
  );
});

MessageItem.displayName = 'MessageItem';

const styles = StyleSheet.create({
  messageBubble: {
    borderRadius: 15,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    maxWidth: '85%',
    borderWidth: 1,
  },
  userMessage: {
    backgroundColor: theme.palette.primary + '20',
    borderColor: theme.palette.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 3,
  },
  aiMessage: {
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.border,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 3,
  },
  messagePressed: {
    opacity: 0.7,
  },
  userMessageText: {
    fontSize: 14,
    color: theme.palette.text.primary,
    lineHeight: 19,
  },
  aiMessageText: {
    fontSize: 14,
    color: theme.palette.text.primary,
    lineHeight: 19,
  },
});

export default MessageItem;
