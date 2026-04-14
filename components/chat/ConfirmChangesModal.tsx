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
import type { ChangePreview } from "../../lib/changePreview";
import { extractGuardHints } from "../../lib/guardHints";
import { recordGuardAuditEvent } from "../../lib/guardAuditTelemetry";

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

type ReviewCard =
  | { key: string; path: string; status: "new" | "updated"; preview?: ChangePreview }
  | { key: string; path: string; status: "skipped" | "deleted"; preview?: ChangePreview }
  | { key: string; path: string; toPath: string; status: "renamed"; preview?: ChangePreview };

function getReviewPathChip(status: ReviewCard["status"]): "wird geändert" | "manuell nötig" {
  return status === "skipped" ? "manuell nötig" : "wird geändert";
}

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
    return [
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
      ...pendingChange.skipped.map((path) => ({
        key: `skipped:${path}`,
        path,
        status: "skipped" as const,
      })),
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
    ].slice(0, MAX_PREVIEW_ITEMS + pendingChange.skipped.length);
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
                    Neue Dateien: {pendingChange.created.length} · Geänderte Dateien: {pendingChange.updated.length} · Gelöscht: {pendingChange.deleted?.length ?? 0} · Umbenannt: {pendingChange.renamed?.length ?? 0} · Hinweise: {pendingChange.errors?.length ?? 0}
                  </Text>
                  <View style={styles.modalMetaGrid}>
                    <View style={styles.modalMetaRow}>
                      <Text style={styles.modalMetaLabel}>Builder</Text>
                      <Text style={styles.modalMetaValue}>Erstellt den ersten Dateivorschlag.</Text>
                    </View>
                    <View style={styles.modalMetaRow}>
                      <Text style={styles.modalMetaLabel}>Validator-Hinweis</Text>
                      <Text style={styles.modalMetaValue}>{validatorReviewLabel}</Text>
                    </View>
                    <View style={styles.modalMetaRow}>
                      <Text style={styles.modalMetaLabel}>Finale Quelle</Text>
                      <Text style={styles.modalMetaValue}>
                        {pendingChange.finalFileSource === "validator"
                          ? "Finale Liste kommt aus dem Validator-Review."
                          : "Finale Liste bleibt beim Builder-Vorschlag."}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.modalSectionTitle}>Datei-Review</Text>
                {reviewCards.length === 0 ? (
                  <Text style={styles.modalEmptyText}>Keine reviewbaren Dateiänderungen gefunden.</Text>
                ) : (
                  reviewCards.map((card) => (
                    <View key={card.key} style={styles.modalDiffCard}>
                      <View style={styles.modalDiffHeader}>
                        <Text style={styles.modalDiffPath}>{card.path}</Text>
                        <Text
                          style={[
                            styles.modalDiffKind,
                            card.status === "skipped"
                              ? styles.modalDiffKindSkipped
                              : card.status === "updated"
                                ? styles.modalDiffKindUpdated
                                : styles.modalDiffKindNew,
                          ]}
                        >
                          {card.status === "new"
                            ? "Neue Datei"
                            : card.status === "updated"
                              ? "Geänderte Datei"
                              : card.status === "deleted"
                                ? "Gelöscht"
                                : card.status === "renamed"
                                  ? "Umbenannt"
                                  : "Übersprungen"}
                        </Text>
                      </View>
                      <View style={styles.modalPathChipRow}>
                        <View
                          style={[
                            styles.modalPathChip,
                            card.status === "skipped"
                              ? styles.modalPathChipManual
                              : styles.modalPathChipChange,
                          ]}
                        >
                          <Text style={styles.modalPathChipText}>
                            {getReviewPathChip(card.status)}
                          </Text>
                        </View>
                      </View>

                      {card.status === "skipped" ? (
                        <Text style={styles.modalHintText}>
                          Diese Datei wurde bewusst nicht in den finalen Apply-Satz übernommen.
                        </Text>
                      ) : card.status === "deleted" ? (
                        <Text style={styles.modalHintText}>
                          Diese Datei wird im finalen Apply-Satz gelöscht.
                        </Text>
                      ) : card.status === "renamed" ? (
                        <Text style={styles.modalHintText}>
                          Diese Datei wird umbenannt nach: {"toPath" in card ? card.toPath : ""}
                        </Text>
                      ) : card.preview?.kind === "new" ? (
                        <>
                          <Text style={styles.modalDiffLabel}>Neue Datei · kompakte Inhaltsvorschau</Text>
                          <Text style={styles.modalCodeBlock}>{card.preview.preview}</Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.modalDiffLabel}>Delta · kompakter Diff-Ausschnitt</Text>
                          <Text style={styles.modalCodeBlock}>{card.preview?.diffSnippet ?? "Kein Diff-Ausschnitt verfügbar."}</Text>
                          <View style={styles.modalBeforeAfterRow}>
                            <View style={styles.modalBeforeAfterCol}>
                              <Text style={styles.modalDiffLabel}>Vorher</Text>
                              <Text style={styles.modalCodeBlock}>
                                {card.preview?.beforeSnippet ?? "Keine Vorher-Vorschau verfügbar."}
                              </Text>
                            </View>
                            <View style={styles.modalBeforeAfterCol}>
                              <Text style={styles.modalDiffLabel}>Nachher</Text>
                              <Text style={styles.modalCodeBlock}>
                                {card.preview?.afterSnippet ?? "Keine Nachher-Vorschau verfügbar."}
                              </Text>
                            </View>
                          </View>
                        </>
                      )}

                      {"preview" in card && card.preview?.truncated ? (
                        <Text style={styles.modalHintText}>Ausschnitt hart gekürzt, damit das Review kompakt bleibt.</Text>
                      ) : null}
                    </View>
                  ))
                )}
                {hiddenPreviewCount > 0 ? (
                  <Text style={styles.modalHintText}>
                    Weitere {hiddenPreviewCount} Dateiänderung{hiddenPreviewCount === 1 ? "" : "en"} sind nur in der Zusammenfassung gelistet, damit das Modal kompakt bleibt.
                  </Text>
                ) : null}

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

                {guardWarnings.length ? (
                  <View style={styles.modalSummaryCard}>
                    <Text style={styles.modalSectionTitle}>Guard-Hinweis (manuell prüfen)</Text>
                    <Text style={styles.modalHintText}>
                      Diese Änderung enthält geschützte/guarded Pfade. Bitte nur bewusst bestätigen, wenn du die Auswirkungen kennst.
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowPolicyExplain((prev) => !prev)}
                      accessibilityRole="button"
                      accessibilityLabel="Warum Guard-Regeln?"
                      activeOpacity={0.85}
                      style={styles.modalPolicyExplainToggle}
                    >
                      <Text style={styles.modalPolicyExplainToggleText}>
                        {showPolicyExplain
                          ? "Policy-Details ausblenden"
                          : "Warum Guard-Regeln? (kurz erklärt)"}
                      </Text>
                    </TouchableOpacity>
                    {showPolicyExplain ? (
                      <View style={styles.modalPolicyExplainCard}>
                        <Text style={styles.modalHintText}>
                          Guard-Regeln verhindern unbewusste Änderungen an sensiblen Bereichen
                          (z. B. baseline/read-only, kritisch/manual-only, Ownership-Block).
                        </Text>
                        <Text style={styles.modalHintText}>
                          Typische Fälle: Secrets/Schlüsseldateien, Baseline-Templates,
                          Deploy-/Infra-Workflow-Dateien und fremd verwaltete Owner-Pfade.
                        </Text>
                      </View>
                    ) : null}
                    {guardWarnings.slice(0, 5).map((entry) => (
                      <Text key={`guard-${entry}`} style={styles.modalHintText}>• {entry}</Text>
                    ))}
                    <Text style={styles.modalDiffLabel}>Safe Follow-up Optionen</Text>
                    {GUARDED_FOLLOW_UP_OPTIONS.map((option) => (
                      <Text key={option.key} style={styles.modalHintText}>• {option.text}</Text>
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
