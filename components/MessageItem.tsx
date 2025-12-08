// components/MessageItem.tsx - Optimierte Chat Bubble + Rich Context
import React, { memo, useCallback, useMemo } from 'react';
import { Text, Pressable, StyleSheet, Alert, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../theme';
import { ChatMessage, BuilderContextData } from '../contexts/types';
import RichContextMessage from './RichContextMessage';

type MessageItemProps = {
  message: ChatMessage;
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
  if (!!prevMeta?.error !== !!nextMeta?.error) return false;

  // Context signature comparison
  return getContextSignature(prevMeta?.context) === getContextSignature(nextMeta?.context);
};

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const messageText = String(message.content ?? '');

  const handleLongPress = useCallback(() => {
    if (messageText) {
      Clipboard.setStringAsync(messageText);
      Alert.alert('Kopiert', 'Nachricht in Zwischenablage kopiert');
    }
  }, [messageText]);

  const hasContext = useMemo(() => !!message?.meta?.context, [message?.meta?.context]);

  // Memoized bubble style
  const bubbleStyle = useMemo(() => {
    if (isUser) return styles.userMessage;
    if (isSystem) return styles.systemMessage;
    return styles.aiMessage;
  }, [isUser, isSystem]);

  const textStyle = useMemo(() => {
    if (isUser) return styles.userMessageText;
    if (isSystem) return styles.systemMessageText;
    return styles.aiMessageText;
  }, [isUser, isSystem]);

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      style={[
        styles.rowWrapper,
        isUser ? styles.rowWrapperUser : styles.rowWrapperAI,
      ]}
    >
      <Pressable
        style={({ pressed }) => [
          styles.messageBubble,
          bubbleStyle,
          pressed && styles.messagePressed,
        ]}
        onLongPress={handleLongPress}
        delayLongPress={400}
      >
        <Text style={textStyle} selectable>
          {messageText || ' '}
        </Text>

        {!isUser && !isSystem && message?.meta?.provider && (
          <Text style={styles.providerTag}>{message.meta.provider}</Text>
        )}
      </Pressable>

      {!isUser && !isSystem && hasContext && (
        <RichContextMessage context={message.meta?.context ?? null} />
      )}
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
    maxWidth: '86%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  messagePressed: {
    opacity: 0.86,
  },

  userMessage: {
    backgroundColor: theme.palette.primarySoft,
    borderColor: theme.palette.primary,
  },
  aiMessage: {
    backgroundColor: theme.palette.surface,
    borderColor: theme.palette.border,
  },
  systemMessage: {
    backgroundColor: theme.palette.warningSoft,
    borderColor: theme.palette.warning,
  },

  userMessageText: {
    fontSize: 14,
    color: theme.palette.text.primary,
    lineHeight: 20,
  },
  aiMessageText: {
    fontSize: 14,
    color: theme.palette.text.primary,
    lineHeight: 20,
  },
  systemMessageText: {
    fontSize: 13,
    color: theme.palette.warning,
    lineHeight: 18,
  },

  providerTag: {
    marginTop: 6,
    fontSize: 9,
    color: theme.palette.text.muted,
    alignSelf: 'flex-end',
  },
});

export default memo(MessageItem, arePropsEqual);
