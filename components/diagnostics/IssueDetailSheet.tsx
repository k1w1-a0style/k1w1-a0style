import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../theme";
import { Severity, SeverityBadge } from "./SeverityBadge";

export type IssueDetail = {
  title: string;
  message?: string;
  details?: string[];
  severity: Severity;
  hasFix: boolean;
};

export function IssueDetailSheet({
  visible,
  issue,
  onClose,
  onApplyFix,
  onPreview,
  busy,
}: {
  visible: boolean;
  issue: IssueDetail | null;
  onClose: () => void;
  onApplyFix: () => void;
  onPreview: () => void;
  busy?: boolean;
}): React.ReactElement {
  const translate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const openAnim = () => {
    translate.setValue(16);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const closeAnim = (cb: () => void) => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(translate, { toValue: 16, duration: 140, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) cb();
    });
  };

  useEffect(() => {
    if (visible) openAnim();
  }, [visible]);

  const safeDetails = useMemo(() => (issue?.details ?? []).filter(Boolean).slice(0, 10), [issue]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => closeAnim(onClose)}
    >
      <Pressable style={styles.backdrop} onPress={() => closeAnim(onClose)}>
        <Animated.View style={[styles.backdropShade, { opacity }]} />
      </Pressable>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: translate }] }]}> 
        <View style={styles.grab} />

        <View style={styles.header}>
          <SeverityBadge severity={(issue?.severity ?? "info") as Severity} />
          <TouchableOpacity
            style={[styles.iconBtn, busy && { opacity: 0.5 }]}
            onPress={() => closeAnim(onClose)}
            disabled={!!busy}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={18} color={theme.palette.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: theme.spacing.lg }}>
          <Text style={styles.title}>{issue?.title ?? ""}</Text>
          {issue?.message ? <Text style={styles.message}>{issue.message}</Text> : null}

          {safeDetails.length ? (
            <View style={styles.detailsBox}>
              <Text style={styles.detailsTitle}>Details</Text>
              {safeDetails.map((d, idx) => (
                <Text key={`${idx}`} style={styles.detailLine}>
                  • {d}
                </Text>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          {issue?.hasFix ? (
            <>
              <TouchableOpacity
                style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
                onPress={onApplyFix}
                disabled={!!busy}
              >
                <Ionicons name="flash" size={16} color={theme.palette.text.primary} />
                <Text style={styles.primaryText}>Apply Fix</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryBtn, busy && { opacity: 0.6 }]}
                onPress={onPreview}
                disabled={!!busy}
              >
                <Ionicons name="eye" size={16} color={theme.palette.text.primary} />
                <Text style={styles.secondaryText}>Preview</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.noFixRow}>
              <Ionicons name="information-circle" size={16} color={theme.palette.text.muted} />
              <Text style={styles.noFixText}>No automatic fix available.</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.palette.card,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    padding: theme.spacing.md,
  },
  grab: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.palette.border,
    marginBottom: theme.spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.palette.backgroundDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
  },
  title: {
    marginTop: theme.spacing.sm,
    color: theme.palette.text.primary,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  message: {
    marginTop: theme.spacing.sm,
    color: theme.palette.text.secondary,
    lineHeight: 20,
  },
  detailsBox: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.backgroundDark,
  },
  detailsTitle: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    marginBottom: theme.spacing.sm,
  },
  detailLine: {
    color: theme.palette.text.secondary,
    lineHeight: 18,
  },
  actions: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.palette.primaryDark,
  },
  primaryText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 14,
  },
  secondaryBtn: {
    width: 120,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: theme.borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.backgroundDark,
  },
  secondaryText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 14,
  },
  noFixRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.backgroundDark,
  },
  noFixText: {
    color: theme.palette.text.secondary,
    fontWeight: "800",
  },
});
