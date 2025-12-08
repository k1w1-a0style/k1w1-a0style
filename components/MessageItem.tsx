// components/MessageItem.tsx - Chat Bubble + Rich Context
import React, { memo, useCallback } from 'react';
import { Text, Pressable, StyleSheet, Alert } from 'react-native';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../theme';
import { ChatMessage, BuilderContextData } from '../contexts/types';
import RichContextMessage from './RichContextMessage';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type MessageItemProps = {
  message: ChatMessage;
};

const getContextSignature = (ctx?: BuilderContextData) => {
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

const arePropsEqual = (
  prevProps: MessageItemProps,
  nextProps: MessageItemProps,
) => {
  const prev = prevProps.message;
  const next = nextProps.message;

  if (prev === next) return true;

  // Kernfelder
  if (prev.id !== next.id) return false;
  if (prev.role !== next.role) return false;
  if (prev.content !== next.content) return false;
  if (prev.timestamp !== next.timestamp) return false;

  const prevMeta = prev.meta;
  const nextMeta = next.meta;

  if (!prevMeta && !nextMeta) return true;
  if (!!prevMeta !== !!nextMeta) return false;

  // Flache Meta-Vergleiche
  if ((prevMeta?.provider ?? '') !== (nextMeta?.provider ?? '')) return false;
  if (!!prevMeta?.error !== !!nextMeta?.error) return false;

  // Kontext-Signatur (billig + stabil)
  const prevSig = getContextSignature(prevMeta?.context);
  const nextSig = getContextSignature(nextMeta?.context);

  return prevSig === nextSig;
};

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const messageText = String(message.content ?? '');

  const handleLongPress = useCallback(() => {
    if (messageText) {
      Clipboard.setStringAsync(messageText);
      Alert.alert('Kopiert');
    }
  }, [messageText]);

  const hasContext = !!message?.meta?.context;

  return (
    <Animated.View
      entering={
        isUser
          ? FadeInRight.duration(400).springify()
          : FadeInLeft.duration(400).springify()
      }
      style={[
        styles.rowWrapper,
        isUser ? styles.rowWrapperUser : styles.rowWrapperAI,
      ]}
    >
      <AnimatedPressable
        style={({ pressed }) => [
          styles.messageBubble,
          isUser ? styles.userMessage : styles.aiMessage,
          pressed && styles.messagePressed,
        ]}
        onLongPress={handleLongPress}
        delayLongPress={300}
      >
        <Text
          style={isUser ? styles.userMessageText : styles.aiMessageText}
          selectable
        >
          {messageText || '‎'}
        </Text>

        {!isUser && message?.meta?.provider ? (
          <Text style={styles.providerTag}>
            {message.meta.provider}
          </Text>
        ) : null}
      </AnimatedPressable>

      {!isUser && hasContext ? (
        <RichContextMessage context={message.meta?.context ?? null} />
      ) : null}
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

  providerTag: {
    marginTop: 6,
    fontSize: 9,
    color: theme.palette.text.muted,
    alignSelf: 'flex-end',
  },
});

export default memo(MessageItem, arePropsEqual);
