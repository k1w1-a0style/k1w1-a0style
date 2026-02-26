import React, { useEffect, useMemo, useRef } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  ScrollView,

  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { IssueDetailSheet } from "../../components/diagnostics/IssueDetailSheet";

import { theme } from "../../theme";

import { useProject } from "../../contexts/ProjectContext";

import { useDiagnosticScreen } from "./hooks/useDiagnosticScreen";
import { FixRunModal } from "./components/FixRunModal";
import { HeaderSection } from "./components/HeaderSection";
import { PreviewModal } from "./components/PreviewModal";
import { SectionCard } from "../../components/diagnostics/SectionCard";
import { SeverityBadge } from "../../components/diagnostics/SeverityBadge";
import type { PreflightCheckResult } from "../../lib/diagnostics/preflightTypes";

import { styles } from "./styles";

const FIX_MODAL_MAX_LINES = 7;

export default function DiagnosticScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const autoRunDoneRef = useRef(false);
  const { projectData, updateProjectFiles, deleteFile, setPreferredBuildProfile } =
    useProject();

  const linkedRepo = (projectData as any)?.linkedRepo
    ? String((projectData as any).linkedRepo)
    : "";
  const linkedBranch = (projectData as any)?.linkedBranch
    ? String((projectData as any).linkedBranch)
    : "";

  const {
    headerStats,
    toast,
    busy,
    running,

    // preview
    previewVisible,
    setPreviewVisible,
    previewLabel,
    previewEntries,

    // issues list + run
    issueList,
    issuesFilter,
    setIssuesFilter,
    recommendedMode,
    toSeverity,
    openIssue,
    runDiagnostics,

    // results + fixes
    lastRunAt,
    counts,
    results,
    setReportVisible,
    fixableResults,
    smartFix,

    // fix progress modal
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
    closeIssue,
    openPreview,
    applyIssueFix,
  } = useDiagnosticScreen({
    projectData,
    linkedRepo,
    linkedBranch,
    setPreferredBuildProfile,
    navigation,
    updateProjectFiles,
    deleteFile,
  });

  const onDebug = () => {
    const fails = (results || []).filter((r: any) => r.status === "fail");
    const lines = fails.slice(0, 12).map((r: any) => `- ${r.title}: ${r.message || ""}`.trim());
    const msg =
      `Bitte debugge meinen Diagnostic Report.\n` +
      `Projekt: ${headerStats?.name || "?"}\n` +
      `Profil: ${headerStats?.profileLabel || "?"}\n` +
      (linkedRepo ? `Repo: ${linkedRepo}\n` : "") +
      (linkedBranch ? `Branch: ${linkedBranch}\n` : "") +
      `\nFails (${fails.length}):\n` +
      (lines.length ? lines.join("\n") : "(keine fails)\n") +
      `\n\nWenn du mehr Details brauchst: sag Bescheid, ich kann den vollständigen JSON-Report senden.`;

    navigation.navigate("Home", {
      screen: "Chat",
      params: { prefillText: msg },
    });
  };

  const allChecks: PreflightCheckResult[] = useMemo(() => {
    const arr = (results || []) as PreflightCheckResult[];
    const score = (s: string) => (s === "fail" ? 0 : s === "warn" ? 1 : 2);
    return [...arr].sort((a, b) => score(String(a.status)) - score(String(b.status)));
  }, [results]);

  // Optional: Auto-run diagnostics when navigated from Build Checklist.
  useEffect(() => {
    const wantsAutoRun = !!route?.params?.autoRun;
    if (!wantsAutoRun) return;
    if (autoRunDoneRef.current) return;
    if (busy || running) return;

    autoRunDoneRef.current = true;
    // Kick off with the current (already persisted) mode selection.
    runDiagnostics();

    // Prevent repeated auto-runs if user comes back.
    try {
      navigation.setParams({ autoRun: false });
    } catch {
      // ignore
    }
  }, [route?.params?.autoRun, busy, running, runDiagnostics, navigation]);

  const severityFor = useMemo(() => {
    return (r: PreflightCheckResult) => {
      const st = (r.status ?? "pass") as any;
      return toSeverity(st);
    };
  }, [toSeverity]);

  const checklist = (results && results.length ? results : []) as PreflightCheckResult[];
  const hasResults = checklist.length > 0;
  const hasIssues = (issueList || []).length > 0;
  const canFix = !!(fixableResults && fixableResults.length);

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
        styles={styles}
        maxLines={FIX_MODAL_MAX_LINES}
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
        onDebug={onDebug}
        debugDisabled={busy || running || !(results && results.length)}
        toast={toast}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.stack}>
          <SectionCard
            title="Aktionen"
            subtitle={
              lastRunAt
                ? `Letzter Scan: ${new Date(lastRunAt).toLocaleString()}`
                : "Noch kein Scan"
            }
            icon="pulse"
            right={
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.countBig}>{(counts?.fail || 0) + (counts?.warn || 0)}</Text>
                <Text style={styles.countLabel}>Issues</Text>
              </View>
            }
          >
            <View style={styles.countRow}>
              <View style={styles.countPill}>
                <Text style={styles.countPillNum}>{counts?.fail || 0}</Text>
                <Text style={styles.countPillLabel}>Critical</Text>
              </View>
              <View style={styles.countPill}>
                <Text style={styles.countPillNum}>{counts?.warn || 0}</Text>
                <Text style={styles.countPillLabel}>Warning</Text>
              </View>
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btnPrimary, (busy || running) && styles.disabled]}
                onPress={() => runDiagnostics()}
                disabled={busy || running}
              >
                <Ionicons name="scan" size={16} color={theme.palette.primary} />
                <Text style={styles.btnPrimaryText}>Scannen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.btnSecondary,
                  (!canFix || busy || running) && styles.disabled,
                ]}
                onPress={() => smartFix()}
                disabled={!canFix || busy || running}
              >
                <Ionicons name="construct" size={16} color={theme.palette.text.primary} />
                <Text style={styles.btnSecondaryText}>Fixen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnTertiary, !hasResults && styles.disabled]}
                onPress={() => setReportVisible(true)}
                disabled={!hasResults}
              >
                <Ionicons name="document-text" size={16} color={theme.palette.text.primary} />
                <Text style={styles.btnTertiaryText}>Report</Text>
              </TouchableOpacity>
            </View>
          </SectionCard>

          <SectionCard
            title="Checkliste"
            subtitle={
              hasResults
                ? `${checklist.length} Checks · Modus: ${String(recommendedMode || "").toUpperCase()}`
                : "Scanne, um die Checks zu sehen"
            }
            icon="list"
          >
            {!hasResults ? (
              <Text style={styles.muted}>
                Tippe auf Scannen. Danach siehst du hier alle geprueften Punkte inkl. Status.
              </Text>
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {checklist.map((r) => {
                  const sev = severityFor(r);
                  const hasFix = !!r.fix?.patch;
                  const clickable = r.status === "fail" || r.status === "warn";
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={styles.checkRow}
                      onPress={() => (clickable ? openIssue(r) : undefined)}
                      disabled={!clickable}
                      activeOpacity={0.85}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.checkTitle} numberOfLines={2}>
                          {r.title}
                        </Text>
                        {r.message ? (
                          <Text style={styles.checkMsg} numberOfLines={2}>
                            {r.message}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 6 }}>
                        <SeverityBadge severity={sev as any} />
                        {hasFix ? (
                          <Text style={styles.fixHint}>Fix verfuegbar</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </SectionCard>

          {hasIssues ? (
            <SectionCard
              title="Issues"
              subtitle="Tippe ein Issue fuer Details/Fix"
              icon="alert-circle"
            >
              <View style={styles.filtersRow}>
                {(["all", "critical", "warning"] as const).map((k) => {
                  const active = issuesFilter === k;
                  const label =
                    k === "all" ? "Alle" : k === "critical" ? "Kritisch" : "Warnung";
                  return (
                    <TouchableOpacity
                      key={k}
                      style={[
                        styles.filterChip,
                        active && styles.filterChipOn,
                        (busy || running) && styles.disabled,
                      ]}
                      onPress={() => setIssuesFilter(k)}
                      disabled={busy || running}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          active && styles.filterChipTextOn,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                {issueList.map((it) => {
                  const st = (it.status ?? "pass") as any;
                  const sev = toSeverity(st);
                  return (
                    <TouchableOpacity
                      key={it.id}
                      style={styles.issueRow}
                      onPress={() => openIssue(it)}
                      disabled={busy || running}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.issueTitle} numberOfLines={2}>
                          {it.title}
                        </Text>
                        {it.message ? (
                          <Text style={styles.issueMsg} numberOfLines={2}>
                            {it.message}
                          </Text>
                        ) : null}
                      </View>
                      <SeverityBadge severity={sev as any} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </SectionCard>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
