import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../theme";
import { useProject } from "../contexts/ProjectContext";
import { validateFilePath } from "../lib/validators";
import { useGitHub } from "../contexts/GitHubContext";
import { CONFIG } from "../config";

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

type NativeSyncState = {
  status: "idle" | "running" | "success" | "error" | "queued" | "dispatched";
  message?: string;
  jobId?: string;
  run?: {
    id: number;
    status: string;
    conclusion: string | null;
    html_url: string;
    display_title?: string;
    created_at?: string;
    updated_at?: string;
  } | null;
};

export default function DiagnosticScreen() {
  const { projectData, triggerAutoFix } = useProject();
  const { activeRepo } = useGitHub();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  const [syncState, setSyncState] = useState<NativeSyncState>({
    status: "idle",
    run: null,
  });

  const [isSyncBusy, setIsSyncBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLogsBusy, setIsLogsBusy] = useState(false);

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

  const openRepoActions = useCallback(() => {
    if (!activeRepo) {
      Alert.alert("Kein Repo", "Bitte zuerst ein Repo auswählen.");
      return;
    }
    const url = `https://github.com/${activeRepo}/actions`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Fehler", "Konnte GitHub Actions nicht öffnen."),
    );
  }, [activeRepo]);

  const triggerNativeSync = useCallback(
    async (opts?: { createPr?: boolean }) => {
      if (!activeRepo) {
        Alert.alert(
          "Kein GitHub Repo",
          "Bitte erst ein Repo auswählen (GitHub Repos Screen).",
        );
        return;
      }

      setIsSyncBusy(true);
      setLogs([]);

      try {
        const res = await fetch(
          `${CONFIG.API.SUPABASE_EDGE_URL}/trigger-native-sync`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              githubRepo: activeRepo,
              ref: "main",
              inputs: {
                apply: "true",
                create_pr: opts?.createPr ? "true" : "false",
                base_ref: "main",
              },
            }),
          },
        );

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok)
          throw new Error(json?.error || `Trigger failed (${res.status})`);

        const jobId = String(json.jobId || "");

        setSyncState({
          status: "dispatched",
          message:
            "Workflow getriggert. Status wird geloggt – du kannst gleich “Refresh” drücken.",
          jobId,
          run: null,
        });

        Alert.alert(
          "Sync gestartet",
          `JobId: ${jobId}\n\nJetzt kannst du per “Refresh” den Run-Status holen.`,
        );
      } catch (e: any) {
        setSyncState({
          status: "error",
          message: e?.message || "Unbekannter Fehler",
          jobId: syncState.jobId,
          run: null,
        });
        Alert.alert("Sync fehlgeschlagen", e?.message || "Unbekannter Fehler");
      } finally {
        setIsSyncBusy(false);
      }
    },
    [activeRepo, syncState.jobId],
  );

  const refreshNativeSyncStatus = useCallback(async () => {
    if (!syncState.jobId) {
      Alert.alert(
        "Kein Job",
        "Starte zuerst “Sync deps”, damit eine JobId existiert.",
      );
      return;
    }

    setIsSyncBusy(true);
    try {
      const res = await fetch(
        `${CONFIG.API.SUPABASE_EDGE_URL}/check-native-sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: syncState.jobId }),
        },
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok)
        throw new Error(json?.error || `Check failed (${res.status})`);

      const jobStatus = String(json?.job?.status || "running");
      const run = json?.run || null;

      setSyncState((prev) => ({
        ...prev,
        status: jobStatus as any,
        message: json?.job?.error_message
          ? String(json.job.error_message)
          : prev.message,
        run,
      }));
    } catch (e: any) {
      Alert.alert(
        "Status-Check fehlgeschlagen",
        e?.message || "Unbekannter Fehler",
      );
    } finally {
      setIsSyncBusy(false);
    }
  }, [syncState.jobId]);

  const fetchLogs = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert("Kein Repo", "Bitte erst ein Repo auswählen.");
      return;
    }
    if (!syncState.run?.id) {
      Alert.alert(
        "Kein Run",
        "Erst “Refresh” drücken, bis ein Run gefunden wurde.",
      );
      return;
    }

    setIsLogsBusy(true);
    try {
      const res = await fetch(
        `${CONFIG.API.SUPABASE_EDGE_URL}/github-workflow-logs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            githubRepo: activeRepo,
            runId: String(syncState.run.id),
          }),
        },
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok)
        throw new Error(json?.error || `Logs failed (${res.status})`);

      const lines: string[] = Array.isArray(json.logs)
        ? json.logs.map((l: any) => String(l?.message ?? l)).filter(Boolean)
        : [];

      // show last 25 lines
      setLogs(lines.slice(-25));
    } catch (e: any) {
      Alert.alert("Logs fehlgeschlagen", e?.message || "Unbekannter Fehler");
    } finally {
      setIsLogsBusy(false);
    }
  }, [activeRepo, syncState.run?.id]);

  const syncBadge = useMemo(() => {
    const s = syncState.status;
    if (s === "running" || s === "queued" || s === "dispatched")
      return {
        icon: "time",
        label: String(s).toUpperCase(),
        style: styles.badgeWarn,
      };
    if (s === "success")
      return { icon: "checkmark-circle", label: "OK", style: styles.badgeOk };
    if (s === "error")
      return { icon: "close-circle", label: "ERROR", style: styles.badgeError };
    return { icon: "ellipse-outline", label: "IDLE", style: styles.badgeIdle };
  }, [syncState.status]);

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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Native Sync Box */}
        <View style={styles.box}>
          <View style={styles.boxTop}>
            <Text style={styles.boxTitle}>Native Deps Sync</Text>

            <View style={[styles.badge, syncBadge.style]}>
              <Ionicons
                name={syncBadge.icon as any}
                size={14}
                color={theme.palette.background}
              />
              <Text style={styles.badgeText}>{syncBadge.label}</Text>
            </View>
          </View>

          <Text style={styles.boxText}>
            Scannt Imports → installiert fehlende Dependencies → erzeugt
            Autogen-Report (Artifact).
          </Text>

          <Text style={styles.boxMeta}>
            Repo: {activeRepo ? activeRepo : "— (nicht ausgewählt)"}
          </Text>
          {!!syncState.jobId && (
            <Text style={styles.boxMeta}>
              JobId (Supabase build_jobs): {syncState.jobId}
            </Text>
          )}

          {!!syncState.run?.html_url && (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => Linking.openURL(syncState.run!.html_url)}
            >
              <Ionicons
                name="open-outline"
                size={16}
                color={theme.palette.text.primary}
              />
              <Text style={styles.linkBtnText}>Open Run</Text>
            </TouchableOpacity>
          )}

          {!!syncState.message && (
            <Text style={styles.boxHint}>Info: {syncState.message}</Text>
          )}

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.smallBtn, isSyncBusy && styles.smallBtnDisabled]}
              onPress={() => triggerNativeSync({ createPr: false })}
              disabled={isSyncBusy}
            >
              {isSyncBusy ? (
                <ActivityIndicator />
              ) : (
                <>
                  <Ionicons
                    name="refresh"
                    size={16}
                    color={theme.palette.background}
                  />
                  <Text style={styles.smallBtnText}>Sync deps</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallBtn, isSyncBusy && styles.smallBtnDisabled]}
              onPress={() => triggerNativeSync({ createPr: true })}
              disabled={isSyncBusy}
            >
              <Ionicons
                name="git-pull-request"
                size={16}
                color={theme.palette.background}
              />
              <Text style={styles.smallBtnText}>Sync + PR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.smallBtnAlt,
                isSyncBusy && styles.smallBtnDisabled,
              ]}
              onPress={refreshNativeSyncStatus}
              disabled={isSyncBusy}
            >
              <Ionicons
                name="reload"
                size={16}
                color={theme.palette.text.primary}
              />
              <Text style={styles.smallBtnAltText}>Refresh</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.smallBtnAlt,
                isLogsBusy && styles.smallBtnDisabled,
              ]}
              onPress={fetchLogs}
              disabled={isLogsBusy}
            >
              {isLogsBusy ? (
                <ActivityIndicator />
              ) : (
                <Ionicons
                  name="document-text-outline"
                  size={16}
                  color={theme.palette.text.primary}
                />
              )}
              <Text style={styles.smallBtnAltText}>Logs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.smallBtnAlt}
              onPress={openRepoActions}
            >
              <Ionicons
                name="open-outline"
                size={16}
                color={theme.palette.text.primary}
              />
              <Text style={styles.smallBtnAltText}>Actions</Text>
            </TouchableOpacity>
          </View>

          {/* Run summary */}
          {!!syncState.run && (
            <View style={styles.runBox}>
              <Text style={styles.runTitle}>Run</Text>
              <Text style={styles.runText}>
                Title: {syncState.run.display_title || "—"}
              </Text>
              <Text style={styles.runText}>Status: {syncState.run.status}</Text>
              <Text style={styles.runText}>
                Conclusion: {syncState.run.conclusion ?? "—"}
              </Text>
            </View>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <View style={styles.logsBox}>
              <Text style={styles.runTitle}>Logs (last lines)</Text>
              {logs.map((l, idx) => (
                <Text key={String(idx)} style={styles.logLine}>
                  {l}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Existing diagnostics report */}
        {!report ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Noch kein Report</Text>
            <Text style={styles.emptyText}>
              Tippe auf „Analysieren“, um Probleme zu finden.
            </Text>
          </View>
        ) : (
          <>
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

                  {!!issue.file && (
                    <Text style={styles.file}>{issue.file}</Text>
                  )}
                  <Text style={styles.msg}>{issue.message}</Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
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

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  box: {
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  boxTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  boxTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.palette.text.primary,
  },
  boxText: { color: theme.palette.text.primary, lineHeight: 18 },
  boxHint: { color: theme.palette.text.muted, fontSize: 12, lineHeight: 16 },
  boxMeta: { color: theme.palette.text.muted, fontSize: 12 },

  row: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 4 },

  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.palette.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  linkBtnText: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 12,
  },

  smallBtn: {
    backgroundColor: theme.palette.primary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  smallBtnDisabled: { opacity: 0.55 },
  smallBtnText: {
    color: theme.palette.background,
    fontWeight: "800",
    fontSize: 12,
  },

  smallBtnAlt: {
    backgroundColor: theme.palette.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  smallBtnAltText: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 12,
  },

  runBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    gap: 4,
  },
  runTitle: {
    fontWeight: "800",
    color: theme.palette.text.primary,
    marginBottom: 4,
  },
  runText: { color: theme.palette.text.primary, fontSize: 12 },

  logsBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    gap: 4,
  },
  logLine: {
    color: theme.palette.text.muted,
    fontSize: 11,
    fontFamily: "monospace",
  },

  // existing
  empty: { padding: 16, gap: 8 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.palette.text.primary,
  },
  emptyText: { color: theme.palette.text.muted },

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

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeError: { backgroundColor: theme.palette.error },
  badgeWarn: { backgroundColor: theme.palette.warning },
  badgeOk: { backgroundColor: theme.palette.primary },
  badgeIdle: { backgroundColor: theme.palette.border },
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
});
