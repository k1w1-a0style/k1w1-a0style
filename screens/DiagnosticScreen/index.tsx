import "react-native-get-random-values";
import React from "react";
import { useNavigation } from "@react-navigation/native";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { IssueDetailSheet } from "../../components/diagnostics/IssueDetailSheet";

import { theme } from "../../theme";
import { useProject } from "../../contexts/ProjectContext";

import type { FixStep } from "./types";
import { useDiagnosticScreen } from "./hooks/useDiagnosticScreen";
import { HeaderSection } from "./components/HeaderSection";
import { PreviewModal } from "./components/PreviewModal";
import { IssuesTabSection } from "./components/IssuesTabSection";
import { NonIssuesTabSection } from "./components/NonIssuesTabSection";

/**
 * Diagnostics Screen (v8.10)
 * - Cleaner, more "pro" UI
 * - Per-result Fix button
 * - AutoFix with a nice progress modal
 *
 * NOTE: This file is intentionally self-contained (no new deps).
 */

const FIX_MODAL_MAX_LINES = 7;

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <View style={styles.progressOuter}>
      <View
        style={[
          styles.progressInner,
          { width: `${Math.round(clamped * 100)}%` },
        ]}
      />
    </View>
  );
}

function FixRunModal(props: {
  visible: boolean;
  title: string;
  subtitle?: string;
  steps: FixStep[];
  currentIndex: number;
  done: boolean;
  onClose: () => void;
}) {
  const { visible, title, subtitle, steps, currentIndex, done, onClose } =
    props;

  const pct = steps.length ? currentIndex / steps.length : 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons
                name={done ? "sparkles" : "construct"}
                size={18}
                color={theme.palette.primaryLight}
              />
              <Text style={styles.modalTitle}>{title}</Text>
            </View>
            <TouchableOpacity
              style={[styles.iconBtn, !done && { opacity: 0.5 }]}
              onPress={onClose}
              disabled={!done}
              accessibilityLabel="Close"
            >
              <Ionicons
                name="close"
                size={18}
                color={theme.palette.text.primary}
              />
            </TouchableOpacity>
          </View>

          {subtitle ? (
            <Text style={styles.modalSubtitle}>{subtitle}</Text>
          ) : null}

          <View style={{ marginTop: 12 }}>
            <ProgressBar pct={pct} />
            <Text style={styles.modalHint}>
              {done
                ? "Fertig. Du kannst schließen."
                : "Bitte nicht schließen – Fixes laufen…"}
            </Text>
          </View>

          <View style={{ marginTop: 12 }}>
            {steps.slice(0, FIX_MODAL_MAX_LINES).map((s, idx) => {
              const isActive = idx === currentIndex && !done;
              const icon =
                s.status === "done"
                  ? "checkmark-circle"
                  : s.status === "failed"
                    ? "close-circle"
                    : s.status === "running"
                      ? "time"
                      : s.status === "skipped"
                        ? "remove-circle"
                        : "ellipse-outline";

              const color =
                s.status === "done"
                  ? theme.palette.success
                  : s.status === "failed"
                    ? theme.palette.error
                    : s.status === "running"
                      ? theme.palette.info
                      : theme.palette.text.muted;

              return (
                <View
                  key={s.key}
                  style={[styles.stepRow, isActive && styles.stepRowActive]}
                >
                  <Ionicons name={icon as any} size={16} color={color} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.stepTitle,
                        isActive && { color: theme.palette.text.primary },
                      ]}
                    >
                      {s.title}
                    </Text>
                    {s.message ? (
                      <Text style={styles.stepMsg}>{s.message}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
            {steps.length > FIX_MODAL_MAX_LINES ? (
              <Text style={styles.moreText}>
                … und {steps.length - FIX_MODAL_MAX_LINES} weitere
              </Text>
            ) : null}
          </View>

          {!done ? (
            <View style={styles.modalFooter}>
              <ActivityIndicator />
              <Text style={styles.modalFooterText}>AutoFix arbeitet…</Text>
            </View>
          ) : (
            <View style={styles.modalFooter}>
              <Ionicons
                name="checkmark"
                size={16}
                color={theme.palette.success}
              />
              <Text style={styles.modalFooterText}>Fertig.</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function DiagnosticScreen() {
  // This screen is mounted inside React Navigation; use the hook instead of relying on implicit props.
  const navigation = useNavigation<any>();
  const { projectData, updateProjectFiles, deleteFile, setPreferredBuildProfile } = useProject();

  const linkedRepo = (projectData as any)?.linkedRepo
    ? String((projectData as any).linkedRepo)
    : "";
  const linkedBranch = (projectData as any)?.linkedBranch
    ? String((projectData as any).linkedBranch)
    : "";

  const {
    projectRef,
    mountedRef,
    uploadBusyRef,
    uploadCooldownUntil,
    setUploadCooldownUntil,
    setCooldownNow,
    uploadCooldownLeftSec,
    getOrCreateUploadClientRequestId,
    resetUploadClientRequestId,
    recommendedMode,
    modeAdvanced,
    setModeAdvanced,
    modesAll,
    setModesAll,
    selectedModes,
    setSelectedModes,
    includeLocalChecks,
    setIncludeLocalChecks,
    includePipelineChecks,
    setIncludePipelineChecks,
    syncFixesToGitHub,
    setSyncFixesToGitHub,
    rerunAfterFix,
    setRerunAfterFix,
    autoFixIncludeWarn,
    setAutoFixIncludeWarn,
    autoFixScope,
    setAutoFixScope,
    ciFixing,
    ciFixLog,
    runCiAutofix,
    tab,
    setTab,
    advancedOpen,
    advancedFixesOpen,
    toggleAdvanced,
    toggleAdvancedFixes,
    issuesFilter,
    setIssuesFilter,
    selected,
    setSelected,
    selectedCount,

    toast,
    tabDefs,
    issueList,
    busy,

    // workflow (moved to hook)
    target,
    setTarget,
    results,
    setResults,
    running,
    progressStage,
    lastRunAt,
    history,
    previewVisible,
    setPreviewVisible,
    previewLabel,
    previewEntries,
    setPreviewLabel,
    setPreviewEntries,
    applyBusy,
    uploadBusy,
    fixModalVisible,
    fixModalTitle,
    fixModalSubtitle,
    fixSteps,
    fixStepIndex,
    fixDone,
    closeFixModal,
    counts,
    sortedResults,
    toSeverity,
    visibleResults,
    fixableResults,
    pipelineAppliesToFocus,
    runDiagnostics,
    openPreview,
    applyPatch,
    undoLast,
    undoAll,
    applySingle,
    autoFix,
    applySelected,
    smartFix,
    reportVisible,
    setReportVisible,
    issueSheetVisible,
    activeIssue,
    activeIssueDetail,
    openIssue,
    closeIssue,
    applyIssueFix,
    applyFixList,
    upload,
    copyReport,
    headerStats,
  } = useDiagnosticScreen({ projectData, linkedRepo, linkedBranch, setPreferredBuildProfile, navigation, updateProjectFiles, deleteFile });

  if (!projectData) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Diagnostics</Text>
        <Text style={styles.muted}>Bitte ein Projekt laden.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FixRunModal
        visible={fixModalVisible}
        title={fixModalTitle}
        subtitle={fixModalSubtitle}
        steps={fixSteps}
        currentIndex={fixStepIndex}
        done={fixDone}
        onClose={closeFixModal}
      />

      <IssueDetailSheet
        visible={issueSheetVisible}
        issue={activeIssueDetail}
        onClose={closeIssue}
        busy={busy}
        onPreview={() => {
          if (!activeIssue?.fix?.patch) return;
          closeIssue();
          openPreview(activeIssue.title, activeIssue.fix.patch);
        }}
        onApplyFix={() => {
          if (!activeIssue) return;
          closeIssue();
          applyIssueFix(activeIssue);
        }}
      />

      <PreviewModal
        styles={styles}
        visible={previewVisible}
        label={previewLabel}
        entries={previewEntries}
        onClose={() => setPreviewVisible(false)}
      />

      <HeaderSection
        styles={styles}
        headerStats={headerStats}
        busy={busy}
        running={running}
        tab={tab}
        setTab={setTab}
        tabDefs={tabDefs}
        toast={toast}
      />

      {tab === "issues" ? (
        <IssuesTabSection
          styles={styles}
          issueList={issueList}
          modeAdvanced={modeAdvanced}
          setModeAdvanced={setModeAdvanced}
          recommendedMode={recommendedMode}
          selectedModes={selectedModes}
          setSelectedModes={setSelectedModes}
          modesAll={modesAll}
          setModesAll={setModesAll}
          busy={busy}
          issuesFilter={issuesFilter}
          setIssuesFilter={setIssuesFilter}
          toSeverity={toSeverity}
          openIssue={openIssue}
          runDiagnostics={runDiagnostics}
        />
      ) : (
        <NonIssuesTabSection
          styles={styles}
          tab={tab}
          modeAdvanced={modeAdvanced}
          setModeAdvanced={setModeAdvanced}
          recommendedMode={recommendedMode}
          selectedModes={selectedModes}
          setSelectedModes={setSelectedModes}
          modesAll={modesAll}
          setModesAll={setModesAll}
          busy={busy}
          lastRunAt={lastRunAt}
          counts={counts}
          results={results}
          setReportVisible={setReportVisible}
          advancedOpen={advancedOpen}
          toggleAdvanced={toggleAdvanced}
          includeLocalChecks={includeLocalChecks}
          setIncludeLocalChecks={setIncludeLocalChecks}
          includePipelineChecks={includePipelineChecks}
          setIncludePipelineChecks={setIncludePipelineChecks}
          syncFixesToGitHub={syncFixesToGitHub}
          setSyncFixesToGitHub={setSyncFixesToGitHub}
          rerunAfterFix={rerunAfterFix}
          setRerunAfterFix={setRerunAfterFix}
          copyReport={copyReport}
          upload={upload}
          uploadBusy={uploadBusy}
          uploadCooldownLeftSec={uploadCooldownLeftSec}
          runCiAutofix={runCiAutofix}
          ciFixing={ciFixing}
          linkedRepo={linkedRepo}
          ciFixLog={ciFixLog}
          setPreviewLabel={setPreviewLabel}
          setPreviewEntries={setPreviewEntries}
          setPreviewVisible={setPreviewVisible}
          fixableResults={fixableResults}
          smartFix={smartFix}
          advancedFixesOpen={advancedFixesOpen}
          toggleAdvancedFixes={toggleAdvancedFixes}
          autoFixIncludeWarn={autoFixIncludeWarn}
          setAutoFixIncludeWarn={setAutoFixIncludeWarn}
          autoFixScope={autoFixScope}
          setAutoFixScope={setAutoFixScope}
          selected={selected}
          setSelected={setSelected}
          selectedCount={selectedCount}
          issueList={issueList}
          applyFixList={applyFixList}
          toSeverity={toSeverity}
          runDiagnostics={runDiagnostics}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  header: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  busyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
  },
  busyText: {
    color: theme.palette.text.secondary,
    fontWeight: "800",
    fontSize: 12,
  },

  content: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
  },
  stack: {
    gap: theme.spacing.sm,
  },

  muted: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },

  // Buttons
  btnRow: {
    marginTop: theme.spacing.md,
    flexDirection: "row",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.palette.primary,
    minHeight: 44,
    flexGrow: 1,
  },
  btnPrimaryText: {
    color: theme.palette.background,
    fontSize: 14,
    fontWeight: "900",
  },
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    minHeight: 44,
    flexGrow: 1,
  },
  btnSecondaryText: {
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  btnTertiary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.palette.backgroundDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    minHeight: 44,
  },
  btnTertiaryText: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  ghostBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.palette.backgroundDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.5 },

  // Counts
  countRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  countPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.palette.backgroundDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
  },
  countPillNum: {
    color: theme.palette.text.primary,
    fontSize: 18,
    fontWeight: "900",
  },
  countPillLabel: {
    marginTop: 2,
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "800",
  },
  countBig: {
    color: theme.palette.text.primary,
    fontSize: 20,
    fontWeight: "900",
  },
  countLabel: {
    color: theme.palette.text.secondary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.palette.backgroundDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    color: theme.palette.text.primary,
    fontWeight: "900",
    overflow: "hidden",
  },

  // Issues filter chips
  filtersRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.palette.backgroundDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
  },
  filterChipOn: {
    backgroundColor: "rgba(0,255,0,0.10)",
    borderColor: "rgba(0,255,0,0.25)",
  },
  filterChipText: {
    color: theme.palette.text.secondary,
    fontWeight: "900",
    fontSize: 13,
  },
  filterChipTextOn: {
    color: theme.palette.text.primary,
  },

  // Advanced toggles
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: 6,
  },
  switchTitle: {
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  switchHint: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },

  advRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  advRowText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
  },
  scopeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.palette.backgroundDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
  },
  scopeBtnText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
  },

  // Manual pick list
  pickRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
  },
  pickTitle: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 13,
  },
  pickHint: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  pickSeverity: {
    color: theme.palette.text.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  // Preview modal
  previewWrap: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  previewHeader: {
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.layout.screenPadding,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.palette.border,
  },
  previewTitle: {
    color: theme.palette.text.primary,
    fontSize: 16,
    fontWeight: "900",
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  previewCard: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.palette.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    padding: theme.spacing.md,
  },
  previewPath: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    marginBottom: 6,
  },
  previewLabel: {
    marginTop: theme.spacing.sm,
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  previewText: {
    marginTop: 6,
    color: theme.palette.text.primary,
    fontFamily: theme.typography.monoFamily,
    fontSize: 12,
    lineHeight: 16,
  },

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.palette.borderLight,
    backgroundColor: theme.palette.card,
    alignItems: "center",
    justifyContent: "center",
  },

  // Fix run modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: "100%",
    backgroundColor: theme.palette.card,
    borderRadius: theme.borderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    padding: theme.spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  modalTitle: {
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  modalSubtitle: {
    marginTop: 6,
    color: theme.palette.text.secondary,
    fontSize: 12,
  },
  modalHint: {
    marginTop: 8,
    color: theme.palette.text.secondary,
    fontSize: 12,
  },
  progressOuter: {
    height: 8,
    backgroundColor: theme.palette.backgroundDark,
    borderRadius: theme.borderRadius.full,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
  },
  progressInner: {
    height: 8,
    backgroundColor: theme.palette.primary,
  },
  stepRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  stepRowActive: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  stepTitle: { color: theme.palette.text.secondary, fontWeight: "800" },
  stepMsg: { marginTop: 2, color: theme.palette.text.muted, fontSize: 12 },
  moreText: {
    marginTop: 8,
    color: theme.palette.text.muted,
    fontSize: 12,
    textAlign: "center",
  },
  modalFooter: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  modalFooterText: { color: theme.palette.text.secondary, fontWeight: "700" },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
    backgroundColor: theme.palette.background,
  },
});
