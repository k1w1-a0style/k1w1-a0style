import React, { useCallback, useMemo, useState, useEffect } from "react";
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

const STORAGE_KEYS = {
  lastRepo: "k1w1:last_repo",
  lastNativeJobId: "k1w1:last_native_sync_job_id",
  lastEasJobId: "k1w1:last_eas_job_id",
};

async function safeGet(key: string) {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

type NativeAutogenReport = {
  ok?: boolean;
  startedAt?: string;
  apply?: boolean;
  packageManager?: string;
  stats?: {
    scannedFiles?: number;
    foundImports?: number;
    foundPlugins?: number;
    missingPackages?: number;
    installedPackages?: number;
    errors?: number;
  };
  missing?: {
    deps?: string[];
  };
  found?: {
    imports?: string[];
    expoPlugins?: string[];
  };
  errors?: any[];
};

function isExpoInstallPkg(pkg: string) {
  if (!pkg) return false;
  if (pkg.startsWith("expo-")) return true;

  // typisches Expo/RN native Zeug
  const expoFavs = new Set([
    "react-native-reanimated",
    "react-native-gesture-handler",
    "react-native-screens",
    "react-native-safe-area-context",
    "react-native-webview",
    "expo-image-picker",
    "expo-file-system",
    "expo-notifications",
    "expo-location",
    "expo-camera",
    "expo-av",
    "expo-clipboard",
    "expo-router",
  ]);
  return expoFavs.has(pkg);
}

function splitMissing(missing: string[]) {
  const expoInstall: string[] = [];
  const npmInstall: string[] = [];

  for (const p of missing) {
    if (isExpoInstallPkg(p)) expoInstall.push(p);
    else npmInstall.push(p);
  }

  // unique + stable
  const uniq = (arr: string[]) =>
    Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));

  return {
    expoInstall: uniq(expoInstall),
    npmInstall: uniq(npmInstall),
  };
}

function buildExpoCommand(pkgs: string[]) {
  if (!pkgs.length) return "";
  return `npx expo install ${pkgs.join(" ")}`;
}

function buildNpmCommand(pkgs: string[]) {
  if (!pkgs.length) return "";
  return `npm install ${pkgs.join(" ")}`;
}

function buildAllCommands(expoCmd: string, npmCmd: string) {
  const parts = [expoCmd, npmCmd].filter(Boolean);
  return parts.join("\n");
}

