import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { theme } from "../theme";
import { useProject } from "../contexts/ProjectContext";
import { validateFilePath } from "../lib/validators";
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

type EasStatusState = {
  status: string;
  runUrl?: string | null;
  buildUrl?: string | null;
  artifactUrl?: string | null;
  updatedAtISO?: string;
};

type SyncStatusState = {
  status: string;
  conclusion?: string | null;
  runUrl?: string | null;
  updatedAtISO?: string;
};

const STORAGE_KEYS = {
  lastRepo: "k1w1:last_repo",
  lastEasJobId: "k1w1:last_eas_job_id",
};

export default function DiagnosticScreen() {
  const { projectData, triggerAutoFix } = useProject();

  // Diagnose
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  // Live Status
  const [lastRepo, setLastRepo] = useState<string>("");
  const [easJobIdInput, setEasJobIdInput] = useState<string>("");
  const [isRefreshingEas, setIsRefreshingEas] = useState(false);
  const [isRefreshingSync, setIsRefreshingSync] = useState(false);

  const [easState, setEasState] = useState<EasStatusState | null>(null);
  const [syncState, setSyncState] = useState<SyncStatusState | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const repo = (await AsyncStorage.getItem(STORAGE_KEYS.lastRepo)) || "";
        const jobId =
          (await AsyncStorage.getItem(STORAGE_KEYS.lastEasJobId)) || "";
        if (repo) setLastRepo(repo);
        if (jobId) setEasJobIdInput(jobId);
      } catch {
        // ignore
      }
    })();
  }, []);

  const openUrl = useCallback(async (url?: string | null) => {
    if (!url) return;
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        Alert.alert("Kann URL nicht öffnen", url);
        return;
      }
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert("URL Fehler", e?.message || "Konnte URL nicht öffnen");
    }
  }, []);

  const refreshEasStatus = useCallback(async () => {
    const jobIdNum = Number(easJobIdInput);
    if (!Number.isFinite(jobIdNum) || jobIdNum <= 0) {
      Alert.alert("JobId fehlt", "Bitte eine gültige EAS JobId eintragen.");
      return;
    }

    setIsRefreshingEas(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.lastEasJobId, String(jobIdNum));

      const res = await fetch(
        `${CONFIG.API.SUPABASE_EDGE_URL}/check-eas-build`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: jobIdNum }),
        },
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error || `check-eas-build failed (${res.status})`,
        );
      }

      const status = String(json?.status || "unknown");
      const runUrl = json?.urls?.html ?? null;
      const buildUrl = json?.urls?.build ?? null;
      const artifactUrl = json?.urls?.artifacts ?? null;

      setEasState({
        status,
        runUrl,
        buildUrl,
        artifactUrl,
        updatedAtISO: new Date().toISOString(),
      });
    } catch (e: any) {
      Alert.alert("EAS Status Fehler", e?.message || "Unbekannter Fehler");
    } finally {
      setIsRefreshingEas(false);
    }
  }, [easJobIdInput]);

  const refreshSyncStatus = useCallback(async () => {
    const repo = String(lastRepo || "").trim();
    if (!repo) {
      Alert.alert(
        "Repo fehlt",
        "Kein Repo gespeichert. Tipp hier dein Repo rein (owner/repo) oder triggere einmal „sync deps“ im Chat, damit es gespeichert wird.",
      );
      return;
    }

    setIsRefreshingSync(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.lastRepo, repo);

      const res = await fetch(
        `${CONFIG.API.SUPABASE_EDGE_URL}/github-workflow-runs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ githubRepo: repo, perPage: 20 }),
        },
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok || !Array.isArray(json?.runs)) {
        throw new Error(
          json?.error || `github-workflow-runs failed (${res.status})`,
        );
      }

      const runs: any[] = json.runs;

      // Wir suchen den letzten Run von "K1W1 Sync Native Deps"
      const match =
        runs
          .filter((r) =>
            String(r?.workflow_name || "").includes("K1W1 Sync Native Deps"),
          )
          .sort(
            (a, b) =>
              Date.parse(String(b?.created_at || "")) -
              Date.parse(String(a?.created_at || "")),
          )[0] || null;

      if (!match) {
        setSyncState({
          status: "not_found",
          conclusion: null,
          runUrl: null,
          updatedAtISO: new Date().toISOString(),
        });
        return;
      }

      setSyncState({
        status: String(match?.status || "unknown"),
        conclusion: match?.conclusion ? String(match.conclusion) : null,
        runUrl: match?.html_url ? String(match.html_url) : null,
        updatedAtISO: new Date().toISOString(),
      });
    } catch (e: any) {
      Alert.alert("Sync Status Fehler", e?.message || "Unbekannter Fehler");
    } finally {
      setIsRefreshingSync(false);
    }
  }, [lastRepo]);

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

  const renderStatusPill = (label: string, value?: string | null) => {
    const v = (value || "").toLowerCase();
    const isGood = v === "success" || v === "completed";
    const isBad = v === "failed" || v === "error";

    return (
      <View
        style={[
          styles.pill,
          isGood
            ? styles.pillGood
            : isBad
              ? styles.pillBad
              : styles.pillNeutral,
        ]}
      >
        <Text style={styles.pillText}>
          {label}: {value || "—"}
        </Text>
      </View>
    );
  };

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

      {/* ✅ Live Status Box */}
      <View style={styles.liveBox}>
        <View style={styles.liveTop}>
          <Ionicons name="pulse" size={16} color={theme.palette.primary} />
          <Text style={styles.liveTitle}>Live Status</Text>
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Repo</Text>
          <TextInput
            value={lastRepo}
            onChangeText={setLastRepo}
            placeholder="owner/repo"
            placeholderTextColor={theme.palette.text.muted}
            autoCapitalize="none"
            style={styles.input}
          />
          <TouchableOpacity
            style={[
              styles.smallBtn,
              isRefreshingSync && styles.smallBtnDisabled,
            ]}
            onPress={refreshSyncStatus}
            disabled={isRefreshingSync}
          >
            {isRefreshingSync ? (
              <ActivityIndicator />
            ) : (
              <>
                <Ionicons
                  name="refresh"
                  size={14}
                  color={theme.palette.background}
                />
                <Text style={styles.smallBtnText}>Sync</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {syncState ? (
          <View style={styles.statusRow}>
            {renderStatusPill("Sync", syncState.status)}
            {renderStatusPill("Conclusion", syncState.conclusion)}
            {!!syncState.runUrl && (
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => openUrl(syncState.runUrl)}
              >
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={theme.palette.primary}
                />
                <Text style={styles.linkText}>Run öffnen</Text>
              </TouchableOpacity>
            )}
            {!!syncState.updatedAtISO && (
              <Text style={styles.smallMuted}>
                {new Date(syncState.updatedAtISO).toLocaleString()}
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.smallMuted}>Noch kein Sync-Status geladen.</Text>
        )}

        <View style={styles.divider} />

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>EAS JobId</Text>
          <TextInput
            value={easJobIdInput}
            onChangeText={setEasJobIdInput}
            placeholder="z.B. 123"
            placeholderTextColor={theme.palette.text.muted}
            keyboardType="number-pad"
            style={styles.input}
          />
          <TouchableOpacity
            style={[
              styles.smallBtn,
              isRefreshingEas && styles.smallBtnDisabled,
            ]}
            onPress={refreshEasStatus}
            disabled={isRefreshingEas}
          >
            {isRefreshingEas ? (
              <ActivityIndicator />
            ) : (
              <>
                <Ionicons
                  name="refresh"
                  size={14}
                  color={theme.palette.background}
                />
                <Text style={styles.smallBtnText}>EAS</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {easState ? (
          <View style={styles.statusRow}>
            {renderStatusPill("Build", easState.status)}
            {!!easState.runUrl && (
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => openUrl(easState.runUrl)}
              >
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={theme.palette.primary}
                />
                <Text style={styles.linkText}>Run</Text>
              </TouchableOpacity>
            )}
            {!!easState.buildUrl && (
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => openUrl(easState.buildUrl)}
              >
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={theme.palette.primary}
                />
                <Text style={styles.linkText}>Build</Text>
              </TouchableOpacity>
            )}
            {!!easState.artifactUrl && (
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => openUrl(easState.artifactUrl)}
              >
                <Ionicons
                  name="download-outline"
                  size={16}
                  color={theme.palette.primary}
                />
                <Text style={styles.linkText}>APK</Text>
              </TouchableOpacity>
            )}
            {!!easState.updatedAtISO && (
              <Text style={styles.smallMuted}>
                {new Date(easState.updatedAtISO).toLocaleString()}
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.smallMuted}>Noch kein EAS-Status geladen.</Text>
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

  // ✅ Live Status Box
  liveBox: {
    margin: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    gap: 10,
  },
  liveTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveTitle: { color: theme.palette.text.primary, fontWeight: "800" },

  divider: {
    height: 1,
    backgroundColor: theme.palette.border,
    opacity: 0.9,
  },

  fieldRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fieldLabel: { width: 70, color: theme.palette.text.muted, fontWeight: "700" },
  input: {
    flex: 1,
    backgroundColor: theme.palette.background,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: theme.palette.text.primary,
  },

  smallBtn: {
    backgroundColor: theme.palette.primary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  smallBtnDisabled: { opacity: 0.7 },
  smallBtnText: {
    color: theme.palette.background,
    fontWeight: "900",
    fontSize: 12,
  },

  statusRow: { gap: 8 },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillNeutral: { backgroundColor: theme.palette.border },
  pillGood: { backgroundColor: theme.palette.primary },
  pillBad: { backgroundColor: theme.palette.error },
  pillText: {
    color: theme.palette.background,
    fontWeight: "900",
    fontSize: 12,
  },

  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  linkText: { color: theme.palette.primary, fontWeight: "800" },

  smallMuted: { color: theme.palette.text.muted, fontSize: 12 },

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
});
