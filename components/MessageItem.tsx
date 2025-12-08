// components/MessageItem.tsx - Optimierte Chat Bubble + Rich Context
import React, { memo, useCallback, useMemo } from 'react';
import { Text, Pressable, StyleSheet, Alert, View, Platform } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../theme';
import { ChatMessage, BuilderContextData } from '../contexts/types';
import RichContextMessage from './RichContextMessage';

type MessageItemProps = {
  message: ChatMessage;
  /** Deaktiviert Animation für bessere Performance bei vielen Nachrichten */
  disableAnimation?: boolean;
};

// Stable signature generator for context comparison
const getContextSignature = (ctx?: BuilderContextData): string => {
  if (!ctx) return '';

  const filesLen = Array.isArray(ctx.files) ? ctx.files.length : 0;
  const changesLen = Array.isArray(ctx.changes)
    ? ctx.changes.length
    : Array.isArray(ctx.filesChanged)
      ? ctx.filesChanged.length
      : 0;

  return [
    ctx.provider ?? '',
    ctx.model ?? '',
    typeof ctx.duration === 'number' ? String(ctx.duration) : '',
    typeof ctx.totalLines === 'number' ? String(ctx.totalLines) : '',
    typeof ctx.keysRotated === 'number' ? String(ctx.keysRotated) : '',
    ctx.summary ?? '',
    ctx.quality ?? '',
    typeof ctx.messageCount === 'number' ? String(ctx.messageCount) : '',
    String(filesLen),
    String(changesLen),
  ].join('|');
};

// Optimized props comparison
const arePropsEqual = (
  prevProps: MessageItemProps,
  nextProps: MessageItemProps,
): boolean => {
  const prev = prevProps.message;
  const next = nextProps.message;

  // Check disableAnimation flag
  if (prevProps.disableAnimation !== nextProps.disableAnimation) return false;

  // Same reference = no change
  if (prev === next) return true;

  // Core fields comparison
  if (prev.id !== next.id) return false;
  if (prev.role !== next.role) return false;
  if (prev.content !== next.content) return false;
  if (prev.timestamp !== next.timestamp) return false;

  const prevMeta = prev.meta;
  const nextMeta = next.meta;

  // Both undefined = equal
  if (!prevMeta && !nextMeta) return true;
  // One undefined = different
  if (!!prevMeta !== !!nextMeta) return false;

  // Provider comparison
  if ((prevMeta?.provider ?? '') !== (nextMeta?.provider ?? '')) return false;
  // Error state comparison
  if ((prevMeta?.error ?? '') !== (nextMeta?.error ?? '')) return false;

  // Context signature comparison
  return getContextSignature(prevMeta?.context) === getContextSignature(nextMeta?.context);
};

