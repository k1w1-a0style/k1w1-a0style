import React, { memo, useEffect, useRef, useMemo } from 'react';
import { Text, Pressable, StyleSheet, Alert, Animated, View, Platform, ScrollView, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { theme, getNeonGlow } from '../theme';
import { SyntaxHighlighter } from './SyntaxHighlighter';

// NEUES ChatMessage Format
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  meta?: {
    provider?: string;
    error?: boolean;
  };
}

// ✅ NEU: Typ für geparste Nachrichtenteile
type MessagePart = 
  | { type: 'text'; content: string }
  | { type: 'code'; language: string; content: string };

// ✅ NEU: Parser für Markdown-Code-Blöcke
const parseMessageContent = (content: string): MessagePart[] => {
  const parts: MessagePart[] = [];
  // Regex für Code-Blöcke: ```language\ncode\n``` oder ```\ncode\n```
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Text vor dem Code-Block hinzufügen
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim();
      if (textContent) {
        parts.push({ type: 'text', content: textContent });
      }
    }
    
    // Code-Block hinzufügen
    const language = match[1] || 'text';
    const codeContent = match[2].trim();
    if (codeContent) {
      parts.push({ type: 'code', language, content: codeContent });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Restlichen Text hinzufügen
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex).trim();
    if (remainingText) {
      parts.push({ type: 'text', content: remainingText });
    }
  }
  
  // Falls keine Parts gefunden wurden, gesamten Content als Text zurückgeben
  if (parts.length === 0) {
    parts.push({ type: 'text', content: content.trim() });
  }
  
  return parts;
};

type MessageItemProps = {
  message: ChatMessage;
};

const MessageItem = memo(({ message }: MessageItemProps) => {
  const messageText = message?.content?.trim() ?? '';
  const isUser = message?.role === 'user';
  const isSystem = message?.role === 'system';
  const isError = message?.meta?.error;
  
  // ✅ NEU: Parse message content für Syntax Highlighting
  const messageParts = useMemo(() => parseMessageContent(messageText), [messageText]);
  const hasCodeBlocks = useMemo(() => messageParts.some(p => p.type === 'code'), [messageParts]);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isUser ? 20 : -20)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

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

    // Subtle glow pulse for user messages
    if (isUser) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // NOTE: Empty deps intentional - entrance animation should only run once on mount

  if (isUser && messageText.length === 0) return null;

  const handleLongPress = () => {
    if (messageText) {
      Clipboard.setStringAsync(messageText);
      Alert.alert('📋 Kopiert', 'Nachricht wurde in die Zwischenablage kopiert.');
    }
  };

  const getBubbleStyle = () => {
    if (isError) return styles.errorMessage;
    if (isSystem) return styles.systemMessage;
    if (isUser) return styles.userMessage;
    return styles.aiMessage;
  };

  const getTextStyle = () => {
    if (isError) return styles.errorMessageText;
    if (isSystem) return styles.systemMessageText;
    if (isUser) return styles.userMessageText;
    return styles.aiMessageText;
  };

  const getIcon = () => {
    if (isError) return <Ionicons name="warning" size={14} color={theme.palette.error} style={styles.icon} />;
    if (isSystem) return <Ionicons name="information-circle" size={14} color={theme.palette.warning} style={styles.icon} />;
    return null;
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <Animated.View
      style={[
        styles.messageContainer,
        isUser && styles.userContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      {/* Neon Glow Background für User Messages */}
      {isUser && Platform.OS === 'ios' && (
        <Animated.View 
          style={[
            styles.glowBackground,
            { opacity: glowOpacity }
          ]} 
        />
      )}
      
      <Pressable
        style={({ pressed }) => [
          styles.messageBubble,
          getBubbleStyle(),
          pressed && styles.messagePressed,
          isUser && getNeonGlow(theme.palette.primary, 'subtle'),
          hasCodeBlocks && styles.messageBubbleWithCode,
        ]}
        onLongPress={handleLongPress}
      >
        <View style={styles.messageContent}>
          {getIcon()}
          {/* ✅ NEU: Rendern mit Syntax Highlighting für Code-Blöcke */}
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
                      <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        style={styles.codeScrollView}
                      >
                        <View style={styles.codeContent}>
                          <SyntaxHighlighter code={part.content} showLineNumbers={part.content.split('\n').length > 3} />
                        </View>
                      </ScrollView>
                    </View>
                  );
                }
                return (
                  <Text key={index} style={getTextStyle()}>
                    {part.content}
                  </Text>
                );
              })}
            </View>
          ) : (
            <Text style={getTextStyle()}>
              {messageText || '...'}
            </Text>
          )}
        </View>
        
        {/* Timestamp */}
        <Text style={styles.timestamp}>
          {new Date(message.timestamp).toLocaleTimeString('de-DE', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </Pressable>
    </Animated.View>
  );
});

MessageItem.displayName = 'MessageItem';

const styles = StyleSheet.create({
  messageContainer: {
    marginBottom: 8,
    marginHorizontal: 4,
    position: 'relative',
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  glowBackground: {
    position: 'absolute',
    top: -4,
    right: -4,
    bottom: -4,
    left: '30%',
    backgroundColor: theme.palette.primary,
    borderRadius: 20,
    opacity: 0.1,
  },
  messageBubble: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: '88%',
    minWidth: 60,
    borderWidth: 1.5,
  },
  messageContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexShrink: 1,
  },
  icon: {
    marginRight: 6,
    marginTop: 2,
  },
  // User Message - Neon Grün Style
  userMessage: {
    backgroundColor: theme.palette.userBubble.background,
    borderColor: theme.palette.userBubble.border,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  userMessageText: {
    fontSize: 14,
    color: theme.palette.userBubble.text,
    lineHeight: 20,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  // AI Message
  aiMessage: {
    backgroundColor: theme.palette.aiBubble.background,
    borderColor: theme.palette.aiBubble.border,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  aiMessageText: {
    fontSize: 14,
    color: theme.palette.aiBubble.text,
    lineHeight: 20,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  // System Message
  systemMessage: {
    backgroundColor: theme.palette.systemBubble.background,
    borderColor: theme.palette.systemBubble.border,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  systemMessageText: {
    fontSize: 13,
    color: theme.palette.systemBubble.text,
    lineHeight: 19,
    fontStyle: 'italic',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  // Error Message
  errorMessage: {
    backgroundColor: `${theme.palette.error}15`,
    borderColor: theme.palette.error,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  errorMessageText: {
    fontSize: 14,
    color: theme.palette.error,
    lineHeight: 20,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  messagePressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  timestamp: {
    fontSize: 10,
    color: theme.palette.text.disabled,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  // ✅ NEU: Code Block Styles
  messageBubbleWithCode: {
    maxWidth: '95%',
  },
  messagePartsContainer: {
    flex: 1,
    gap: 8,
  },
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
  copyCodeButton: {
    padding: 4,
  },
  codeScrollView: {
    maxHeight: 300,
  },
  codeContent: {
    padding: 10,
    minWidth: '100%',
  },
});

export default MessageItem;
