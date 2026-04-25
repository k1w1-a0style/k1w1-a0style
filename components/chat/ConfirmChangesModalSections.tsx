import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

import type { PendingChange } from "../../hooks/chatAIFlowTypes";
import { styles } from "../../styles/chatScreenStyles";
import type { ChangePreview } from "../../lib/changePreview";

export type ReviewCard =
  | { key: string; path: string; status: "new" | "updated"; preview?: ChangePreview }
  | { key: string; path: string; status: "skipped" | "deleted"; preview?: ChangePreview }
  | { key: string; path: string; toPath: string; status: "renamed"; preview?: ChangePreview };

type ReviewSummaryCardProps = {
  pendingChange: PendingChange;
  validatorReviewLabel: string;
};

type FileReviewSectionProps = {
  reviewCards: ReviewCard[];
  hiddenPreviewCount: number;
};

type GuardWarningsCardProps = {
  guardWarnings: string[];
  showPolicyExplain: boolean;
  onTogglePolicyExplain: () => void;
  guardedFollowUpOptions: readonly { key: string; text: string }[];
};

type TextSummarySectionProps = {
  summary: string;
  summaryMaxChars: number;
};

function getReviewPathChip(status: ReviewCard["status"]): "wird geändert" | "manuell nötig" {
  return status === "skipped" ? "manuell nötig" : "wird geändert";
}

export const ReviewSummaryCard: React.FC<ReviewSummaryCardProps> = ({
  pendingChange,
  validatorReviewLabel,
}) => (
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
);

export const FileReviewSection: React.FC<FileReviewSectionProps> = ({
  reviewCards,
  hiddenPreviewCount,
}) => (
  <>
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
              <Text style={styles.modalPathChipText}>{getReviewPathChip(card.status)}</Text>
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
              <Text style={styles.modalCodeBlock}>
                {card.preview?.diffSnippet ?? "Kein Diff-Ausschnitt verfügbar."}
              </Text>
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
            <Text style={styles.modalHintText}>
              Ausschnitt hart gekürzt, damit das Review kompakt bleibt.
            </Text>
          ) : null}
        </View>
      ))
    )}
    {hiddenPreviewCount > 0 ? (
      <Text style={styles.modalHintText}>
        Weitere {hiddenPreviewCount} Dateiänderung{hiddenPreviewCount === 1 ? "" : "en"} sind
        nur in der Zusammenfassung gelistet, damit das Modal kompakt bleibt.
      </Text>
    ) : null}
  </>
);

export const GuardWarningsCard: React.FC<GuardWarningsCardProps> = ({
  guardWarnings,
  showPolicyExplain,
  onTogglePolicyExplain,
  guardedFollowUpOptions,
}) => {
  if (!guardWarnings.length) return null;

  return (
    <View style={styles.modalSummaryCard}>
      <Text style={styles.modalSectionTitle}>Guard-Hinweis (manuell prüfen)</Text>
      <Text style={styles.modalHintText}>
        Diese Änderung enthält geschützte/guarded Pfade. Bitte nur bewusst bestätigen, wenn du
        die Auswirkungen kennst.
      </Text>
      <TouchableOpacity
        onPress={onTogglePolicyExplain}
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
      {guardedFollowUpOptions.map((option) => (
        <Text key={option.key} style={styles.modalHintText}>• {option.text}</Text>
      ))}
    </View>
  );
};

export const TextSummarySection: React.FC<TextSummarySectionProps> = ({
  summary,
  summaryMaxChars,
}) => (
  <>
    <Text style={styles.modalSectionTitle}>Text-Zusammenfassung</Text>
    <Text style={styles.modalText}>
      {summary.length > summaryMaxChars
        ? summary.slice(0, summaryMaxChars) + "\n\n… (Text gekürzt)"
        : summary}
    </Text>
  </>
);
