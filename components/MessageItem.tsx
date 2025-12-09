import React, { memo, useEffect, useRef } from 'react';
import { Text, Pressable, StyleSheet, Alert, Animated, View, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { theme, getNeonGlow } from '../theme';

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

type MessageItemProps = {
  message: ChatMessage;
};

const MessageItem = memo(({ message }: MessageItemProps) => {
  const messageText = message?.content?.trim() ?? '';
  const isUser = message?.role === 'user';
  const isSystem = message?.role === 'system';
  const isError = message?.meta?.error;
  
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
        ]}
        onLongPress={handleLongPress}
      >
        <View style={styles.messageContent}>
          {getIcon()}
          <Text style={getTextStyle()}>
            {messageText || '...'}
          </Text>
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
});

export default MessageItem;