export default function DiagnosticScreen() {
  const { projectData, triggerAutoFix } = useProject();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  // auto-saved status
  const [savedRepo, setSavedRepo] = useState<string>("");
  const [savedNativeJobId, setSavedNativeJobId] = useState<string>("");
  const [savedEasJobId, setSavedEasJobId] = useState<string>("");

  const [nativeStatus, setNativeStatus] = useState<string>("");
  const [nativeRunUrl, setNativeRunUrl] = useState<string>("");
  const [easStatus, setEasStatus] = useState<string>("");
  const [easRunUrl, setEasRunUrl] = useState<string>("");
  const [easArtifactUrl, setEasArtifactUrl] = useState<string>("");

  // Native report state
  const [isLoadingNativeReport, setIsLoadingNativeReport] = useState(false);
  const [nativeReport, setNativeReport] = useState<NativeAutogenReport | null>(
    null,
  );
  const [showNativeReport, setShowNativeReport] = useState(false);

  // NEW: split command toggles
  const [showExpoCmd, setShowExpoCmd] = useState(false);
  const [showNpmCmd, setShowNpmCmd] = useState(false);
  const [showAllCmds, setShowAllCmds] = useState(false);

  const loadSaved = useCallback(async () => {
    const r = (await safeGet(STORAGE_KEYS.lastRepo)) || "";
    const n = (await safeGet(STORAGE_KEYS.lastNativeJobId)) || "";
    const e = (await safeGet(STORAGE_KEYS.lastEasJobId)) || "";
    setSavedRepo(r);
    setSavedNativeJobId(n);
    setSavedEasJobId(e);
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const refreshNative = useCallback(async () => {
    if (!savedNativeJobId) {
      Alert.alert(
        "Kein Job",
        "Kein gespeicherter Native-Sync JobId vorhanden.",
      );
      return;
    }
    try {
      const res = await fetch(
        `${CONFIG.API.SUPABASE_EDGE_URL}/check-native-sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: savedNativeJobId }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok)
        throw new Error(json?.error || `HTTP ${res.status}`);

      setNativeStatus(String(json.status || json.job?.status || ""));
      setNativeRunUrl(String(json.run?.html_url || ""));
    } catch (e: any) {
      Alert.alert(
        "Native-Sync Status Fehler",
        e?.message || "Unbekannter Fehler",
      );
    }
  }, [savedNativeJobId]);

  const refreshEas = useCallback(async () => {
    if (!savedEasJobId) {
      Alert.alert("Kein Job", "Kein gespeicherter EAS JobId vorhanden.");
      return;
    }
    try {
      const res = await fetch(
        `${CONFIG.API.SUPABASE_EDGE_URL}/check-eas-build`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: savedEasJobId }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok)
        throw new Error(json?.error || `HTTP ${res.status}`);

      setEasStatus(String(json.status || ""));
      setEasRunUrl(String(json.urls?.html || ""));
      setEasArtifactUrl(String(json.urls?.artifacts || ""));
    } catch (e: any) {
      Alert.alert("EAS Status Fehler", e?.message || "Unbekannter Fehler");
    }
  }, [savedEasJobId]);

  // Fetch latest native report for saved jobId
  const fetchLatestNativeReport = useCallback(async () => {
    if (!savedNativeJobId) {
      Alert.alert(
        "Kein Job",
        "Kein gespeicherter Native-Sync JobId vorhanden.",
      );
      return;
    }

    setIsLoadingNativeReport(true);
    try {
      const res = await fetch(
        `${CONFIG.API.SUPABASE_EDGE_URL}/native-sync-report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: savedNativeJobId }),
        },
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok)
        throw new Error(json?.error || `HTTP ${res.status}`);

      const autogen: NativeAutogenReport | null = json?.report?.report ?? null;

      if (!autogen) {
        setNativeReport(null);
        setShowNativeReport(true);
        setShowExpoCmd(false);
        setShowNpmCmd(false);
        setShowAllCmds(false);
        Alert.alert(
          "Kein Report",
          "Für diesen Job wurde noch kein Report gespeichert (oder ingest fehlt).",
        );
        return;
      }

      setNativeReport(autogen);
      setShowNativeReport(true);

      // reset toggles on new report
      setShowExpoCmd(false);
      setShowNpmCmd(false);
      setShowAllCmds(false);
    } catch (e: any) {
      Alert.alert("Report Fehler", e?.message || "Unbekannter Fehler");
    } finally {
      setIsLoadingNativeReport(false);
    }
  }, [savedNativeJobId]);

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

  const pill = (label: string, value: string) => (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue} numberOfLines={1}>
        {value || "—"}
      </Text>
    </View>
  );

  const missingDeps = nativeReport?.missing?.deps ?? [];
  const { expoInstall, npmInstall } = splitMissing(missingDeps);

  const expoCmd = buildExpoCommand(expoInstall);
  const npmCmd = buildNpmCommand(npmInstall);
  const allCmds = buildAllCommands(expoCmd, npmCmd);

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

      {/* Live Status */}
      <View style={styles.statusCard}>
        <View style={styles.statusTop}>
          <Text style={styles.statusTitle}>Live Status (Auto-Save)</Text>
          <TouchableOpacity onPress={loadSaved} style={styles.iconBtn}>
            <Ionicons
              name="refresh"
              size={16}
              color={theme.palette.text.primary}
            />
          </TouchableOpacity>
        </View>

        {pill("Repo", savedRepo)}
        {pill("Native JobId", savedNativeJobId)}
        {pill("EAS JobId", savedEasJobId)}

        <View style={styles.statusRow}>
          <TouchableOpacity style={styles.smallBtn} onPress={refreshNative}>
            <Ionicons name="pulse" size={16} color={theme.palette.background} />
            <Text style={styles.smallBtnText}>Native</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.smallBtn} onPress={refreshEas}>
            <Ionicons name="cube" size={16} color={theme.palette.background} />
            <Text style={styles.smallBtnText}>EAS</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusDetails}>
          <Text style={styles.statusLine}>
            🧩 Native: <Text style={styles.mono}>{nativeStatus || "—"}</Text>
          </Text>
          {!!nativeRunUrl && (
            <Text style={styles.statusSub}>Run: {nativeRunUrl}</Text>
          )}

          <Text style={styles.statusLine}>
            📦 EAS: <Text style={styles.mono}>{easStatus || "—"}</Text>
          </Text>
          {!!easRunUrl && (
            <Text style={styles.statusSub}>Run: {easRunUrl}</Text>
          )}
          {!!easArtifactUrl && (
            <Text style={styles.statusSub}>Artifact: {easArtifactUrl}</Text>
          )}
        </View>

        {/* Native Report Button */}
        <View style={styles.reportRow}>
          <TouchableOpacity
            style={[
              styles.reportBtn,
              isLoadingNativeReport ? styles.btnDisabled : null,
            ]}
            onPress={fetchLatestNativeReport}
            disabled={isLoadingNativeReport}
          >
            {isLoadingNativeReport ? (
              <ActivityIndicator />
            ) : (
              <>
                <Ionicons
                  name="document-text"
                  size={16}
                  color={theme.palette.background}
                />
                <Text style={styles.reportBtnText}>Letzten Native-Report</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.reportBtnSecondary,
              !nativeReport ? styles.btnDisabled : null,
            ]}
            onPress={() => setShowNativeReport((v) => !v)}
            disabled={!nativeReport}
          >
            <Ionicons
              name={showNativeReport ? "chevron-up" : "chevron-down"}
              size={16}
              color={theme.palette.text.primary}
            />
            <Text style={styles.reportBtnSecondaryText}>
              {showNativeReport ? "Hide" : "Show"}
            </Text>
          </TouchableOpacity>
        </View>

        {showNativeReport && (
          <View style={styles.reportBox}>
            {!nativeReport ? (
              <Text style={styles.reportEmpty}>Kein Report geladen.</Text>
            ) : (
              <>
                <View style={styles.reportTop}>
                  <Text style={styles.reportTitle}>Native Sync Report</Text>
                  <View style={styles.reportPill}>
                    <Text style={styles.reportPillText}>
                      {nativeReport.ok ? "OK" : "FAIL"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.reportMeta}>
                  Started:{" "}
                  <Text style={styles.mono}>
                    {nativeReport.startedAt || "—"}
                  </Text>
                </Text>
                <Text style={styles.reportMeta}>
                  Missing total:{" "}
                  <Text style={styles.mono}>{missingDeps.length}</Text>
                </Text>
                <Text style={styles.reportMeta}>
                  Expo install:{" "}
                  <Text style={styles.mono}>{expoInstall.length}</Text> | npm
                  install: <Text style={styles.mono}>{npmInstall.length}</Text>
                </Text>

                {missingDeps.length > 0 ? (
                  <View style={styles.missingList}>
                    {missingDeps.slice(0, 40).map((p) => (
                      <Text key={p} style={styles.missingItem}>
                        • {p}
                      </Text>
                    ))}
                    {missingDeps.length > 40 && (
                      <Text style={styles.reportMeta}>
                        … +{missingDeps.length - 40} weitere
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.reportMeta}>
                    Keine fehlenden Dependencies 🎉
                  </Text>
                )}

                {/* NEW: Command Buttons */}
                {missingDeps.length > 0 && (
                  <>
                    <View style={styles.cmdBtnRow}>
                      <TouchableOpacity
                        style={[
                          styles.cmdBtn,
                          !expoCmd ? styles.btnDisabled : null,
                        ]}
                        onPress={() => setShowExpoCmd((v) => !v)}
                        disabled={!expoCmd}
                      >
                        <Ionicons
                          name="logo-react"
                          size={16}
                          color={theme.palette.background}
                        />
                        <Text style={styles.cmdBtnText}>
                          {showExpoCmd ? "Expo hide" : "Expo install"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.cmdBtn,
                          !npmCmd ? styles.btnDisabled : null,
                        ]}
                        onPress={() => setShowNpmCmd((v) => !v)}
                        disabled={!npmCmd}
                      >
                        <Ionicons
                          name="logo-npm"
                          size={16}
                          color={theme.palette.background}
                        />
                        <Text style={styles.cmdBtnText}>
                          {showNpmCmd ? "npm hide" : "npm install"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.cmdBtnWide,
                        !allCmds ? styles.btnDisabled : null,
                      ]}
                      onPress={() => setShowAllCmds((v) => !v)}
                      disabled={!allCmds}
                    >
                      <Ionicons
                        name="terminal"
                        size={16}
                        color={theme.palette.background}
                      />
                      <Text style={styles.cmdBtnText}>
                        {showAllCmds ? "Alle hide" : "Alle Commands"}
                      </Text>
                    </TouchableOpacity>

                    {showExpoCmd && !!expoCmd && (
                      <View style={styles.cmdBox}>
                        <Text style={styles.cmdTitle}>
                          Expo install (copybar):
                        </Text>
                        <Text selectable style={styles.cmdText}>
                          {expoCmd}
                        </Text>
                      </View>
                    )}

                    {showNpmCmd && !!npmCmd && (
                      <View style={styles.cmdBox}>
                        <Text style={styles.cmdTitle}>
                          npm install (copybar):
                        </Text>
                        <Text selectable style={styles.cmdText}>
                          {npmCmd}
                        </Text>
                      </View>
                    )}

                    {showAllCmds && !!allCmds && (
                      <View style={styles.cmdBox}>
                        <Text style={styles.cmdTitle}>
                          Alle Commands (copybar):
                        </Text>
                        <Text selectable style={styles.cmdText}>
                          {allCmds}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </>
            )}
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

  statusCard: {
    margin: 16,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  statusTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusTitle: { color: theme.palette.text.primary, fontWeight: "800" },
  iconBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: theme.palette.border,
  },

  pill: {
    backgroundColor: theme.palette.background,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pillLabel: {
    color: theme.palette.text.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  pillValue: {
    color: theme.palette.text.primary,
    fontWeight: "700",
    marginTop: 2,
  },

  statusRow: { flexDirection: "row", gap: 10, marginTop: 2 },
  smallBtn: {
    flex: 1,
    backgroundColor: theme.palette.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  smallBtnText: { color: theme.palette.background, fontWeight: "800" },

  statusDetails: { gap: 4, marginTop: 2 },
  statusLine: { color: theme.palette.text.primary, fontWeight: "700" },
  statusSub: { color: theme.palette.text.muted, fontSize: 12 },
  mono: { fontFamily: "monospace" },

  reportRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  reportBtn: {
    flex: 1,
    backgroundColor: theme.palette.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  reportBtnText: { color: theme.palette.background, fontWeight: "900" },
  reportBtnSecondary: {
    width: 110,
    backgroundColor: theme.palette.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  reportBtnSecondaryText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
  },
  btnDisabled: { opacity: 0.6 },

  reportBox: {
    marginTop: 10,
    backgroundColor: theme.palette.background,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  reportEmpty: { color: theme.palette.text.muted, fontWeight: "700" },
  reportTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reportTitle: { color: theme.palette.text.primary, fontWeight: "900" },
  reportPill: {
    backgroundColor: theme.palette.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  reportPillText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 12,
  },
  reportMeta: { color: theme.palette.text.muted, fontSize: 12 },

  missingList: { gap: 4 },
  missingItem: { color: theme.palette.text.primary, fontWeight: "700" },

  cmdBtnRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  cmdBtn: {
    flex: 1,
    backgroundColor: theme.palette.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  cmdBtnWide: {
    marginTop: 10,
    backgroundColor: theme.palette.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  cmdBtnText: { color: theme.palette.background, fontWeight: "900" },

  cmdBox: {
    marginTop: 10,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    padding: 10,
  },
  cmdTitle: {
    color: theme.palette.text.muted,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
  },
  cmdText: {
    color: theme.palette.text.primary,
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
  },

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
