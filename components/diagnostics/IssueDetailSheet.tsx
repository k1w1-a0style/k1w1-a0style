import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,

  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../theme";
import { Severity, SeverityBadge } from "./SeverityBadge";

import { styles } from "./IssueDetailSheet.styles";

export type IssueDetail = {
  title: string;
  message?: string;
  details?: string[];
  severity: Severity;
  hasFix: boolean;
  fixLabel?: string;
};

export function IssueDetailSheet({
  visible,
  issue,
  onClose,
  onApplyFix,
  onPreview,
  busy,
  onSendToChat,
}: {
  visible: boolean;
  issue: IssueDetail | null;
  onClose: () => void;
  onApplyFix: () => void;
  onPreview: () => void;
  busy?: boolean;
  onSendToChat?: () => void;
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
                <Text style={styles.primaryText}>{issue.fixLabel || "Auto-Fix anwenden"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryBtn, busy && { opacity: 0.6 }]}
                onPress={onPreview}
                disabled={!!busy}
              >
                <Ionicons name="eye" size={16} color={theme.palette.text.primary} />
                <Text style={styles.secondaryText}>Patch Vorschau</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryBtn, busy && { opacity: 0.6 }]}
                onPress={onSendToChat}
                disabled={!!busy || !onSendToChat}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.palette.text.primary} />
                <Text style={styles.secondaryText}>An KI senden</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.noFixRow}>
                <Ionicons name="information-circle" size={16} color={theme.palette.text.muted} />
                <Text style={styles.noFixText}>Kein Auto-Fix vorhanden.</Text>
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
                onPress={onSendToChat}
                disabled={!!busy || !onSendToChat}
              >
                <Ionicons name="sparkles-outline" size={16} color={theme.palette.text.primary} />
                <Text style={styles.primaryText}>KI-Fix anfragen</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

