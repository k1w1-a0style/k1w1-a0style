import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { extractGuardHints } from "../../lib/guardHints";
import { recordGuardAuditEvent } from "../../lib/guardAuditTelemetry";
import {
  FileReviewSection,
  GuardWarningsCard,
  ReviewSummaryCard,
  TextSummarySection,
  type ReviewCard,
} from "./ConfirmChangesModalSections";

type Props = {
  visible: boolean;
  pendingChange: PendingChange | null;
  onAccept: () => void;
  onReject: () => void;
};

/** Max characters for the summary display. Prevents UI lag from oversized LLM output. */
const SUMMARY_MAX_CHARS = 6_000;
const MAX_PREVIEW_ITEMS = 6;
const GUARDED_FOLLOW_UP_OPTIONS = [
  {
    key: "A",
    text: "A) Ich kann nur die unkritischen Dateien direkt anwenden und die guarded Pfade als manuelle TODO-Liste ausgeben.",
  },
  {
    key: "B",
    text: "B) Ich kann zuerst eine sichere Minimal-Variante ohne guarded Pfade erzeugen, danach entscheidest du pro Pfad einzeln.",
  },
] as const;

function createGuardAuditSignature(entries: string[]): string {
  if (!entries.length) return "";
  return Array.from(new Set(entries.map((entry) => String(entry).trim().toLowerCase())))
    .filter((entry) => entry.length > 0)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 20)
    .join("||");
}

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

function getValidatorReviewLabel(pendingChange: PendingChange | null): string {
  if (!pendingChange) return "Validator: noch kein Review";

  switch (pendingChange.validatorState) {
    case "validated":
      return "Validator hat die finale Dateiliste nachgeschaerft";
    case "disabled":
      return "Validator war deaktiviert";
    case "builder-fallback-empty":
      return "Validator blieb advisory: keine verwertbare Nachschaerfung";
    case "builder-fallback-error":
      return "Validator blieb advisory: Review-Fehler, Builder-Liste bleibt aktiv";
    case "builder-fallback-exception":
      return "Validator blieb advisory: Exception, Builder-Liste bleibt aktiv";
    default:
      return "Validator blieb advisory ohne finale Uebernahme";
  }
}

const ConfirmChangesModal: React.FC<Props> = ({
  visible,
  pendingChange,
  onAccept,
  onReject,
}) => {
  const modalScale = useRef(new Animated.Value(0.92)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const lastGuardAuditSignatureRef = useRef<string | null>(null);
  const [showPolicyExplain, setShowPolicyExplain] = useState(false);

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
      setShowPolicyExplain(false);
      lastGuardAuditSignatureRef.current = null;
    }
  }, [visible, modalOpacity, modalScale]);

  const previews = useMemo(
    () => pendingChange?.changePreviews?.slice(0, MAX_PREVIEW_ITEMS) ?? [],
    [pendingChange],
  );
  const reviewCards = useMemo<ReviewCard[]>(() => {
    if (!pendingChange) return [];
    const previewMap = new Map(previews.map((preview) => [preview.path, preview]));
    const changedCards = [
      ...pendingChange.created.map((path) => ({
        key: `new:${path}`,
        path,
        status: "new" as const,
        preview: previewMap.get(path),
      })),
      ...pendingChange.updated.map((path) => ({
        key: `updated:${path}`,
        path,
        status: "updated" as const,
        preview: previewMap.get(path),
      })),
    ];
    const skippedCards = pendingChange.skipped.map((path) => ({
      key: `skipped:${path}`,
      path,
      status: "skipped" as const,
    }));
    const structuralCards = [
      ...(pendingChange.deleted ?? []).map((path) => ({
        key: `deleted:${path}`,
        path,
        status: "deleted" as const,
      })),
      ...(pendingChange.renamed ?? []).map(({ from, to }) => ({
        key: `renamed:${from}->${to}`,
        path: from,
        toPath: to,
        status: "renamed" as const,
      })),
    ];

    // Delete/Rename must remain visible even when many create/update cards exist.
    const changedBudget = Math.max(0, MAX_PREVIEW_ITEMS - structuralCards.length);
    return [...changedCards.slice(0, changedBudget), ...structuralCards, ...skippedCards];
  }, [pendingChange, previews]);
  const hiddenPreviewCount = Math.max(
    0,
    (pendingChange?.created.length ?? 0) +
      (pendingChange?.updated.length ?? 0) -
      previews.length,
  );

  const sourceTone = getSourceTone(pendingChange);
  const validatorReviewLabel = getValidatorReviewLabel(pendingChange);
  const summary = pendingChange?.summary ?? "";
  const guardWarnings = useMemo(
    () => extractGuardHints(pendingChange?.errors),
    [pendingChange?.errors],
  );

  useEffect(() => {
    if (!visible || guardWarnings.length === 0) return;
    const signature = createGuardAuditSignature(guardWarnings);
    if (lastGuardAuditSignatureRef.current === signature) return;
    lastGuardAuditSignatureRef.current = signature;
    void recordGuardAuditEvent(guardWarnings).catch((error) => {
      console.warn("[ConfirmChangesModal] guard audit telemetry failed", error);
    });
  }, [guardWarnings, visible]);

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
            <Ionicons name="git-compare" size={28} color={theme.palette.primary} />
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalTitle}>Änderungen bestätigen</Text>
              <Text style={[styles.modalMetaPill, sourceTone.tone]}>{sourceTone.label}</Text>
            </View>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator bounces={false}>
            {pendingChange ? (
              <>
                <ReviewSummaryCard
                  pendingChange={pendingChange}
                  validatorReviewLabel={validatorReviewLabel}
                />
                <FileReviewSection
                  reviewCards={reviewCards}
                  hiddenPreviewCount={hiddenPreviewCount}
                />

                {pendingChange.skipped.length ? (
                  <View style={styles.modalSummaryCard}>
                    <Text style={styles.modalSectionTitle}>Übersprungen</Text>
                    {pendingChange.skipped.map((path) => (
                      <Text key={path} style={styles.modalHintText}>• {path}</Text>
                    ))}
                  </View>
                ) : null}

                {pendingChange.errors?.length ? (
                  <View style={styles.modalSummaryCard}>
                    <Text style={styles.modalSectionTitle}>Geblockt / Hinweise</Text>
                    {pendingChange.errors.map((entry) => (
                      <Text key={entry} style={styles.modalHintText}>• {entry}</Text>
                    ))}
                  </View>
                ) : null}

                <GuardWarningsCard
                  guardWarnings={guardWarnings}
                  showPolicyExplain={showPolicyExplain}
                  onTogglePolicyExplain={() => setShowPolicyExplain((prev) => !prev)}
                  guardedFollowUpOptions={GUARDED_FOLLOW_UP_OPTIONS}
                />

                <TextSummarySection
                  summary={summary}
                  summaryMaxChars={SUMMARY_MAX_CHARS}
                />
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
              <Ionicons name="close-circle" size={20} color={theme.palette.error} />
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
