import React from "react";
import {
  Alert,
  LayoutAnimation,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ModeSelector } from "../../../components/diagnostics/ModeSelector";
import { SectionCard } from "../../../components/diagnostics/SectionCard";
import { theme } from "../../../theme";
import type { PreflightCheckResult } from "../../../lib/diagnostics/preflightTypes";
import type { Status } from "../types";

import { AUTOFIX_MAX } from "../hooks/useDiagnosticFixRunner";

const MAX_DETAILS = 10;

export function NonIssuesTabSection(props: {
  styles: any;
  tab: "overview" | "fixes";
  modeAdvanced: boolean;
  setModeAdvanced: React.Dispatch<React.SetStateAction<boolean>>;
  recommendedMode: any;
  selectedModes: any;
  setSelectedModes: any;
  modesAll: boolean;
  setModesAll: React.Dispatch<React.SetStateAction<boolean>>;
  busy: boolean;
  lastRunAt: number | null;
  counts: { fail: number; warn: number; pass: number };
  results: PreflightCheckResult[];
  setReportVisible: (v: boolean) => void;
  advancedOpen: boolean;
  toggleAdvanced: () => void;
  includeLocalChecks: boolean;
  setIncludeLocalChecks: (v: boolean) => void;
  includePipelineChecks: boolean;
  setIncludePipelineChecks: (v: boolean) => void;
  syncFixesToGitHub: boolean;
  setSyncFixesToGitHub: (v: boolean) => void;
  rerunAfterFix: boolean;
  setRerunAfterFix: (v: boolean) => void;
  copyReport: () => void;
  upload: () => void;
  uploadBusy: boolean;
  uploadCooldownLeftSec: number;
  runCiAutofix: () => void;
  ciFixing: boolean;
  linkedRepo: string;
  ciFixLog: string | null;
  setPreviewLabel: (v: string) => void;
  setPreviewEntries: (v: any[]) => void;
  setPreviewVisible: (v: boolean) => void;
  fixableResults: PreflightCheckResult[];
  smartFix: () => void;
  advancedFixesOpen: boolean;
  toggleAdvancedFixes: () => void;
  autoFixIncludeWarn: boolean;
  setAutoFixIncludeWarn: (v: boolean) => void;
  autoFixScope: "visible" | "all";
  setAutoFixScope: React.Dispatch<React.SetStateAction<"visible" | "all">>;
  selected: Record<string, boolean>;
  setSelected: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedCount: number;
  issueList: PreflightCheckResult[];
  applyFixList: (slice: PreflightCheckResult[], title: string) => Promise<void>;
  toSeverity: (s: Status) => any;
  runDiagnostics: () => void;
}) {
  const {
    styles,
    tab,
    modeAdvanced,
    setModeAdvanced,
    recommendedMode,
    selectedModes,
    setSelectedModes,
    modesAll,
    setModesAll,
    busy,
    lastRunAt,
    counts,
    results,
    setReportVisible,
    advancedOpen,
    toggleAdvanced,
    includeLocalChecks,
    setIncludeLocalChecks,
    includePipelineChecks,
    setIncludePipelineChecks,
    syncFixesToGitHub,
    setSyncFixesToGitHub,
    rerunAfterFix,
    setRerunAfterFix,
    copyReport,
    upload,
    uploadBusy,
    uploadCooldownLeftSec,
    runCiAutofix,
    ciFixing,
    linkedRepo,
    ciFixLog,
    setPreviewLabel,
    setPreviewEntries,
    setPreviewVisible,
    fixableResults,
    smartFix,
    advancedFixesOpen,
    toggleAdvancedFixes,
    autoFixIncludeWarn,
    setAutoFixIncludeWarn,
    autoFixScope,
    setAutoFixScope,
    selected,
    setSelected,
    selectedCount,
    issueList,
    applyFixList,
    toSeverity,
    runDiagnostics,
  } = props;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <View style={styles.stack}>
        {/* Mode is auto from build screen - no selector */}

        {tab === "overview" ? (
          <>
            <SectionCard
              title="Status"
              subtitle={
                lastRunAt
                  ? `Last run: ${new Date(lastRunAt).toLocaleString()}`
                  : "Noch keine Diagnose"
              }
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
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={() => runDiagnostics()}
                  disabled={busy}
                >
                  <Ionicons
                    name="play"
                    size={16}
                    color={theme.palette.primary}
                  />
                  <Text style={styles.btnPrimaryText}>Run Diagnostics</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={() => setReportVisible(true)}
                  disabled={!results.length}
                >
                  <Ionicons
                    name="document-text"
                    size={16}
                    color={theme.palette.text.primary}
                  />
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
                      <Text style={styles.switchHint}>
                        Checks auf deinen Projektdateien
                      </Text>
                    </View>
                    <Switch value={includeLocalChecks} onValueChange={setIncludeLocalChecks} />
                  </View>

                  <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchTitle}>Pipeline checks</Text>
                      <Text style={styles.switchHint}>
                        GitHub/EAS linkage & Workflows
                      </Text>
                    </View>
                    <Switch value={includePipelineChecks} onValueChange={setIncludePipelineChecks} />
                  </View>

                  <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchTitle}>Sync fixes to GitHub</Text>
                      <Text style={styles.switchHint}>
                        Nur wenn Repo verknüpft ist
                      </Text>
                    </View>
                    <Switch value={syncFixesToGitHub} onValueChange={setSyncFixesToGitHub} />
                  </View>

                  <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchTitle}>Re-run after fix</Text>
                      <Text style={styles.switchHint}>
                        Verifizieren, dass es “grün” ist
                      </Text>
                    </View>
                    <Switch value={rerunAfterFix} onValueChange={setRerunAfterFix} />
                  </View>

                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={styles.btnSecondary}
                      onPress={copyReport}
                      disabled={busy || !results.length}
                    >
                      <Ionicons
                        name="copy"
                        size={16}
                        color={theme.palette.text.primary}
                      />
                      <Text style={styles.btnSecondaryText}>Copy debug info</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnSecondary}
                      onPress={upload}
                      disabled={busy || uploadBusy || uploadCooldownLeftSec > 0}
                    >
                      <Ionicons
                        name="cloud-upload"
                        size={16}
                        color={theme.palette.text.primary}
                      />
                      <Text style={styles.btnSecondaryText}>
                        {uploadCooldownLeftSec > 0
                          ? `Upload (${uploadCooldownLeftSec}s)`
                          : "Upload"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.btnTertiary}
                    onPress={runCiAutofix}
                    disabled={ciFixing || !linkedRepo}
                  >
                    <Ionicons
                      name="build"
                      size={16}
                      color={theme.palette.text.primary}
                    />
                    <Text style={styles.btnTertiaryText}>
                      {ciFixing ? "Fixing CI…" : "Fix CI Workflows"}
                    </Text>
                  </TouchableOpacity>

                  {ciFixLog ? (
                    <TouchableOpacity
                      style={styles.btnTertiary}
                      onPress={() => {
                        setPreviewLabel("CI/Workflows Log");
                        setPreviewEntries([
                          { path: "CI_AUTOFIX", oldText: null, newText: ciFixLog },
                        ]);
                        setPreviewVisible(true);
                      }}
                    >
                      <Ionicons
                        name="eye"
                        size={16}
                        color={theme.palette.text.primary}
                      />
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
            <SectionCard
              title="Smart Fix"
              subtitle="Wendet nur empfohlene Fixes an (Critical)"
              icon="sparkles"
              right={
                <Text style={styles.pill}>
                  {
                    fixableResults.filter(
                      (r) => ((r.status ?? "pass") as Status) === "fail",
                    ).length
                  }
                </Text>
              }
            >
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={smartFix}
                disabled={busy || !fixableResults.length}
              >
                <Ionicons
                  name="flash"
                  size={16}
                  color={theme.palette.background}
                />
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
                        {autoFixScope === "visible"
                          ? "nur gefilterte Issues"
                          : "alle Fixes"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.scopeBtn}
                      onPress={() => setAutoFixScope((v) => (v === "visible" ? "all" : "visible"))}
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
                              color={
                                checked
                                  ? theme.palette.primaryLight
                                  : theme.palette.text.muted
                              }
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

                        const final = autoFixIncludeWarn
                          ? scoped
                          : scoped.filter((r) => ((r.status ?? "pass") as Status) === "fail");

                        if (!final.length) {
                          Alert.alert(
                            "Nichts gewählt",
                            "Deine Auswahl enthält keine empfohlenen Fixes.",
                          );
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
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={theme.palette.text.primary}
                      />
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
  );
}
