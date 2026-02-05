import React from "react";
import { ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";

export function ActionButton(props: {
  styles: any;
  busy: boolean;
  label: string;
  icon: any;
  onPress: () => void;
  variant?: "primary" | "ghost";
  loading?: boolean;
}) {
  const { styles, busy, label, icon, onPress, variant = "primary", loading } = props;
  const isPrimary = variant === "primary";
  return (
    <TouchableOpacity
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
          color={isPrimary ? "#000" : theme.palette.text.primary}
        />
      ) : (
        <Ionicons
          name={icon}
          size={18}
          color={isPrimary ? "#000" : theme.palette.text.primary}
        />
      )}
      <Text style={[styles.btnText, isPrimary ? { color: "#000" } : null]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