/** Formatiert den Timestamp lesbar */
const formatTime = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const MessageItem: React.FC<MessageItemProps> = ({ message, disableAnimation = false }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isError = Boolean(message.meta?.error);
  const messageText = String(message.content ?? '');

  const handleLongPress = useCallback(() => {
    if (messageText) {
      Clipboard.setStringAsync(messageText);
      Alert.alert('Kopiert', 'Nachricht in Zwischenablage kopiert');
    }
  }, [messageText]);

  const hasContext = useMemo(() => !!message?.meta?.context, [message?.meta?.context]);
  const timeString = useMemo(() => formatTime(message.timestamp), [message.timestamp]);

  // Memoized bubble style
  const bubbleStyle = useMemo(() => {
    if (isError) return styles.errorMessage;
    if (isUser) return styles.userMessage;
    if (isSystem) return styles.systemMessage;
    return styles.aiMessage;
  }, [isUser, isSystem, isError]);

  const textStyle = useMemo(() => {
    if (isError) return styles.errorMessageText;
    if (isUser) return styles.userMessageText;
    if (isSystem) return styles.systemMessageText;
    return styles.aiMessageText;
  }, [isUser, isSystem, isError]);

  // Animation nur für neue Nachrichten (Performance)
  const entering = disableAnimation ? undefined : FadeInDown.duration(200).springify();

  const content = (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.messageBubble,
          bubbleStyle,
          pressed && styles.messagePressed,
        ]}
        onLongPress={handleLongPress}
        delayLongPress={400}
        accessibilityRole="text"
        accessibilityLabel={`${isUser ? 'Deine' : isSystem ? 'System' : 'KI'} Nachricht: ${messageText}`}
        accessibilityHint="Lange drücken zum Kopieren"
      >
        {/* Error Icon */}
        {isError && (
          <View style={styles.errorHeader}>
            <Ionicons name="alert-circle" size={14} color={theme.palette.error} />
            <Text style={styles.errorLabel}>Fehler</Text>
          </View>
        )}

        {/* Message Text */}
        <Text style={textStyle} selectable>
          {messageText || ' '}
        </Text>

        {/* Footer mit Provider und Timestamp */}
        {!isUser && (
          <View style={styles.messageFooter}>
            {message?.meta?.provider && (
              <Text style={styles.providerTag}>{message.meta.provider}</Text>
            )}
            {timeString && (
              <Text style={styles.timestampTag}>{timeString}</Text>
            )}
          </View>
        )}

        {/* User Message Timestamp */}
        {isUser && timeString && (
          <Text style={styles.userTimestamp}>{timeString}</Text>
        )}
      </Pressable>

      {/* Rich Context für KI-Nachrichten */}
      {!isUser && !isSystem && hasContext && (
        <RichContextMessage context={message.meta?.context ?? null} />
      )}
    </>
  );

  // Wrap in Animated.View nur wenn Animation aktiv
  if (disableAnimation) {
    return (
      <View style={[styles.rowWrapper, isUser ? styles.rowWrapperUser : styles.rowWrapperAI]}>
        {content}
      </View>
    );
  }

  return (
    <Animated.View
      entering={entering}
      style={[styles.rowWrapper, isUser ? styles.rowWrapperUser : styles.rowWrapperAI]}
    >
      {content}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  rowWrapper: {
    width: '100%',
    paddingHorizontal: 12,
    marginVertical: 6,
  },
  rowWrapperUser: {
    alignItems: 'flex-end',
  },
  rowWrapperAI: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '88%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  messagePressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },

  // Message Types
  userMessage: {
    backgroundColor: theme.palette.primarySoft,
    borderColor: theme.palette.primary,
    borderBottomRightRadius: 4,
  },
  aiMessage: {
    backgroundColor: theme.palette.surface,
    borderColor: theme.palette.border,
    borderBottomLeftRadius: 4,
  },
  systemMessage: {
    backgroundColor: theme.palette.warningSoft,
    borderColor: theme.palette.warning,
    maxWidth: '95%',
    alignSelf: 'center',
  },
  errorMessage: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderColor: theme.palette.error,
    borderBottomLeftRadius: 4,
  },

  // Text Styles
  userMessageText: {
    fontSize: 14,
    color: theme.palette.text.primary,
    lineHeight: 21,
  },
  aiMessageText: {
    fontSize: 14,
    color: theme.palette.text.primary,
    lineHeight: 21,
  },
  systemMessageText: {
    fontSize: 13,
    color: theme.palette.warning,
    lineHeight: 19,
    textAlign: 'center',
  },
  errorMessageText: {
    fontSize: 14,
    color: theme.palette.error,
    lineHeight: 21,
  },

  // Error Header
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 68, 68, 0.2)',
  },
  errorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.palette.error,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Footer
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.palette.border,
    gap: 8,
  },
  providerTag: {
    fontSize: 9,
    color: theme.palette.text.muted,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timestampTag: {
    fontSize: 9,
    color: theme.palette.text.muted,
  },
  userTimestamp: {
    marginTop: 4,
    fontSize: 9,
    color: theme.palette.text.muted,
    alignSelf: 'flex-end',
  },
});

export default memo(MessageItem, arePropsEqual);
