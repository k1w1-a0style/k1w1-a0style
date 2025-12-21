// components/chat/ChatScrollToBottomButton.tsx
import React from "react";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../theme";
import { styles } from "../../styles/chatScreenStyles";

type Props = {
  visible: boolean;
  bottom: number;
  onPress: () => void;
};

const ChatScrollToBottomButton: React.FC<Props> = ({
  visible,
  bottom,
  onPress,
}) => {
  if (!visible) return null;

  return (
    <TouchableOpacity
      style={[styles.scrollToBottomButton, { bottom }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name="arrow-down" size={20} color={theme.palette.background} />
    </TouchableOpacity>
  );
};

export default ChatScrollToBottomButton;
