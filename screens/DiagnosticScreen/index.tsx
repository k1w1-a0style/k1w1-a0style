import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigation } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SegmentedTabs } from "../../components/diagnostics/SegmentedTabs";
import { ModeSelector, type BuildMode } from "../../components/diagnostics/ModeSelector";
import { IssueCard } from "../../components/diagnostics/IssueCard";
import {
  IssueDetailSheet,
  type IssueDetail,
} from "../../components/diagnostics/IssueDetailSheet";
import { InlineToast } from "../../components/diagnostics/InlineToast";
import { useInlineToast } from "../../components/diagnostics/useInlineToast";
import { SectionCard } from "../../components/diagnostics/SectionCard";

import { theme } from "../../theme";
import { useProject } from "../../contexts/ProjectContext";

import { parseOwnerRepo } from "../../lib/diagnostics/ciAutoFix";


import {
  createOrUpdateFile,
  deleteRepoFile,
} from "../../contexts/githubService";

import type { ProjectFile } from "../../contexts/types";

import { validateFileContent, validateFilePath } from "../../lib/validators";

import type {
  PreflightCheckResult,
  PreflightPatch,
  PreflightTarget,
} from "../../lib/diagnostics/preflightTypes";

import { runPreflightChecksProgressive } from "../../lib/diagnostics/preflightRunner";
import { runBuildPipelineDiagnostics } from "../../lib/diagnostics/buildPipelineDiagnostics";
import {
  formatDiagnosticUpload,
  uploadDiagnosticToSupabase,
} from "../../lib/diagnostics/diagnosticUploader";
import {
  sanitizeDiagnosticUpload,
  safeTruncateText,
} from "../../lib/diagnostics/sanitize";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import type { BuildVariant, FixHistoryEntry, FixStep, FixStepStatus, Status } from "./types";
import { useDiagnosticScreen } from "./hooks/useDiagnosticScreen";

/**
 * Diagnostics Screen (v8.10)
 * - Cleaner, more "pro" UI
 * - Per-result Fix button
 * - AutoFix with a nice progress modal
 *
 * NOTE: This file is intentionally self-contained (no new deps).
 */

const ORDER: Record<Status, number> = { fail: 0, warn: 1, pass: 2 };
const MAX_HISTORY = 10;
const DEVICE_ID_KEY = "k1w1_device_id";
const UPLOAD_COOLDOWN_MS = 30_000;
const UPLOAD_RETRY_DELAY_MS = 3_000;
const UPLOAD_COOLDOWN_KEY = "k1w1_upload_cooldown_until";


const MAX_DETAILS = 10;
const AUTOFIX_MAX = 50; // safety: don't apply endless chains
const FIX_MODAL_MAX_LINES = 7;

