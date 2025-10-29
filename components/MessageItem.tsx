import React, { memo } from 'react';
import { Text, Pressable, StyleSheet, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../theme';
import { ChatMessage } from '../contexts/ProjectContext';

type MessageItemProps = {
  item: ChatMessage;
};

const MessageItem = memo(({ item }: MessageItemProps) => {
  const messageText = item?.text?.trim() ?? '';
  if (item?.user?._id === 1 && messageText.length === 0) return null;

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
        item.user._id === 1 ? styles.userMessage : styles.aiMessage,
        pressed && styles.messagePressed,
      ]}
      onLongPress={handleLongPress}
    >
      <Text style={item.user._id === 1 ? styles.userMessageText : styles.aiMessageText}>
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
