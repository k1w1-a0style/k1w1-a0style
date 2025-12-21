// components/chat/ChatLoadingOverlay.tsx
import React from "react";
import { View, Text, ActivityIndicator, Animated } from "react-native";

import { theme } from "../../theme";
import { styles } from "../../styles/chatLoadingStyles";

type Props = {
  visible: boolean;
  thinkingOpacity: Animated.Value;
  thinkingScale: Animated.Value;
};

const ChatLoadingOverlay: React.FC<Props> = ({
  visible,
  thinkingOpacity,
  thinkingScale,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.loadingOverlay}>
      <Animated.View
        style={{
          opacity: thinkingOpacity,
          transform: [{ scale: thinkingScale }],
        }}
      >
        <ActivityIndicator size="large" color={theme.palette.primary} />
        <Text style={styles.loadingOverlayText}>
          🧠 Projekt und Chat werden geladen...
        </Text>
      </Animated.View>
    </View>
  );
};

export default ChatLoadingOverlay;