function statusToSeverity(s: Status): "critical" | "warning" | "info" | "pass" {
  if (s === "fail") return "critical";
  if (s === "warn") return "warning";
  // We treat passes as "info" only when the user explicitly filters to it.
  return "pass";
}

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


  const toast = useInlineToast();


  const {
    // refs & upload idempotency
    projectRef,
    mountedRef,
    uploadBusyRef,
    uploadCooldownUntil,
    setUploadCooldownUntil,
    setCooldownNow,
    uploadCooldownLeftSec,
    getOrCreateUploadClientRequestId,
    resetUploadClientRequestId,

    // prefs / modes
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

    // pipeline CI helper
    ciFixing,
    ciFixLog,
    runCiAutofix,

    // UI state
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

    // diagnostics run + derived
    target,
    setTarget,
    results,
    running,
    progressStage,
    lastRunAt,
	    runDiagnostics,
    counts,
    sortedResults,
    visibleResults,
    fixableResults,

	    // helpers
	    toSeverity,

    // preview / apply / history
    history,
    previewVisible,
    setPreviewVisible,
    previewLabel,
	    setPreviewLabel,
    previewEntries,
	    setPreviewEntries,
    applyBusy,
    uploadBusy,
    openPreview,
    applyPatch,
    undoLast,
    undoAll,
    toggleSelected,
    clearSelection,
    selectFails,

    // automation flows
    applySelected,
    autoFix,
    applySingle,
    smartFix,

	    // bulk helpers
	    applyFixList,

    // upload / report
    reportVisible,
    setReportVisible,
    upload,
    copyReport,
    headerStats,

    // fix modal
    fixModalVisible,
    fixModalTitle,
    fixModalSubtitle,
    fixSteps,
    fixStepIndex,
    fixDone,
    closeFixModal,

    // issue sheet
    issueSheetVisible,
	    activeIssue,
    activeIssueDetail,
    openIssue,
    closeIssue,
    applyIssueFix,
  } = useDiagnosticScreen({
    projectData,
    linkedRepo,
    linkedBranch,
    setPreferredBuildProfile,
    updateProjectFiles,
    deleteFile,
    toast,
    navigation,
  });

  const busy = running || applyBusy;

  const issueList = useMemo(() => visibleResults, [visibleResults]);

  const tabDefs = useMemo(
    () => [
      { key: "overview" as const, label: "Overview" },
      { key: "issues" as const, label: "Issues", badge: counts.fail + counts.warn },
      { key: "fixes" as const, label: "Fixes", badge: fixableResults.length },
    ],
    [counts.fail, counts.warn, fixableResults.length],
  );

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

      {/* Preview Modal */}
      <Modal visible={previewVisible} animationType="slide" onRequestClose={() => setPreviewVisible(false)}>
        <View style={styles.previewWrap}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {previewLabel}
            </Text>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setPreviewVisible(false)}>
              <Ionicons name="close" size={18} color={theme.palette.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: theme.spacing.lg }}>
            {previewEntries.map((e) => (
              <View key={e.path} style={styles.previewCard}>
                <Text style={styles.previewPath}>{e.path}</Text>

                <Text style={styles.previewLabel}>Before</Text>
                <Text style={styles.previewText} selectable>
                  {safeTruncateText(e.oldText ?? "", 6000)}
                </Text>

                <Text style={styles.previewLabel}>After</Text>
                <Text style={styles.previewText} selectable>
                  {safeTruncateText(e.newText ?? "", 6000)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Diagnostics</Text>
          <Text style={styles.subtitle}>
            {headerStats.name} • {headerStats.mode}
          </Text>
        </View>

        {busy ? (
          <View style={styles.busyPill}>
            <ActivityIndicator size="small" />
            <Text style={styles.busyText}>{running ? "Running…" : "Applying…"}</Text>
          </View>
        ) : null}
      </View>

      <SegmentedTabs value={tab} onChange={setTab} tabs={tabDefs} />

      <InlineToast message={toast.message} anim={toast.anim} />

      {tab === "issues" ? (
  <FlatList
    data={issueList}
    keyExtractor={(item) => item.id}
    contentContainerStyle={styles.content}
    ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
    renderItem={({ item }) => {
      const st = ((item.status ?? "pass") as Status) ?? "pass";
      const severity = toSeverity(st);
      return (
        <IssueCard
          title={item.title}
          message={item.message}
          severity={severity}
          hasFix={!!item.fix?.patch}
          onPress={() => openIssue(item)}
        />
      );
    }}
    ListHeaderComponent={
      <View style={styles.stack}>
        <ModeSelector
          isAdvanced={modeAdvanced}
          onToggleAdvanced={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setModeAdvanced((prev) => {
                    const next = !prev;
                    if (next) {
                      // When entering advanced, seed selection with the recommended mode.
                      setSelectedModes((p) => (p.length ? p : [recommendedMode]));
                    }
                    return next;
                  });
                }}
          recommendedMode={recommendedMode}
          selectedModes={selectedModes}
          onChangeSelected={setSelectedModes}
          allowAll
          allSelected={modesAll}
          onToggleAll={() => {
                  setModesAll((prev) => {
                    const next = !prev;
                    if (next) setSelectedModes(["development", "preview", "production"]);
                    return next;
                  });
                }}
          disabled={busy}
        />

        <View style={styles.filtersRow}>
          {(["all", "critical", "warning"] as const).map((k) => {
            const active = issuesFilter === k;
            const label = k === "all" ? "All" : k === "critical" ? "Critical" : "Warning";
            return (
              <TouchableOpacity
                key={k}
                style={[styles.filterChip, active && styles.filterChipOn, busy && styles.disabled]}
                onPress={() => setIssuesFilter(k)}
                disabled={busy}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextOn]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    }
    ListEmptyComponent={
      <SectionCard title="No issues" subtitle="Alles sieht gut aus." icon="checkmark-circle">
        <Text style={styles.muted}>
          Starte eine Diagnose oder wechsle den Mode, falls du andere Profile prüfen willst.
        </Text>
        <View style={{ height: theme.spacing.sm }} />
        <TouchableOpacity style={styles.btnPrimary} onPress={() => runDiagnostics()} disabled={busy}>
          <Ionicons name="play" size={16} color={theme.palette.background} />
          <Text style={styles.btnPrimaryText}>Run Diagnostics</Text>
        </TouchableOpacity>
      </SectionCard>
    }
  />
) : (
  <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
    <View style={styles.stack}>
      <ModeSelector
        isAdvanced={modeAdvanced}
        onToggleAdvanced={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setModeAdvanced((prev) => {
            const next = !prev;
            if (next) setSelectedModes((p) => (p.length ? p : [recommendedMode]));
            return next;
          });
        }}
        recommendedMode={recommendedMode}
        selectedModes={selectedModes}
        onChangeSelected={setSelectedModes}
        allowAll
        allSelected={modesAll}
        onToggleAll={() => {
                  setModesAll((prev) => {
                    const next = !prev;
                    if (next) setSelectedModes(["development", "preview", "production"]);
                    return next;
                  });
                }}
        disabled={busy}
      />

      {tab === "overview" ? (
        <>
          <SectionCard
            title="Status"
            subtitle={lastRunAt ? `Last run: ${new Date(lastRunAt).toLocaleString()}` : "Noch keine Diagnose"}
            icon="pulse"
            right={
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.countBig}>{counts.fail + counts.warn}</Text>
                <Text style={styles.countLabel}>Issues</Text>
              </View>
            }
          >
            <View style={styles.countRow}>
              <View style={styles.countPill}>
                <Text style={styles.countPillNum}>{counts.fail}</Text>
                <Text style={styles.countPillLabel}>Critical</Text>
              </View>
              <View style={styles.countPill}>
                <Text style={styles.countPillNum}>{counts.warn}</Text>
                <Text style={styles.countPillLabel}>Warning</Text>
              </View>
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => runDiagnostics()} disabled={busy}>
                <Ionicons name="play" size={16} color={theme.palette.background} />
                <Text style={styles.btnPrimaryText}>Run Diagnostics</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => setReportVisible(true)}
                disabled={!results.length}
              >
                <Ionicons name="document-text" size={16} color={theme.palette.text.primary} />
                <Text style={styles.btnSecondaryText}>View Report</Text>
              </TouchableOpacity>
            </View>
          </SectionCard>

          <SectionCard
            title="Advanced"
            subtitle="Nur wenn du’s wirklich brauchst"
            icon="options"
            right={
              <TouchableOpacity style={styles.ghostBtn} onPress={toggleAdvanced}>
                <Ionicons
                  name={advancedOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={theme.palette.text.primary}
                />
              </TouchableOpacity>
            }
          >
            {advancedOpen ? (
              <View style={{ gap: theme.spacing.md }}>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Local checks</Text>
                    <Text style={styles.switchHint}>Checks auf deinen Projektdateien</Text>
                  </View>
                  <Switch value={includeLocalChecks} onValueChange={setIncludeLocalChecks} />
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Pipeline checks</Text>
                    <Text style={styles.switchHint}>GitHub/EAS linkage & Workflows</Text>
                  </View>
                  <Switch value={includePipelineChecks} onValueChange={setIncludePipelineChecks} />
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Sync fixes to GitHub</Text>
                    <Text style={styles.switchHint}>Nur wenn Repo verknüpft ist</Text>
                  </View>
                  <Switch value={syncFixesToGitHub} onValueChange={setSyncFixesToGitHub} />
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Re-run after fix</Text>
                    <Text style={styles.switchHint}>Verifizieren, dass es “grün” ist</Text>
                  </View>
                  <Switch value={rerunAfterFix} onValueChange={setRerunAfterFix} />
                </View>

                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.btnSecondary} onPress={copyReport} disabled={busy || !results.length}>
                    <Ionicons name="copy" size={16} color={theme.palette.text.primary} />
                    <Text style={styles.btnSecondaryText}>Copy debug info</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.btnSecondary} onPress={upload} disabled={busy || uploadBusy || uploadCooldownLeftSec > 0}>
                    <Ionicons name="cloud-upload" size={16} color={theme.palette.text.primary} />
                    <Text style={styles.btnSecondaryText}>
                      {uploadCooldownLeftSec > 0 ? `Upload (${uploadCooldownLeftSec}s)` : "Upload"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.btnTertiary} onPress={runCiAutofix} disabled={ciFixing || !linkedRepo}>
                  <Ionicons name="build" size={16} color={theme.palette.text.primary} />
                  <Text style={styles.btnTertiaryText}>
                    {ciFixing ? "Fixing CI…" : "Fix CI Workflows"}
                  </Text>
                </TouchableOpacity>

                {ciFixLog ? (
                  <TouchableOpacity
                    style={styles.btnTertiary}
                    onPress={() => {
                      setPreviewLabel("CI/Workflows Log");
                      setPreviewEntries([{ path: "CI_AUTOFIX", oldText: null, newText: ciFixLog }]);
                      setPreviewVisible(true);
                    }}
                  >
                    <Ionicons name="eye" size={16} color={theme.palette.text.primary} />
                    <Text style={styles.btnTertiaryText}>View CI Log</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <Text style={styles.muted}>
                Versteckt, damit’s ruhig bleibt. Aufklappen nur bei Bedarf.
              </Text>
            )}
          </SectionCard>
        </>
      ) : (
        <>
          {/* Fixes tab */}
          <SectionCard
            title="Smart Fix"
            subtitle="Wendet nur empfohlene Fixes an (Critical)"
            icon="sparkles"
            right={
              <Text style={styles.pill}>
                {fixableResults.filter((r) => ((r.status ?? "pass") as Status) === "fail").length}
              </Text>
            }
          >
            <TouchableOpacity style={styles.btnPrimary} onPress={smartFix} disabled={busy || !fixableResults.length}>
              <Ionicons name="flash" size={16} color={theme.palette.background} />
              <Text style={styles.btnPrimaryText}>Apply Smart Fix</Text>
            </TouchableOpacity>

            <View style={{ height: theme.spacing.sm }} />

            <TouchableOpacity style={styles.advRow} onPress={toggleAdvancedFixes}>
              <Text style={styles.advRowText}>Advanced selection</Text>
              <Ionicons
                name={advancedFixesOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={theme.palette.text.primary}
              />
            </TouchableOpacity>

            {advancedFixesOpen ? (
              <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Include warnings</Text>
                    <Text style={styles.switchHint}>sonst nur Critical</Text>
                  </View>
                  <Switch value={autoFixIncludeWarn} onValueChange={setAutoFixIncludeWarn} />
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Scope</Text>
                    <Text style={styles.switchHint}>
                      {autoFixScope === "visible" ? "nur gefilterte Issues" : "alle Fixes"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.scopeBtn}
                    onPress={() =>
                      setAutoFixScope((v) => (v === "visible" ? "all" : "visible"))
                    }
                  >
                    <Text style={styles.scopeBtnText}>
                      {autoFixScope === "visible" ? "Visible" : "All"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <SectionCard title="Manual picks" subtitle="Optional" icon="list">
                  {fixableResults.length ? (
                    fixableResults.slice(0, MAX_DETAILS).map((r) => {
                      const checked = !!selected[r.id];
                      const st = ((r.status ?? "pass") as Status) ?? "pass";
                      const severity = toSeverity(st);
                      return (
                        <TouchableOpacity
                          key={r.id}
                          style={styles.pickRow}
                          onPress={() =>
                            setSelected((prev) => ({ ...prev, [r.id]: !checked }))
                          }
                        >
                          <Ionicons
                            name={checked ? "checkbox" : "square-outline"}
                            size={18}
                            color={checked ? theme.palette.primaryLight : theme.palette.text.muted}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.pickTitle}>{r.title}</Text>
                            <Text style={styles.pickHint} numberOfLines={2}>
                              {r.message || "—"}
                            </Text>
                          </View>
                          <View style={{ marginLeft: theme.spacing.sm }}>
                            <Text style={styles.pickSeverity}>{severity}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={styles.muted}>Keine fixbaren Issues.</Text>
                  )}

                  {fixableResults.length > MAX_DETAILS ? (
                    <Text style={styles.muted}>
                      … und {fixableResults.length - MAX_DETAILS} weitere (filtere in Issues).
                    </Text>
                  ) : null}

                  <View style={{ height: theme.spacing.sm }} />

                  <TouchableOpacity
                    style={styles.btnSecondary}
                    disabled={busy || !selectedCount}
                    onPress={async () => {
                      const chosen = fixableResults.filter((r) => selected[r.id]);
                      const scoped =
                        autoFixScope === "visible"
                          ? chosen.filter((r) => issueList.some((i) => i.id === r.id))
                          : chosen;

                      const final =
                        autoFixIncludeWarn
                          ? scoped
                          : scoped.filter((r) => ((r.status ?? "pass") as Status) === "fail");

                      if (!final.length) {
                        Alert.alert("Nichts gewählt", "Deine Auswahl enthält keine empfohlenen Fixes.");
                        return;
                      }

                      const slice = final.slice(0, AUTOFIX_MAX);
                      if (final.length > AUTOFIX_MAX) {
                        Alert.alert(
                          "Limit",
                          `Es werden nur ${AUTOFIX_MAX}/${final.length} angewendet. Filtere oder erneut ausführen.`,
                        );
                      }
                      await applyFixList(slice, "Advanced Fixes");
                    }}
                  >
                    <Ionicons name="checkmark" size={16} color={theme.palette.text.primary} />
                    <Text style={styles.btnSecondaryText}>
                      Apply selected ({selectedCount})
                    </Text>
                  </TouchableOpacity>
                </SectionCard>
              </View>
            ) : null}
          </SectionCard>
        </>
      )}
    </View>
  </ScrollView>
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