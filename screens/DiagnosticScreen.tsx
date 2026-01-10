import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../theme";
import { useProject } from "../contexts/ProjectContext";
import { useGitHub } from "../contexts/GitHubContext";
import { validateFilePath } from "../lib/validators";
import {
  runBuildPipelineDiagnostics,
  triggerRemoteDiagnostics,
  fetchLatestRemoteDiagnosticsReport,
  type DiagnosticCheck,
  type RemoteDiagnosticsReport,
} from "../lib/diagnostics/buildPipelineDiagnostics";

type DiagnosticIssue = {
  id: string;
  type: "error" | "warning";
  category: string;
  file?: string;
  message: string;
  fixable: boolean;
  priority: "high" | "medium" | "low";
};

type DiagnosticReport = {
  timestamp: string;
  issues: DiagnosticIssue[];
};

export default function DiagnosticScreen() {
  const { projectData, triggerAutoFix } = useProject();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  const { activeRepo, activeBranch } = useGitHub();
  const [buildChecks, setBuildChecks] = useState<DiagnosticCheck[] | null>(
    null,
  );
  const [isBuildScanning, setIsBuildScanning] = useState(false);
  const [buildRef, setBuildRef] = useState<string>("main");
  const [isRemoteDiagTriggering, setIsRemoteDiagTriggering] = useState(false);
  const [remoteReport, setRemoteReport] =
    useState<RemoteDiagnosticsReport | null>(null);
  const [isRemoteReportLoading, setIsRemoteReportLoading] = useState(false);

  const runBuildScan = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert("Kein Repo", "Bitte wähle zuerst ein GitHub Repo aus.");
      return;
    }

    const [owner, repo] = activeRepo.split("/");
    if (!owner || !repo) {
      Alert.alert("Repo Format", 'Repo muss im Format "owner/repo" sein.');
      return;
    }

    const branch = activeBranch?.trim() || "main";

    setIsBuildScanning(true);
    setBuildChecks(null);
    try {
      const result = await runBuildPipelineDiagnostics({ owner, repo, branch });
      setBuildRef(result.ref);
      setBuildChecks(result.checks);
    } catch (e: any) {
      Alert.alert("Diagnostics Fehler", e?.message || "Unbekannter Fehler");
    } finally {
      setIsBuildScanning(false);
    }
  }, [activeRepo, activeBranch]);

  const loadLatestRemoteReport = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert("Kein Repo", "Bitte wähle zuerst ein GitHub Repo aus.");
      return;
    }
    const branch = activeBranch?.trim() || "main";
    setIsRemoteReportLoading(true);
    try {
      const report = await fetchLatestRemoteDiagnosticsReport({
        githubRepo: activeRepo,
        branch,
      });
      if (!report) {
        Alert.alert(
          "Kein Report",
          "Noch kein Remote-Report gefunden (Workflow evtl. noch läuft).",
        );
      }
      setRemoteReport(report);
    } catch (e: any) {
      Alert.alert("Remote Report Fehler", e?.message || "Unbekannter Fehler");
    } finally {
      setIsRemoteReportLoading(false);
    }
  }, [activeRepo, activeBranch]);
  const triggerRemoteDiag = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert("Kein Repo", "Bitte wähle zuerst ein GitHub Repo aus.");
      return;
    }

    const [owner, repo] = activeRepo.split("/");
    if (!owner || !repo) {
      Alert.alert("Repo Format", 'Repo muss im Format "owner/repo" sein.');
      return;
    }

    const branch = activeBranch?.trim() || "main";

    setIsRemoteDiagTriggering(true);
    setRemoteReport(null);
    try {
      await triggerRemoteDiagnostics({ owner, repo, branch });
      Alert.alert(
        "Remote Diagnostics gestartet",
        `Workflow wurde getriggert (Branch: ${branch}). Schau in GitHub Actions nach "k1w1 diagnostics".`,
      );
    } catch (e: any) {
      Alert.alert(
        "Remote Diagnostics Fehler",
        e?.message || "Unbekannter Fehler",
      );
    } finally {
      setIsRemoteDiagTriggering(false);
    }
  }, [activeRepo, activeBranch]);

  const analyze = useCallback(async () => {
    if (!projectData) {
      Alert.alert("Kein Projekt", "Bitte lade zuerst ein Projekt.");
      return;
    }

    setIsAnalyzing(true);

    try {
      const issues: DiagnosticIssue[] = [];
      const files = projectData.files || [];

      // --- Baseline Checks ---
      const hasPackageJson = files.some((f) => f.path === "package.json");
      if (!hasPackageJson) {
        issues.push({
          id: "missing-package-json",
          type: "error",
          category: "Projekt",
          file: "package.json",
          message: "package.json fehlt im Projekt.",
          fixable: true,
          priority: "high",
        });
      }

      const bigScreens = files
        .filter((f) => f.path.startsWith("screens/") && f.path.endsWith(".tsx"))
        .map((f) => ({
          path: f.path,
          lines: (f.content || "").split("\n").length,
        }))
        .filter((x) => x.lines >= 800)
        .sort((a, b) => b.lines - a.lines);

      if (bigScreens.length > 0) {
        issues.push({
          id: "big-screens",
          type: "warning",
          category: "Refactor",
          message:
            `Sehr große Screens gefunden:\n` +
            bigScreens
              .slice(0, 6)
              .map((s) => `- ${s.path}: ~${s.lines} Zeilen`)
              .join("\n") +
            `\n\nEmpfehlung: Styles/Components/Helpers schrittweise auslagern.`,
          fixable: false,
          priority: "medium",
        });
      }

      // --- “Fixable” nur wenn Datei laut Policy erlaubt ist ---
      for (const issue of issues) {
        if (!issue.fixable || !issue.file) continue;
        const res = validateFilePath(issue.file);
        if (!res.valid) {
          issue.fixable = false;
          issue.message +=
            "\n\n🔒 Auto-Fix deaktiviert: Datei ist außerhalb erlaubter Pfade/Policy.";
        }
      }

      setReport({ timestamp: new Date().toISOString(), issues });
    } catch (e: any) {
      Alert.alert(
        "Diagnose fehlgeschlagen",
        e?.message || "Unbekannter Fehler",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectData]);

  const sortedIssues = useMemo(() => {
    if (!report?.issues) return [];
    const prio = { high: 0, medium: 1, low: 2 } as const;
    return [...report.issues].sort(
      (a, b) => prio[a.priority] - prio[b.priority],
    );
  }, [report]);

  const sendFixToChat = useCallback(
    (issue: DiagnosticIssue) => {
      const msg =
        `🔧 Auto-Fix Request\n\n` +
        `Kategorie: ${issue.category}\n` +
        (issue.file ? `Datei: ${issue.file}\n` : "") +
        `Problem: ${issue.message}\n\n` +
        `Bitte fixen und vollständige Datei ausgeben.`;

      triggerAutoFix(msg);
      Alert.alert("Gesendet", "Fix-Anfrage wurde vorbereitet (Auto-Fix).");
    },
    [triggerAutoFix],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Projekt Diagnose</Text>

        <TouchableOpacity
          style={styles.analyzeBtn}
          onPress={analyze}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <ActivityIndicator />
          ) : (
            <>
              <Ionicons
                name="search"
                size={16}
                color={theme.palette.background}
              />
              <Text style={styles.analyzeBtnText}>Analysieren</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Build Pipeline Preflight</Text>

        <View style={styles.row}>
          <Text style={styles.metaText}>
            Repo: {activeRepo || "—"}
            {"\n"}Branch: {activeBranch || "main"} (Scan-Ref: {buildRef})
          </Text>
        </View>

        <View style={styles.rowButtons}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={runBuildScan}
            disabled={isBuildScanning}
          >
            {isBuildScanning ? (
              <ActivityIndicator />
            ) : (
              <>
                <Ionicons
                  name="pulse"
                  size={16}
                  color={theme.palette.background}
                />
                <Text style={styles.secondaryBtnText}>Preflight Scan</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={triggerRemoteDiag}
            disabled={isRemoteDiagTriggering}
          >
            {isRemoteDiagTriggering ? (
              <ActivityIndicator />
            ) : (
              <>
                <Ionicons
                  name="cloud-upload"
                  size={16}
                  color={theme.palette.background}
                />
                <Text style={styles.secondaryBtnText}>Remote Check</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.remoteReportBox}>
          <View style={styles.remoteReportHeader}>
            <Text style={styles.remoteReportTitle}>
              Remote Ergebnis (Supabase)
            </Text>
            <TouchableOpacity
              style={styles.remoteReportBtn}
              onPress={loadLatestRemoteReport}
              disabled={isRemoteReportLoading}
            >
              {isRemoteReportLoading ? (
                <ActivityIndicator />
              ) : (
                <>
                  <Ionicons
                    name="refresh"
                    size={16}
                    color={theme.palette.background}
                  />
                  <Text style={styles.remoteReportBtnText}>Aktualisieren</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {remoteReport ? (
            <View>
              <Text style={styles.remoteReportLine}>
                Status: {remoteReport.status} · Branch: {remoteReport.branch}
              </Text>
              <Text style={styles.remoteReportLine}>
                projectId: {remoteReport.project_id || "<missing>"}
              </Text>
              <Text style={styles.remoteReportLine}>
                created: {remoteReport.created_at}
              </Text>
              {!!remoteReport.errors?.length && (
                <View style={styles.remoteReportErrors}>
                  {remoteReport.errors.slice(0, 3).map((e: any, i: number) => (
                    <Text key={String(i)} style={styles.remoteReportErrorText}>
                      - {e.code}: {e.message}
                    </Text>
                  ))}
                  {remoteReport.errors.length > 3 && (
                    <Text style={styles.remoteReportErrorText}>
                      … ({remoteReport.errors.length - 3} weitere)
                    </Text>
                  )}
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.remoteReportMuted}>
              Kein Remote-Report geladen. Starte „Remote Check“ und drück dann
              „Aktualisieren“.
            </Text>
          )}
        </View>

        {buildChecks && (
          <View style={styles.checkList}>
            {buildChecks.map((c) => (
              <View key={c.id} style={styles.checkItem}>
                <View style={styles.checkLeft}>
                  <Ionicons
                    name={
                      c.status === "pass"
                        ? "checkmark-circle"
                        : c.status === "fail"
                          ? "close-circle"
                          : c.status === "warn"
                            ? "alert-circle"
                            : "information-circle"
                    }
                    size={18}
                    color={
                      c.status === "pass"
                        ? theme.palette.primary
                        : c.status === "fail"
                          ? theme.palette.error
                          : c.status === "warn"
                            ? theme.palette.warning
                            : theme.palette.text.muted
                    }
                  />
                  <Text style={styles.checkTitle}>{c.title}</Text>
                </View>

                {(c.details || c.fixHint) && (
                  <View style={styles.checkMeta}>
                    {c.details ? (
                      <Text style={styles.checkDetails}>{c.details}</Text>
                    ) : null}
                    {c.fixHint ? (
                      <Text style={styles.checkHint}>{c.fixHint}</Text>
                    ) : null}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {!report ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Noch kein Report</Text>
          <Text style={styles.emptyText}>
            Tippe auf „Analysieren“, um Probleme zu finden.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.timestamp}>
            Stand: {new Date(report.timestamp).toLocaleString()}
          </Text>

          {sortedIssues.length === 0 ? (
            <View style={styles.okBox}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={theme.palette.primary}
              />
              <Text style={styles.okText}>Keine Probleme gefunden 🎉</Text>
            </View>
          ) : (
            sortedIssues.map((issue) => (
              <View key={issue.id} style={styles.issue}>
                <View style={styles.issueTop}>
                  <View
                    style={[
                      styles.badge,
                      issue.type === "error"
                        ? styles.badgeError
                        : styles.badgeWarn,
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      {issue.type.toUpperCase()}
                    </Text>
                  </View>

                  <Text style={styles.issueCat}>{issue.category}</Text>
                  <View style={{ flex: 1 }} />

                  {issue.fixable ? (
                    <TouchableOpacity
                      style={styles.fixBtn}
                      onPress={() => sendFixToChat(issue)}
                    >
                      <Ionicons
                        name="hammer"
                        size={16}
                        color={theme.palette.background}
                      />
                      <Text style={styles.fixBtnText}>Fix</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.noFixPill}>
                      <Text style={styles.noFixText}>Kein Fix</Text>
                    </View>
                  )}
                </View>

                {!!issue.file && <Text style={styles.file}>{issue.file}</Text>}
                <Text style={styles.msg}>{issue.message}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.palette.background },

  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: theme.palette.text.primary },

  analyzeBtn: {
    marginLeft: "auto",
    backgroundColor: theme.palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  analyzeBtnText: { color: theme.palette.background, fontWeight: "700" },

  empty: { padding: 16, gap: 8 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.palette.text.primary,
  },
  emptyText: { color: theme.palette.text.muted },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  timestamp: { color: theme.palette.text.muted, fontSize: 12 },

  okBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.palette.card,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  okText: { color: theme.palette.text.primary, fontWeight: "600" },

  issue: {
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  issueTop: { flexDirection: "row", alignItems: "center", gap: 8 },

  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeError: { backgroundColor: theme.palette.error },
  badgeWarn: { backgroundColor: theme.palette.warning },
  badgeText: {
    color: theme.palette.background,
    fontSize: 11,
    fontWeight: "800",
  },

  issueCat: { color: theme.palette.text.primary, fontWeight: "700" },

  fixBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.palette.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  fixBtnText: {
    color: theme.palette.background,
    fontWeight: "800",
    fontSize: 12,
  },

  noFixPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.palette.border,
  },
  noFixText: {
    color: theme.palette.text.muted,
    fontWeight: "700",
    fontSize: 12,
  },

  file: {
    fontFamily: "monospace",
    color: theme.palette.text.muted,
    fontSize: 12,
  },
  msg: { color: theme.palette.text.primary, lineHeight: 18 },

  // --- Build Pipeline Preflight ---
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.palette.text.primary,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  metaText: { color: theme.palette.text.muted, fontSize: 12 },
  rowButtons: { flexDirection: "row", gap: 10 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  secondaryBtnText: { color: theme.palette.text.primary, fontWeight: "800" },

  remoteReportBox: {
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  remoteReportHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  remoteReportTitle: { color: theme.palette.text.primary, fontWeight: "800" },
  remoteReportBtn: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  remoteReportBtnText: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 12,
  },
  remoteReportLine: { color: theme.palette.text.primary, fontSize: 12 },
  remoteReportErrors: { gap: 4, marginTop: 4 },
  remoteReportErrorText: { color: theme.palette.text.muted, fontSize: 12 },
  remoteReportMuted: { color: theme.palette.text.muted, fontSize: 12 },

  checkList: { gap: 10 },
  checkItem: {
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  checkLeft: { flex: 1, gap: 6 },
  checkTitle: { color: theme.palette.text.primary, fontWeight: "800" },
  checkMeta: { gap: 2 },
  checkDetails: { color: theme.palette.text.muted, fontSize: 12 },
  checkHint: { color: theme.palette.text.muted, fontSize: 12 },
});
