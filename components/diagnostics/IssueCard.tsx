import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../theme";
import { Severity, SeverityBadge } from "./SeverityBadge";

export function IssueCard({
  title,
  message,
  severity,
  hasFix,
  onPress,
}: {
  title: string;
  message?: string;
  severity: Severity;
  hasFix: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.top}>
        <SeverityBadge severity={severity} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
        <Ionicons name={"chevron-forward"} size={18} color={theme.palette.text.muted} />
      </View>

      {message ? (
        <Text style={styles.message} numberOfLines={3}>
          {message}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        {hasFix ? (
          <View style={styles.fixHint}>
            <Ionicons name={"flash"} size={14} color={theme.palette.primaryLight} />
            <Text style={styles.fixHintText}>Fix available</Text>
          </View>
        ) : (
          <Text style={styles.noFix}>No fix</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  message: {
    color: theme.palette.text.secondary,
    marginTop: theme.spacing.sm,
    lineHeight: 18,
  },
  metaRow: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fixHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,0,0.25)",
    backgroundColor: "rgba(0,255,0,0.08)",
  },
  fixHintText: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 12,
  },
  noFix: {
    color: theme.palette.text.muted,
    fontSize: 12,
    fontWeight: "700",
  },
});
