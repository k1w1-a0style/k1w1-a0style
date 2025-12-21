// components/chat/ChatLoadingFooter.tsx
import React from "react";
import { View, Text, ActivityIndicator, Animated } from "react-native";

import { theme } from "../../theme";
import { styles } from "../../styles/chatLoadingStyles";

type Props = {
  visible: boolean;
  isStreaming: boolean;
  streamingMessage: string;
  thinkingOpacity: Animated.Value;
  thinkingScale: Animated.Value;
  typingDot1: Animated.Value;
  typingDot2: Animated.Value;
  typingDot3: Animated.Value;
};

const ChatLoadingFooter: React.FC<Props> = ({
  visible,
  isStreaming,
  streamingMessage,
  thinkingOpacity,
  thinkingScale,
  typingDot1,
  typingDot2,
  typingDot3,
}) => {
  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.loadingFooter,
        {
          opacity: thinkingOpacity,
          transform: [{ scale: thinkingScale }],
        },
      ]}
    >
      <ActivityIndicator size="small" color={theme.palette.primary} />

      <View style={{ flex: 1 }}>
        {isStreaming ? (
          <>
            <Text style={styles.loadingText}>🤖 KI schreibt…</Text>
            <Text style={styles.streamingText}>{streamingMessage}</Text>
          </>
        ) : (
          <Text style={styles.loadingText}>🧠 KI denkt nach...</Text>
        )}
      </View>

      <View style={styles.thinkingDots}>
        <Animated.View
          style={[
            styles.thinkingDot,
            {
              opacity: typingDot1.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1],
              }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.thinkingDot,
            {
              opacity: typingDot2.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1],
              }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.thinkingDot,
            {
              opacity: typingDot3.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1],
              }),
            },
          ]}
        />
      </View>
    </Animated.View>
  );
};

export default ChatLoadingFooter;
