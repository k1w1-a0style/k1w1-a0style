import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../theme";

export type Severity = "critical" | "warning" | "info" | "pass";
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const META: Record<Severity, { label: string; icon: IoniconName; color: string; bg: string }> = {
  critical: {
    label: "Critical",
    icon: "alert-circle",
    color: theme.palette.error,
    bg: "rgba(255, 68, 68, 0.12)",
  },
  warning: {
    label: "Warning",
    icon: "warning",
    color: theme.palette.warning,
    bg: "rgba(255, 170, 0, 0.12)",
  },
  info: {
    label: "Info",
    icon: "information-circle",
    color: theme.palette.info,
    bg: "rgba(0, 170, 255, 0.12)",
  },
  pass: {
    label: "OK",
    icon: "checkmark-circle",
    color: theme.palette.success,
    bg: "rgba(0, 255, 0, 0.10)",
  },
};

export function SeverityBadge({ severity }: { severity: Severity }): React.ReactElement {
  const m = META[severity];
  return (
    <View style={[styles.badge, { backgroundColor: m.bg, borderColor: m.color }]}> 
      <Ionicons name={m.icon} size={14} color={m.color} />
      <Text style={[styles.text, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
