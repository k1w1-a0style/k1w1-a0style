// components/chat/ChatErrorBanner.tsx
import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../theme";
import { styles } from "../../styles/chatScreenStyles";

type Props = {
  message: string | null;
};

const ChatErrorBanner: React.FC<Props> = ({ message }) => {
  if (!message) return null;

  return (
    <View style={styles.errorContainer}>
      <Ionicons name="warning" size={16} color={theme.palette.error} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
};

export default ChatErrorBanner;
