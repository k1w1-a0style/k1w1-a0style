import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../theme";

export function InlineToast({
  message,
  anim,
}: {
  message: string | null;
  anim: Animated.Value;
}): React.ReactElement | null {
  if (!message) return null;
  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
            },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.row}>
        <Ionicons name="checkmark-circle" size={16} color={theme.palette.success} />
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.palette.backgroundDark,
    borderColor: "rgba(0,255,0,0.25)",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 13,
  },
});
