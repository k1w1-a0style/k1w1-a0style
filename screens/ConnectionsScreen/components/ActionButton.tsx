import React from "react";
import { ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";
import type { ConnectionsStyles, IoniconName } from "./types";

export function ActionButton(props: {
  styles: ConnectionsStyles;
  busy: boolean;
  label: string;
  icon: IoniconName;
  onPress: () => void;
  variant?: "primary" | "ghost";
  loading?: boolean;
  testID?: string;
}) {
  const { styles, busy, label, icon, onPress, variant = "primary", loading, testID } = props;
  const isPrimary = variant === "primary";
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={busy || !!loading}
      style={[
        styles.btn,
        isPrimary ? styles.btnPrimary : styles.btnGhost,
        (busy || loading) && { opacity: 0.65 },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isPrimary ? theme.palette.primary : theme.palette.text.primary}
        />
      ) : (
        <Ionicons
          name={icon}
          size={18}
          color={isPrimary ? theme.palette.primary : theme.palette.text.primary}
        />
      )}
      <Text
        style={[
          styles.btnText,
          isPrimary ? { color: theme.palette.primary } : { color: theme.palette.text.primary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
