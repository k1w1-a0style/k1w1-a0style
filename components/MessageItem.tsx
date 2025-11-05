import React, { memo } from 'react';
import { Text, Pressable, StyleSheet, Alert } from 'react-native';
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
  item: ChatMessage;
};

const MessageItem = memo(({ item }: MessageItemProps) => {
  const messageText = item?.content?.trim() ?? '';
  const isUser = item?.role === 'user';
  
  if (isUser && messageText.length === 0) return null;

  const handleLongPress = () => {
    if (messageText) {
      Clipboard.setStringAsync(messageText);
      Alert.alert('Kopiert');
    }
  };

  return (
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
  );
});

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
    opacity: 0.7
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

