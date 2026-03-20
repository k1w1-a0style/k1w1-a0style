import React, { useEffect, useMemo, useRef } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { PendingChange } from "../../hooks/chatAIFlowTypes";
import { theme } from "../../theme";
import { styles } from "../../styles/chatScreenStyles";

type Props = {
  visible: boolean;
  pendingChange: PendingChange | null;
  onAccept: () => void;
  onReject: () => void;
};

/** Max characters for the summary display. Prevents UI lag from oversized LLM output. */
const SUMMARY_MAX_CHARS = 6_000;
const MAX_PREVIEW_ITEMS = 6;

function getSourceTone(pendingChange: PendingChange | null) {
  if (!pendingChange) return { label: "Noch kein Vorschlag", tone: styles.modalMetaNeutral };
  if (pendingChange.finalFileSource === "validator") {
    return {
      label: "Finale Dateiliste: Validator-Review (advisory)",
      tone: styles.modalMetaSuccess,
    };
  }
  if (pendingChange.validatorState === "disabled" || !pendingChange.validatorState) {
    return {
      label: "Finale Dateiliste: Builder direkt (ohne Validator)",
      tone: styles.modalMetaNeutral,
    };
  }
  return {
    label: "Finale Dateiliste: Builder direkt (Validator nur advisory/fallback)",
    tone: styles.modalMetaWarning,
  };
}

const ConfirmChangesModal: React.FC<Props> = ({
  visible,
  pendingChange,
  onAccept,
  onReject,
}) => {
  const modalScale = useRef(new Animated.Value(0.92)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.spring(modalScale, {
          toValue: 1,
          friction: 10,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      modalScale.setValue(0.92);
      modalOpacity.setValue(0);
    }
  }, [visible, modalOpacity, modalScale]);

  const previews = useMemo(
    () => pendingChange?.changePreviews?.slice(0, MAX_PREVIEW_ITEMS) ?? [],
    [pendingChange],
  );

  const sourceTone = getSourceTone(pendingChange);
  const summary = pendingChange?.summary ?? "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onReject}
      accessibilityViewIsModal
    >
      <Animated.View style={[styles.modalOverlay, { opacity: modalOpacity }]}>
        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ scale: modalScale }], opacity: modalOpacity },
          ]}
          accessibilityRole="alert"
          accessibilityLabel="Änderungen bestätigen"
        >
          <View style={styles.modalHeader}>
            <Ionicons
              name="git-compare"
              size={28}
              color={theme.palette.primary}
            />
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalTitle}>Änderungen bestätigen</Text>
              <Text style={[styles.modalMetaPill, sourceTone.tone]}>{sourceTone.label}</Text>
            </View>
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator
            bounces={false}
          >
            {pendingChange ? (
              <>
                <View style={styles.modalSummaryCard}>
                  <Text style={styles.modalSummaryTitle}>Review-Zusammenfassung</Text>
                  <Text style={styles.modalSummaryText}>
                    {pendingChange.sourceSummary ?? "Dateiliste stammt aus dem Builder-Flow."}
                  </Text>
                  <Text style={styles.modalSummaryText}>
                    Neue Dateien: {pendingChange.created.length} · Geänderte Dateien: {pendingChange.updated.length} · Hinweise: {pendingChange.errors?.length ?? 0}
                  </Text>
                </View>

                <Text style={styles.modalSectionTitle}>Delta-Vorschau</Text>
                {previews.length === 0 ? (
                  <Text style={styles.modalEmptyText}>Keine reviewbaren Inhaltsänderungen gefunden.</Text>
                ) : (
                  previews.map((preview) => (
                    <View key={`${preview.kind}:${preview.path}`} style={styles.modalDiffCard}>
                      <View style={styles.modalDiffHeader}>
                        <Text style={styles.modalDiffPath}>{preview.path}</Text>
                        <Text style={styles.modalDiffKind}>
                          {preview.kind === "new" ? "Neue Datei" : "Änderung"}
                        </Text>
                      </View>

                      {preview.kind === "new" ? (
                        <>
                          <Text style={styles.modalDiffLabel}>Vorschau</Text>
                          <Text style={styles.modalCodeBlock}>{preview.preview}</Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.modalDiffLabel}>Kompakter Diff-Ausschnitt</Text>
                          <Text style={styles.modalCodeBlock}>{preview.diffSnippet}</Text>
                          <View style={styles.modalBeforeAfterRow}>
                            <View style={styles.modalBeforeAfterCol}>
                              <Text style={styles.modalDiffLabel}>Vorher</Text>
                              <Text style={styles.modalCodeBlock}>{preview.beforeSnippet}</Text>
                            </View>
                            <View style={styles.modalBeforeAfterCol}>
                              <Text style={styles.modalDiffLabel}>Nachher</Text>
                              <Text style={styles.modalCodeBlock}>{preview.afterSnippet}</Text>
                            </View>
                          </View>
                        </>
                      )}

                      {preview.truncated ? (
                        <Text style={styles.modalHintText}>Ausschnitt hart gekürzt, damit das Review kompakt bleibt.</Text>
                      ) : null}
                    </View>
                  ))
                )}

                {pendingChange.errors?.length ? (
                  <View style={styles.modalSummaryCard}>
                    <Text style={styles.modalSectionTitle}>Geblockt / Hinweise</Text>
                    {pendingChange.errors.map((entry) => (
                      <Text key={entry} style={styles.modalHintText}>• {entry}</Text>
                    ))}
                  </View>
                ) : null}

                <Text style={styles.modalSectionTitle}>Text-Zusammenfassung</Text>
                <Text style={styles.modalText}>
                  {summary.length > SUMMARY_MAX_CHARS
                    ? summary.slice(0, SUMMARY_MAX_CHARS) + "\n\n… (Text gekürzt)"
                    : summary}
                </Text>
              </>
            ) : (
              <Text style={styles.modalEmptyText}>Noch keine Änderungen zum Bestätigen.</Text>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonReject]}
              onPress={onReject}
              activeOpacity={0.85}
              accessibilityLabel="Änderungen ablehnen"
              accessibilityRole="button"
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.palette.error}
              />
              <Text style={styles.modalButtonTextReject}>Ablehnen</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonAccept]}
              onPress={onAccept}
              activeOpacity={0.85}
              accessibilityLabel="Änderungen bestätigen und anwenden"
              accessibilityRole="button"
            >
              <Ionicons name="checkmark-circle" size={20} color="#000" />
              <Text style={styles.modalButtonTextAccept}>Bestätigen</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default ConfirmChangesModal;
