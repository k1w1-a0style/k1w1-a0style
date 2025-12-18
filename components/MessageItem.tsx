import React, { memo, useEffect, useRef, useMemo } from 'react';
import { Text, Pressable, StyleSheet, Alert, Animated, View, ScrollView, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { theme, getNeonGlow } from '../theme';
import { SyntaxHighlighter } from './SyntaxHighlighter';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  meta?: {
    provider?: string;
    error?: boolean;
    planner?: boolean;
  };
}

type MessagePart =
  | { type: 'text'; content: string }
  | { type: 'code'; language: string; content: string };

const parseMessageContent = (content: string): MessagePart[] => {
  const parts: MessagePart[] = [];
  const s = String(content ?? '').replace(/\r\n/g, '\n');

  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(s)) !== null) {
    const before = s.slice(lastIndex, match.index);
    if (before.trim().length > 0) parts.push({ type: 'text', content: before });

    const language = match[1] || 'text';
    const codeContent = String(match[2] ?? '').replace(/\r\n/g, '\n').replace(/\s+$/, '');
    if (codeContent.trim().length > 0) parts.push({ type: 'code', language, content: codeContent });

    lastIndex = match.index + match[0].length;
  }

  const rest = s.slice(lastIndex);
  if (rest.trim().length > 0) parts.push({ type: 'text', content: rest });

  if (parts.length === 0) parts.push({ type: 'text', content: s });
  return parts;
};

type MessageItemProps = { message: ChatMessage };

const MessageItem = memo(({ message }: MessageItemProps) => {
  const messageText = String(message?.content ?? '').replace(/\r\n/g, '\n'); // KEIN trim -> Returns bleiben
  const messageTextTrim = messageText.trim();

  const isUser = message?.role === 'user';
  const isSystem = message?.role === 'system';
  const isError = message?.meta?.error;

  const messageParts = useMemo(() => parseMessageContent(messageText), [messageText]);
  const hasCodeBlocks = useMemo(() => messageParts.some((p) => p.type === 'code'), [messageParts]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isUser ? 18 : -18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 55, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isUser && messageTextTrim.length === 0) return null;

  const handleLongPress = () => {
    if (messageTextTrim) {
      Clipboard.setStringAsync(messageText);
      Alert.alert('📋 Kopiert', 'Nachricht wurde in die Zwischenablage kopiert.');
    }
  };

  const bubbleStyle = () => {
    if (isError) return styles.errorMessage;
    if (isSystem) return styles.systemMessage;
    if (isUser) return styles.userMessage;
    return styles.aiMessage;
  };

  const textStyle = () => {
    if (isError) return styles.errorMessageText;
    if (isSystem) return styles.systemMessageText;
    if (isUser) return styles.userMessageText;
    return styles.aiMessageText;
  };

  const icon = () => {
    if (isError) return <Ionicons name="warning" size={14} color={theme.palette.error} style={styles.icon} />;
    if (isSystem) return <Ionicons name="information-circle" size={14} color={theme.palette.warning} style={styles.icon} />;
    return null;
  };

  return (
    <Animated.View
      style={[
        styles.messageRow,
        isUser ? styles.messageRowUser : styles.messageRowOther,
        { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
      ]}
    >
      <Pressable
        style={({ pressed }) => [
          styles.messageBubble,
          bubbleStyle(),
          pressed && styles.messagePressed,
          isUser && getNeonGlow(theme.palette.primary, 'subtle'),
          hasCodeBlocks && styles.messageBubbleWithCode,
        ]}
        onLongPress={handleLongPress}
      >
        <View style={styles.messageContent}>
          {icon()}

          <View style={styles.textColumn}>
            {hasCodeBlocks ? (
              <View style={styles.messagePartsContainer}>
                {messageParts.map((part, index) => {
                  if (part.type === 'code') {
                    return (
                      <View key={index} style={styles.codeBlockContainer}>
                        <View style={styles.codeBlockHeader}>
                          <Text style={styles.codeLanguage}>{part.language || 'code'}</Text>
                          <TouchableOpacity
                            style={styles.copyCodeButton}
                            onPress={() => {
                              Clipboard.setStringAsync(part.content);
                              Alert.alert('📋 Kopiert', 'Code wurde in die Zwischenablage kopiert.');
                            }}
                          >
                            <Ionicons name="copy-outline" size={14} color={theme.palette.text.secondary} />
                          </TouchableOpacity>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.codeScrollView}>
                          <View style={styles.codeContent}>
                            <SyntaxHighlighter code={part.content} showLineNumbers={part.content.split('\n').length > 3} />
                          </View>
                        </ScrollView>
                      </View>
                    );
                  }

                  return (
                    <Text key={index} style={textStyle()}>
                      {part.content}
                    </Text>
                  );
                })}
              </View>
            ) : (
              <Text style={textStyle()}>{messageTextTrim.length ? messageText : '...'}</Text>
            )}
          </View>
        </View>

        <Text style={styles.timestamp}>
          {new Date(message.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </Pressable>
    </Animated.View>
  );
});

MessageItem.displayName = 'MessageItem';

const styles = StyleSheet.create({
  // ✅ Fix gegen “Briefmarken-Bubbles”: Row ist 100% breit und richtet links/rechts aus
  messageRow: {
    width: '100%',
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },

  messageBubble: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: '88%',
    minWidth: 140,
    borderWidth: 1.5,
    flexShrink: 1,
  },

  messageContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minWidth: 0,
    flexShrink: 1,
  },

  textColumn: {
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 0,
  },

  icon: { marginRight: 6, marginTop: 2 },

  userMessage: {
    backgroundColor: theme.palette.userBubble.background,
    borderColor: theme.palette.userBubble.border,
    borderBottomRightRadius: 4,
  },
  userMessageText: { fontSize: 14, color: theme.palette.userBubble.text, lineHeight: 20 },

  aiMessage: {
    backgroundColor: theme.palette.aiBubble.background,
    borderColor: theme.palette.aiBubble.border,
    borderBottomLeftRadius: 4,
  },
  aiMessageText: { fontSize: 14, color: theme.palette.aiBubble.text, lineHeight: 20 },

  systemMessage: {
    backgroundColor: theme.palette.systemBubble.background,
    borderColor: theme.palette.systemBubble.border,
    borderBottomLeftRadius: 4,
  },
  systemMessageText: { fontSize: 13, color: theme.palette.systemBubble.text, lineHeight: 19, fontStyle: 'italic' },

  errorMessage: {
    backgroundColor: `${theme.palette.error}15`,
    borderColor: theme.palette.error,
    borderBottomLeftRadius: 4,
  },
  errorMessageText: { fontSize: 14, color: theme.palette.error, lineHeight: 20 },

  messagePressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },

  timestamp: { fontSize: 10, color: theme.palette.text.disabled, marginTop: 4, alignSelf: 'flex-end' },

  messageBubbleWithCode: { maxWidth: '95%' },
  messagePartsContainer: { flexShrink: 1, minWidth: 0 },

  codeBlockContainer: {
    backgroundColor: theme.palette.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    overflow: 'hidden',
    marginVertical: 4,
  },
  codeBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: `${theme.palette.border}50`,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  codeLanguage: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.palette.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  copyCodeButton: { padding: 4 },
  codeScrollView: { maxHeight: 300 },
  codeContent: { padding: 10, minWidth: '100%' },
});

export default MessageItem;
