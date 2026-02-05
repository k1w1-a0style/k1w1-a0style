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

import { SegmentedTabs, TabKey } from "../components/diagnostics/SegmentedTabs";
import { ModeSelector, type BuildMode } from "../components/diagnostics/ModeSelector";
import { IssueCard } from "../components/diagnostics/IssueCard";
import {
  IssueDetailSheet,
  type IssueDetail,
} from "../components/diagnostics/IssueDetailSheet";
import { InlineToast } from "../components/diagnostics/InlineToast";
import { useInlineToast } from "../components/diagnostics/useInlineToast";
import { SectionCard } from "../components/diagnostics/SectionCard";

import { theme } from "../theme";
import { useProject } from "../contexts/ProjectContext";

import {
  autoFixCIWorkflows,
  checkRepoSecrets,
  parseOwnerRepo,
} from "../lib/diagnostics/ciAutoFix";

import {
  createOrUpdateFile,
  deleteRepoFile,
} from "../contexts/githubService";
import type { ProjectFile } from "../contexts/types";

import { validateFileContent, validateFilePath } from "../lib/validators";

import type {
  PreflightCheckResult,
  PreflightPatch,
  PreflightTarget,
} from "../lib/diagnostics/preflightTypes";
import { runPreflightChecksProgressive } from "../lib/diagnostics/preflightRunner";
import { runBuildPipelineDiagnostics } from "../lib/diagnostics/buildPipelineDiagnostics";
import {
  formatDiagnosticUpload,
  uploadDiagnosticToSupabase,
} from "../lib/diagnostics/diagnosticUploader";
import {
  sanitizeDiagnosticUpload,
  safeTruncateText,
} from "../lib/diagnostics/sanitize";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

/**
 * Diagnostics Screen (v8.10)
 * - Cleaner, more "pro" UI
 * - Per-result Fix button
 * - AutoFix with a nice progress modal
 *
 * NOTE: This file is intentionally self-contained (no new deps).
 */

type Status = "pass" | "warn" | "fail";
type FixStepStatus = "pending" | "running" | "done" | "failed" | "skipped";

type BuildVariant = "all" | "development" | "preview" | "production";

const ORDER: Record<Status, number> = { fail: 0, warn: 1, pass: 2 };
const MAX_HISTORY = 10;
const DEVICE_ID_KEY = "k1w1_device_id";
const UPLOAD_COOLDOWN_MS = 30_000;
const UPLOAD_RETRY_DELAY_MS = 3_000;
const UPLOAD_COOLDOWN_KEY = "k1w1_upload_cooldown_until";

// Diagnostics UI prefs
const DIAG_PREF_PROFILE_FOCUS_KEY = "k1w1_diag_profile_focus";
const DIAG_PREF_MODES_KEY = "k1w1_diag_modes";
const DIAG_PREF_MODES_ALL_KEY = "k1w1_diag_modes_all";
const DIAG_PREF_MODES_ADV_KEY = "k1w1_diag_modes_adv";
const DIAG_PREF_INCLUDE_LOCAL_KEY = "k1w1_diag_include_local";
const DIAG_PREF_INCLUDE_PIPELINE_KEY = "k1w1_diag_include_pipeline";
const DIAG_PREF_SYNC_FIXES_KEY = "k1w1_diag_sync_fixes";
const DIAG_PREF_RERUN_AFTER_FIX_KEY = "k1w1_diag_rerun_after_fix";
const DIAG_PREF_AUTOFIX_WARN_KEY = "k1w1_diag_autofix_include_warn";
const DIAG_PREF_AUTOFIX_SCOPE_KEY = "k1w1_diag_autofix_scope";


const MAX_DETAILS = 10;
const AUTOFIX_MAX = 50; // safety: don't apply endless chains
const FIX_MODAL_MAX_LINES = 7;


type FixHistoryEntry = {
  label: string;
  at: number;
  snapshot: ProjectFile[];
  createdPaths: string[];
};

type FixStep = {
  key: string;
  title: string;
  status: FixStepStatus;
  message?: string;
};

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

  const runCiAutofix = useCallback(async () => {
    const parsed = parseOwnerRepo(linkedRepo);
    if (!parsed) {
      Alert.alert(
        "CI/Workflows",
        "Kein gültiges GitHub Repo verknüpft (erwartet: owner/repo).",
      );
      return;
    }
    const branch = (linkedBranch || "main").trim();

    setCiFixing(true);
    setCiFixLog(null);
    try {
      const secrets = await checkRepoSecrets(parsed.owner, parsed.repo);
      const changes = await autoFixCIWorkflows({
        owner: parsed.owner,
        repo: parsed.repo,
        branch,
      });

      const changedCount = changes.filter((c) => c.changed).length;
      const missing = secrets.missing;

      const summaryLines: string[] = [
        `Repo: ${parsed.owner}/${parsed.repo}`,
        `Branch: ${branch}`,
        `Workflow-Files aktualisiert: ${changedCount}/${changes.length}`,
        missing.length
          ? `❗ Fehlende Secrets: ${missing.join(", ")}`
          : `✅ Secrets: OK`,
        "",
        "Details:",
        ...changes.map(
          (c) => `${c.changed ? "🛠️" : "✅"} ${c.path} — ${c.message}`,
        ),
      ];

      const summary = summaryLines.join("\n");
      setCiFixLog(summary);
      Alert.alert(
        "CI/Workflows",
        missing.length
          ? "Workflows gefixt. Es fehlen noch Secrets."
          : "Workflows sind gefixt & Secrets sehen gut aus.",
      );
    } catch (e: any) {
      setCiFixLog(String(e?.message || e));
      Alert.alert(
        "CI/Workflows",
        "Fehler beim Fixen: " + String(e?.message || e),
      );
    } finally {
      setCiFixing(false);
    }
  }, [linkedRepo, linkedBranch]);

  const projectRef = useRef(projectData);
  useEffect(() => {
    projectRef.current = projectData;
  }, [projectData]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "android") {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  // Restore upload cooldown (UX-only) across app restarts.

  // Tick cooldown UI and auto-clear when it expires.

  const [target, setTarget] = useState<PreflightTarget>({ mode: "expoGo" });
  const [results, setResults] = useState<PreflightCheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);

  const [ciFixing, setCiFixing] = useState(false);
  const [ciFixLog, setCiFixLog] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  );

  const [history, setHistory] = useState<FixHistoryEntry[]>([]);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLabel, setPreviewLabel] = useState("");
  const [previewEntries, setPreviewEntries] = useState<
    Array<{ path: string; oldText: string | null; newText: string | null }>
  >([]);

  const [applyBusy, setApplyBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const uploadBusyRef = useRef(false);
  const [uploadCooldownUntil, setUploadCooldownUntil] = useState(0);
  const uploadClientRequestIdRef = useRef<string | null>(null);
  const uploadClientRequestIdExpiresAtRef = useRef<number>(0);

  // Cache client_request_id for a short window so retries are idempotent.
  // After TTL or after a successful upload we generate a fresh one.
  const getOrCreateUploadClientRequestId = useCallback((): string => {
    const now = Date.now();
    const cur = uploadClientRequestIdRef.current;
    const exp = uploadClientRequestIdExpiresAtRef.current;
    if (cur && exp && now < exp) return cur;
    const next = uuidv4();
    uploadClientRequestIdRef.current = next;
    uploadClientRequestIdExpiresAtRef.current = now + 30_000; // 30s window
    return next;
  }, []);

  const resetUploadClientRequestId = useCallback(() => {
    uploadClientRequestIdRef.current = null;
    uploadClientRequestIdExpiresAtRef.current = 0;
  }, []);

  const [cooldownNow, setCooldownNow] = useState(() => Date.now());
  const uploadCooldownLeftSec = useMemo(() => {
    if (!uploadCooldownUntil) return 0;
    const left = uploadCooldownUntil - cooldownNow;
    return left > 0 ? Math.ceil(left / 1000) : 0;
  }, [uploadCooldownUntil, cooldownNow]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(UPLOAD_COOLDOWN_KEY);
        if (!raw) return;
        const until = Number(raw);
        if (!Number.isFinite(until) || until <= 0) {
          await AsyncStorage.removeItem(UPLOAD_COOLDOWN_KEY);
          return;
        }
        const now = Date.now();
        if (until <= now) {
          await AsyncStorage.removeItem(UPLOAD_COOLDOWN_KEY);
          return;
        }
        if (cancelled) return;
        setUploadCooldownUntil(until);
        setCooldownNow(now);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!uploadCooldownUntil) return;
    const tick = () => {
      const now = Date.now();
      if (!mountedRef.current) return;
      setCooldownNow(now);
      if (uploadCooldownUntil <= now) {
        setUploadCooldownUntil(0);
        AsyncStorage.removeItem(UPLOAD_COOLDOWN_KEY).catch(() => {});
      }
    };
    tick();
    if (uploadCooldownUntil <= Date.now()) return;
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [uploadCooldownUntil]);

  const applyBusyRef = useRef(false);

  const [fixModalVisible, setFixModalVisible] = useState(false);
  const [fixModalTitle, setFixModalTitle] = useState("AutoFix");
  const [fixModalSubtitle, setFixModalSubtitle] = useState<string | undefined>(
    undefined,
  );
  const [fixSteps, setFixSteps] = useState<FixStep[]>([]);
  const [fixStepIndex, setFixStepIndex] = useState(0);
  const [fixDone, setFixDone] = useState(false);

  // UI: main tabs
  const [tab, setTab] = useState<TabKey>("overview");

const [advancedOpen, setAdvancedOpen] = useState(false);
const [advancedFixesOpen, setAdvancedFixesOpen] = useState(false);

const toggleAdvanced = useCallback(() => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setAdvancedOpen((v) => !v);
}, []);

const toggleAdvancedFixes = useCallback(() => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setAdvancedFixesOpen((v) => !v);
}, []);


  // UX (new): Recommended by default, Advanced optional multi-select
  const recommendedMode = useMemo<BuildMode>(() => {
    const preferred = String((projectData as any)?.preferredBuildProfile || "development");
    if (preferred === "preview" || preferred === "production" || preferred === "development") {
      return preferred;
    }
    return "development";
  }, [projectData]);

  const [modeAdvanced, setModeAdvanced] = useState(false);
  const [modesAll, setModesAll] = useState(false);
  const [selectedModes, setSelectedModes] = useState<BuildMode[]>([recommendedMode]);

  // Scope toggles (pro UX)
const [includeLocalChecks, setIncludeLocalChecks] = useState(true);
const [includePipelineChecks, setIncludePipelineChecks] = useState(true);

// When a fix touches repo-relevant files we usually want to sync.
const [syncFixesToGitHub, setSyncFixesToGitHub] = useState(() => !!linkedRepo);

// Pro UX: after a fix, auto re-run diagnostics to verify ("grün werden").
const [rerunAfterFix, setRerunAfterFix] = useState(true);

// AutoFix options
const [autoFixIncludeWarn, setAutoFixIncludeWarn] = useState(false);
const [autoFixScope, setAutoFixScope] = useState<"visible" | "all">("visible");

// Persist diagnostics preferences per project
const prefKey = useCallback(
  (base: string) => {
    const pid = projectData?.id ? String(projectData.id) : "";
    return pid ? `${base}:${pid}` : base;
  },
  [projectData?.id],
);

useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const keys = [
        // legacy focus key is still read for migration
        prefKey(DIAG_PREF_PROFILE_FOCUS_KEY),
        prefKey(DIAG_PREF_MODES_KEY),
        prefKey(DIAG_PREF_MODES_ALL_KEY),
        prefKey(DIAG_PREF_MODES_ADV_KEY),
        prefKey(DIAG_PREF_INCLUDE_LOCAL_KEY),
        prefKey(DIAG_PREF_INCLUDE_PIPELINE_KEY),
        prefKey(DIAG_PREF_SYNC_FIXES_KEY),
        prefKey(DIAG_PREF_RERUN_AFTER_FIX_KEY),
        prefKey(DIAG_PREF_AUTOFIX_WARN_KEY),
        prefKey(DIAG_PREF_AUTOFIX_SCOPE_KEY),
      ];
      const pairs = await AsyncStorage.multiGet(keys);
      const map = new Map(pairs);

      const legacyPf = map.get(prefKey(DIAG_PREF_PROFILE_FOCUS_KEY));
      const modesRaw = map.get(prefKey(DIAG_PREF_MODES_KEY));
      const allRaw = map.get(prefKey(DIAG_PREF_MODES_ALL_KEY));
      const advRaw = map.get(prefKey(DIAG_PREF_MODES_ADV_KEY));
      const il = map.get(prefKey(DIAG_PREF_INCLUDE_LOCAL_KEY));
      const ip = map.get(prefKey(DIAG_PREF_INCLUDE_PIPELINE_KEY));
      const sy = map.get(prefKey(DIAG_PREF_SYNC_FIXES_KEY));
      const rr = map.get(prefKey(DIAG_PREF_RERUN_AFTER_FIX_KEY));
      const aw = map.get(prefKey(DIAG_PREF_AUTOFIX_WARN_KEY));
      const as = map.get(prefKey(DIAG_PREF_AUTOFIX_SCOPE_KEY));

      if (cancelled) return;

      // Mode persistence (new)
      if (advRaw === "0" || advRaw === "1") setModeAdvanced(advRaw === "1");
      if (allRaw === "0" || allRaw === "1") setModesAll(allRaw === "1");
      if (modesRaw) {
        const parts = modesRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const filtered = parts.filter(
          (m): m is BuildMode => m === "development" || m === "preview" || m === "production",
        );
        if (filtered.length) setSelectedModes(filtered);
      } else if (
        legacyPf === "all" ||
        legacyPf === "development" ||
        legacyPf === "preview" ||
        legacyPf === "production"
      ) {
        // Migration: old single/all focus -> new modes
        if (legacyPf === "all") {
          setModeAdvanced(true);
          setModesAll(true);
          setSelectedModes(["development", "preview", "production"]);
        } else {
          setSelectedModes([legacyPf]);
        }
      }
      if (il === "0" || il === "1") setIncludeLocalChecks(il === "1");
      if (ip === "0" || ip === "1") setIncludePipelineChecks(ip === "1");
      if (sy === "0" || sy === "1") setSyncFixesToGitHub(sy === "1");
      if (rr === "0" || rr === "1") setRerunAfterFix(rr === "1");
      if (aw === "0" || aw === "1") setAutoFixIncludeWarn(aw === "1");
      if (as === "visible" || as === "all") setAutoFixScope(as);
    } catch {
      // ignore
    }
  })();
  return () => {
    cancelled = true;
  };
}, [prefKey]);

useEffect(() => {
  (async () => {
    try {
      await AsyncStorage.multiSet([
        [prefKey(DIAG_PREF_MODES_KEY), selectedModes.join(",")],
        [prefKey(DIAG_PREF_MODES_ALL_KEY), modesAll ? "1" : "0"],
        [prefKey(DIAG_PREF_MODES_ADV_KEY), modeAdvanced ? "1" : "0"],
        [prefKey(DIAG_PREF_INCLUDE_LOCAL_KEY), includeLocalChecks ? "1" : "0"],
        [prefKey(DIAG_PREF_INCLUDE_PIPELINE_KEY), includePipelineChecks ? "1" : "0"],
        [prefKey(DIAG_PREF_SYNC_FIXES_KEY), syncFixesToGitHub ? "1" : "0"],
        [prefKey(DIAG_PREF_RERUN_AFTER_FIX_KEY), rerunAfterFix ? "1" : "0"],
        [prefKey(DIAG_PREF_AUTOFIX_WARN_KEY), autoFixIncludeWarn ? "1" : "0"],
        [prefKey(DIAG_PREF_AUTOFIX_SCOPE_KEY), autoFixScope],
      ]);
    } catch {
      // ignore
    }
  })();
}, [
  autoFixIncludeWarn,
  autoFixScope,
  includeLocalChecks,
  includePipelineChecks,
  prefKey,
  modeAdvanced,
  modesAll,
  selectedModes,
  rerunAfterFix,
  syncFixesToGitHub,
]);

  // Keep the project's preferred build profile in sync (so Build Screen + Diagnostics agree).
  // Only sync when user is in Recommended mode (single selection).
  useEffect(() => {
    if (typeof setPreferredBuildProfile !== "function") return;
    if (modeAdvanced) return;
    if (modesAll) return;
    const only = selectedModes[0] ?? recommendedMode;
    setPreferredBuildProfile(only);
  }, [modeAdvanced, modesAll, recommendedMode, selectedModes, setPreferredBuildProfile]);


  const counts = useMemo(() => {
    const c = { pass: 0, warn: 0, fail: 0 };
    for (const r of results) {
      const st = (r.status ?? "pass") as Status;
      c[st] += 1;
    }
    return c;
  }, [results]);

  const sortedResults = useMemo(() => {
    const list = [...results];
    list.sort(
      (a, b) =>
        ORDER[(a.status as Status) ?? "pass"] -
        ORDER[(b.status as Status) ?? "pass"],
    );
    return list;
  }, [results]);

  const [issuesFilter, setIssuesFilter] = useState<
    "all" | "critical" | "warning" | "info"
  >("all");

  const toSeverity = useCallback((s: Status): IssueDetail["severity"] => {
    if (s === "fail") return "critical";
    if (s === "warn") return "warning";
    return "info";
  }, []);

  // "Visible" is the Issues tab filter result (used by Smart Fix scope)
  const visibleResults = useMemo(() => {
  const nonPass = sortedResults.filter(
    (r) => ((r.status ?? "pass") as Status) !== "pass",
  );

  if (issuesFilter === "all") return nonPass;
  if (issuesFilter === "critical")
    return nonPass.filter((r) => ((r.status ?? "pass") as Status) === "fail");
  if (issuesFilter === "warning")
    return nonPass.filter((r) => ((r.status ?? "pass") as Status) === "warn");

  // "info" is intentionally minimal in this project: we don't show passing checks as issues.
  return [];
}, [issuesFilter, sortedResults]);


  const fixableResults = useMemo(() => {
    const list = sortedResults.filter((r) => !!r.fix?.patch);
    // deterministic order: fails first, then warns
    list.sort(
      (a, b) =>
        ORDER[(a.status as Status) ?? "pass"] -
        ORDER[(b.status as Status) ?? "pass"],
    );
    return list;
  }, [sortedResults]);

  const closeFixModal = useCallback(() => {
    if (!fixDone) return; // only closable when done
    setFixModalVisible(false);
  }, [fixDone]);

  const pipelineAppliesToFocus = useCallback(
    (id: string): boolean => {
      if (modesAll) return true;

      const enabled = new Set<BuildMode>(
        selectedModes.length ? selectedModes : [recommendedMode],
      );

      // Profile-specific ids in buildPipelineDiagnostics
      const isFor = (p: "development" | "preview" | "production") => {
        if (id.endsWith(`.${p}`)) return true;
        if (id.includes(`.${p}.`)) return true;
        if (id.includes(`easProfile.${p}`)) return true;
        return false;
      };

      // Dev-only diagnostics
      const devOnly =
        id === "repo.easDevelopmentCoherent" ||
        id === "repo.easEnableDevClientFlow" ||
        id === "repo.dep.expoDevClient" ||
        id === "repo.dep.expoDevClient.read";

      if (devOnly) return enabled.has("development");

      if (isFor("development")) return enabled.has("development");
      if (isFor("preview")) return enabled.has("preview");
      if (isFor("production")) return enabled.has("production");

      // Otherwise: global checks (tokens, workflows, secrets, etc.)
      return true;
    },
    [modesAll, recommendedMode, selectedModes],
  );

  const runDiagnostics = useCallback(async (opts?: { resetSelection?: boolean; resetHistory?: boolean }) => {
    if (!projectRef.current) {
      Alert.alert("Kein Projekt", "Bitte zuerst ein Projekt laden.");
      return;
    }
    if (runningRef.current) return;

    runningRef.current = true;
    setRunning(true);
    const resetSelection = opts?.resetSelection !== false;
    const resetHistory = opts?.resetHistory !== false;

    setResults([]);
    if (resetSelection) setSelected({});
    if (resetHistory) setHistory([]);
    setProgressStage("Checks starten…");

    try {
      const files = projectRef.current.files;

      const all: PreflightCheckResult[] = [];

      const focusedProfiles: Array<"development" | "preview" | "production"> =
        modesAll
          ? ["development", "preview", "production"]
          : (selectedModes.length
              ? (selectedModes as Array<"development" | "preview" | "production">)
              : ([recommendedMode] as Array<"development" | "preview" | "production">));

      if (includeLocalChecks) {
        for (const prof of focusedProfiles) {
          const t = { mode: "eas" as const, profile: prof };
          setProgressStage(`Checks: local/${t.profile}`);
          const prog = runPreflightChecksProgressive(files, t);

          for await (const stage of prog as any) {
            if (stage?.priority)
              setProgressStage(
                `Checks: local/${t.profile} • ${String(stage.priority)}`,
              );
            if (stage?.results?.length) {
              const decorated = (stage.results as PreflightCheckResult[]).map(
                (r) => ({
                  ...r,
                  id: `${t.profile}::${r.id}`,
                  title: `${r.title} (${t.profile})`,
                }),
              );
              all.push(...decorated);
              if (mountedRef.current) setResults([...all]);
            }
          }
        }
      }

      // Remote pipeline diagnostics (GitHub/Workflows/EAS linkage checks)
      const parsed = includePipelineChecks ? parseOwnerRepo(linkedRepo) : null;
      if (parsed) {
        try {
          setProgressStage("Checks: pipeline (GitHub/EAS)…");
          const { checks } = await runBuildPipelineDiagnostics({
            owner: parsed.owner,
            repo: parsed.repo,
            branch: (linkedBranch || "main").trim(),
          });

          const pipelineResults: PreflightCheckResult[] = checks
            .filter((c) => pipelineAppliesToFocus(c.id))
            .map((c) => ({
            id: `pipeline::${c.id}`,
            title: c.title,
            severity: c.status === "fail" ? "high" : "normal",
            status:
              c.status === "fail"
                ? "fail"
                : c.status === "warn"
                  ? "warn"
                  : "pass",
            message: c.details || undefined,
            details: c.fixHint ? [c.fixHint] : undefined,
            fix: c.fix ? { label: c.fix.label, patch: c.fix.patch } : undefined,
          }));

          all.push(...pipelineResults);
          if (mountedRef.current) setResults([...all]);
        } catch (e: any) {
          all.push({
            id: "pipeline::error",
            title: "Pipeline Diagnostics",
            severity: "high",
            status: "fail",
            message: e?.message || "Pipeline Diagnostics fehlgeschlagen",
          });
          if (mountedRef.current) setResults([...all]);
        }
      }

      if (mountedRef.current) {
        setResults(all);
        setLastRunAt(Date.now());
        setProgressStage(null);
      }
} catch (e: any) {
      Alert.alert(
        "Diagnostics fehlgeschlagen",
        e?.message || "Unbekannter Fehler",
      );
      if (mountedRef.current) setProgressStage(null);
    } finally {
      runningRef.current = false;
      if (mountedRef.current) setRunning(false);
    }
  }, [
    includeLocalChecks,
    includePipelineChecks,
    linkedRepo,
    linkedBranch,
    pipelineAppliesToFocus,
    modesAll,
    recommendedMode,
    selectedModes,
  ]);

  const run = useCallback(() => runDiagnostics(), [runDiagnostics]);

  const openPreview = useCallback(
    async (label: string, patch: PreflightPatch) => {
      if (!projectRef.current) return;
      const filesMap = new Map(
        projectRef.current.files.map((f) => [f.path, f.content]),
      );
      const entries: Array<{
        path: string;
        oldText: string | null;
        newText: string | null;
      }> = [];

      const upsert = patch.upsert ?? [];
      for (const u of upsert) {
        entries.push({
          path: u.path,
          oldText: filesMap.has(u.path)
            ? (filesMap.get(u.path) as string)
            : null,
          newText: u.content ?? "",
        });
      }
      const del = patch.delete ?? [];
      for (const p of del) {
        entries.push({
          path: p,
          oldText: filesMap.has(p) ? (filesMap.get(p) as string) : null,
          newText: null,
        });
      }
      // jsonMerge is handled inside smartPatch on apply; we preview as "changed" placeholder
      const jm = patch.jsonMerge ?? [];
      for (const j of jm) {
        entries.push({
          path: j.path,
          oldText: filesMap.has(j.path)
            ? (filesMap.get(j.path) as string)
            : null,
          newText:
            "• JSON merge patch (Preview zeigt nur vorher – nachher wird beim Apply erzeugt)",
        });
      }

      setPreviewLabel(label);
      setPreviewEntries(entries);
      setPreviewVisible(true);
    },
    [],
  );

  const applyPatch = useCallback(
    async (
      label: string,
      patch: PreflightPatch,
      opts?: { syncToGitHub?: boolean },
    ) => {
      if (!projectRef.current) throw new Error("Kein Projekt geladen.");
      if (applyBusyRef.current) return;

      applyBusyRef.current = true;
      if (mountedRef.current) setApplyBusy(true);

      const currentFiles = projectRef.current.files;
      try {
        // Validate & normalize touched paths for snapshot
        const touchedPaths = Array.from(
          new Set<string>([
            ...(patch.upsert ?? []).map((u) => u.path),
            ...(patch.delete ?? []).map((p) => p),
            ...(patch.jsonMerge ?? []).map((j) => j.path),
          ]),
        );

        const normalizedTouched = touchedPaths
          .map((p) => {
            const v = validateFilePath(p);
            if (!v.valid || !v.normalized)
              throw new Error(
                `Ungültiger Pfad im Patch: ${p} (${v.errors.join(", ") || "invalid"})`,
              );
            return v.normalized;
          })
          .sort();

        const currentMap = new Map(
          currentFiles.map((f) => [f.path, f] as const),
        );
        const snapshot: ProjectFile[] = [];
        const createdPaths: string[] = [];
        for (const p of normalizedTouched) {
          const prev = currentMap.get(p);
          if (prev) snapshot.push(prev);
          else createdPaths.push(p);
        }

        const nextMap = new Map(
          currentFiles.map((f) => [f.path, f.content] as const),
        );

        // upserts
        for (const u of patch.upsert ?? []) {
          const pv = validateFilePath(u.path);
          if (!pv.valid || !pv.normalized)
            throw new Error(
              `Ungültiger Pfad im Patch: ${u.path} (${pv.errors.join(", ") || "invalid"})`,
            );
          const cv = validateFileContent(u.content ?? "");
          if (!cv.valid)
            throw new Error(
              `Ungültiger File-Content für ${u.path}: ${cv.error ?? "unknown"}`,
            );
          nextMap.set(pv.normalized, u.content ?? "");
        }

        // deletes
        for (const p of patch.delete ?? []) {
          const pv = validateFilePath(p);
          if (!pv.valid || !pv.normalized)
            throw new Error(
              `Ungültiger Pfad im Patch: ${p} (${pv.errors.join(", ") || "invalid"})`,
            );
          nextMap.delete(pv.normalized);
        }

        // jsonMerge
        if (patch.jsonMerge?.length) {
          // Defer to smartPatch helper if available in your project.
          // We keep this robust: only attempt if file exists and content is valid JSON.
          const { applyJsonMergePatchSafe } =
            await import("../lib/diagnostics/smartPatch");
          const merged = await applyJsonMergePatchSafe(
            Array.from(nextMap.entries()).map(([path, content]) => ({
              path,
              content,
            })),
            patch.jsonMerge,
          );
          nextMap.clear();
          for (const f of merged) nextMap.set(f.path, f.content);
        }

        const nextFiles: ProjectFile[] = Array.from(nextMap.entries()).map(
          ([path, content]) => ({ path, content }),
        );

        // Apply deletions through context if deleteFile exists (keeps storage consistent),
        // otherwise rely on updateProjectFiles result.
        try {
          // If deleteFile is supported, call it for the deletes.
          for (const p of patch.delete ?? []) {
            const pv = validateFilePath(p);
            if (pv.valid && pv.normalized) await deleteFile(pv.normalized);
          }
        } catch {
          // ignore – updateProjectFiles will still update in-memory state
        }

        await updateProjectFiles(nextFiles);

        // Make fixes immediately visible for a re-scan in the same render tick.
        // React state/context updates can be async; this prevents 'fixed but still warns' on immediate re-run.
        try {
          projectRef.current = { ...projectRef.current, files: nextFiles };
        } catch {}

        // Optional: sync touched files to linked GitHub repo/branch.
        // This is critical for Pipeline Diagnostics (they read from the repo, not local state).
        const doSync = !!opts?.syncToGitHub;
        if (doSync) {
          const parsed = parseOwnerRepo(linkedRepo);
          if (!parsed) throw new Error("Kein verknüpftes Repo gefunden (owner/repo).");
          const branch = (linkedBranch || "main").trim() || "main";

          // Upserts/merges -> push current content; deletes -> delete from repo (if exists).
          const touchedSet = new Set(normalizedTouched);
          const deletedSet = new Set(
            (patch.delete ?? []).map((p) => {
              const v = validateFilePath(p);
              return v.valid && v.normalized ? v.normalized : p;
            }),
          );

          const nextMapForPush = new Map(nextFiles.map((f) => [f.path, f.content] as const));

          // Push changed/created files
          const pushPaths = Array.from(touchedSet).filter((p) => !deletedSet.has(p));
          for (const p of pushPaths) {
            const content = nextMapForPush.get(p);
            if (typeof content !== "string") continue;
            await createOrUpdateFile(
              parsed.owner,
              parsed.repo,
              p,
              content,
              `Diagnostics: ${label}`,
              branch,
            );
          }

          // Delete removed files (best-effort)
          for (const p of Array.from(deletedSet)) {
            await deleteRepoFile(parsed.owner, parsed.repo, p, `Diagnostics: ${label}`, branch);
          }
        }

        // Track history (undo only needs touched + created)
        setHistory((prev) => {
          const entry: FixHistoryEntry = {
            label,
            at: Date.now(),
            snapshot,
            createdPaths,
          };
          return [entry, ...prev].slice(0, MAX_HISTORY);
        });
      } finally {
        applyBusyRef.current = false;
        if (mountedRef.current) setApplyBusy(false);
      }
    },
    [deleteFile, linkedBranch, linkedRepo, updateProjectFiles],
  );

  const undoLast = useCallback(async () => {
    const last = history[0];
    if (!last) return;

    if (applyBusyRef.current) return;
    applyBusyRef.current = true;
    if (mountedRef.current) setApplyBusy(true);

    try {
      // delete created files first
      for (const p of last.createdPaths ?? []) {
        await deleteFile(p);
      }
      // restore touched snapshot
      if (last.snapshot.length) {
        await updateProjectFiles(last.snapshot);
      }
      setHistory((prev) => prev.slice(1));
    } catch (e: any) {
      Alert.alert("Undo fehlgeschlagen", e?.message || "Unbekannter Fehler");
    } finally {
      applyBusyRef.current = false;
      if (mountedRef.current) setApplyBusy(false);
    }
  }, [deleteFile, history, updateProjectFiles]);

  const undoAll = useCallback(async () => {
    if (!history.length) return;

    Alert.alert(
      "Alle Fixes rückgängig machen?",
      `${history.length} Fix(es) werden zurückgesetzt.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Undo All",
          style: "destructive",
          onPress: async () => {
            // Undo newest → oldest (history is newest-first)
            let undone = 0;
            for (const entry of history) {
              try {
                for (const p of entry.createdPaths ?? []) {
                  await deleteFile(p);
                }
                if (entry.snapshot.length) {
                  await updateProjectFiles(entry.snapshot);
                }
                undone++;
              } catch (e: any) {
                Alert.alert(
                  "Undo All fehlgeschlagen",
                  `Abgebrochen nach ${undone} Fix(es): ${e?.message || "Unbekannter Fehler"}`,
                );
                break;
              }
            }
            if (mountedRef.current && undone > 0) {
              setHistory((prev) => prev.slice(undone));
              Alert.alert("✓ Undo", `${undone} Fix(es) rückgängig gemacht.`);
            }
          },
        },
      ],
    );
  }, [history, deleteFile, updateProjectFiles]);

  const toggleSelected = useCallback((key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const clearSelection = useCallback(() => setSelected({}), []);

  const openSigningWizard = useCallback(() => {
    navigation.navigate("CredentialsWizard");
  }, [navigation]);

  const selectFails = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const r of sortedResults) {
      const st = (r.status ?? "pass") as Status;
      if (st === "fail" && r.fix?.patch) next[r.id] = true;
    }
    setSelected(next);
  }, [sortedResults]);

const patchTouchedPaths = useCallback((patch: PreflightPatch): string[] => {
  const raw = [
    ...(patch.upsert ?? []).map((u) => u.path),
    ...(patch.delete ?? []).map((p) => p),
    ...(patch.jsonMerge ?? []).map((j) => j.path),
  ];
  const out: string[] = [];
  for (const p of raw) {
    const v = validateFilePath(p);
    if (v.valid && v.normalized) out.push(v.normalized);
  }
  // unique
  return Array.from(new Set(out)).sort();
}, []);

const shouldSyncPatch = useCallback(
  (patch: PreflightPatch): boolean => {
    if (!syncFixesToGitHub) return false;
    if (!parseOwnerRepo(linkedRepo)) return false;

    const touched = patchTouchedPaths(patch);
    return touched.some((p) => {
      if (p === "eas.json") return true;
      if (p === "eas-project.json") return true;
      if (p === "package.json") return true;
      if (p === "app.json" || p === "app.config.js" || p === "app.config.ts") return true;
      if (p.startsWith(".github/workflows/")) return true;
      return false;
    });
  },
  [linkedRepo, patchTouchedPaths, syncFixesToGitHub],
);

const syncPatchToGitHub = useCallback(
  async (label: string, patch: PreflightPatch) => {
    const parsed = parseOwnerRepo(linkedRepo);
    if (!parsed) throw new Error("Kein verknüpftes Repo gefunden (owner/repo).");

    const branch = (linkedBranch || "main").trim() || "main";
    const touched = patchTouchedPaths(patch);

    const deletedSet = new Set(
      (patch.delete ?? [])
        .map((p) => {
          const v = validateFilePath(p);
          return v.valid && v.normalized ? v.normalized : null;
        })
        .filter(Boolean) as string[],
    );

    const filesNow = projectRef.current?.files ?? [];
    const nowMap = new Map(filesNow.map((f) => [f.path, f.content] as const));

    // Push touched files that are not deleted
    for (const p of touched) {
      if (deletedSet.has(p)) continue;
      const content = nowMap.get(p);
      if (typeof content !== "string") continue;
      await createOrUpdateFile(
        parsed.owner,
        parsed.repo,
        p,
        content,
        `Diagnostics: ${label}`,
        branch,
      );
    }

    // Delete removed files (best-effort)
    for (const p of Array.from(deletedSet)) {
      await deleteRepoFile(
        parsed.owner,
        parsed.repo,
        p,
        `Diagnostics: ${label}`,
        branch,
      );
    }
  },
  [linkedRepo, linkedBranch, patchTouchedPaths],
);
  const applySelected = useCallback(async () => {
  if (!projectRef.current) return;
  if (applyBusyRef.current) return;

  const chosenAll = sortedResults.filter((r) => selected[r.id] && r.fix?.patch);
  if (!chosenAll.length) {
    Alert.alert("Nichts ausgewählt", "Bitte wähle Fixes aus.");
    return;
  }

  // Heads-up: we cap how many fixes can be applied in one go.
  // Without this warning it can look like "alles grün", even though we only applied a subset.
  if (chosenAll.length > AUTOFIX_MAX) {
    const proceed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Zu viele Fixes",
        `Es sind ${chosenAll.length} Fixes ausgewählt, aber maximal ${AUTOFIX_MAX} können auf einmal angewendet werden.\n\nTipp: Nutze Filter (z.B. fail-only), oder führe AutoFix mehrfach aus.`,
        [
          {
            text: "Abbrechen",
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: `Weiter (${AUTOFIX_MAX}/${chosenAll.length})`,
            style: "default",
            onPress: () => resolve(true),
          },
        ]
      );
    });
    if (!proceed) return;
  }

  const chosen = chosenAll.slice(0, AUTOFIX_MAX);
  const baseSteps: FixStep[] = chosen.map((r) => ({
    key: r.id,
    title: r.title,
    status: "pending" as FixStepStatus,
  }));

  const steps: FixStep[] = rerunAfterFix
    ? [
        ...baseSteps,
        {
          key: "__rerun__",
          title: "Re-Run Diagnostics (Verify)",
          status: "pending" as FixStepStatus,
        },
      ]
    : baseSteps;

  setFixModalTitle("Fix Selected");
  setFixModalSubtitle(
    `${chosen.length} Fix(es) werden angewendet${rerunAfterFix ? " + Verify-Run" : ""}…`,
  );
  setFixSteps(steps);
  setFixStepIndex(0);
  setFixDone(false);
  setFixModalVisible(true);

  let aborted = false;

  for (let i = 0; i < baseSteps.length; i++) {
    if (!mountedRef.current) break;
    setFixStepIndex(i);
    setFixSteps((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, status: "running" } : s)),
    );

    try {
      const r = chosen[i];
      await applyPatch(r.title, r.fix!.patch, { syncToGitHub: false });

      const doSync = shouldSyncPatch(r.fix!.patch);
      if (doSync) {
        await syncPatchToGitHub(r.title, r.fix!.patch);
        setFixSteps((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: "done", message: "applied + synced" } : s,
          ),
        );
      } else {
        setFixSteps((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: "done", message: "applied" } : s,
          ),
        );
      }
    } catch (e: any) {
      setFixSteps((prev) =>
        prev.map((s, idx) =>
          idx === i
            ? {
                ...s,
                status: "failed",
                message: safeTruncateText(e?.message || "Fehler", 160),
              }
            : s,
        ),
      );
      aborted = true;
      // Stop on first error to avoid cascading inconsistencies between fixes.
      break;
    }
  }

  // Optional verify run as final step
  if (rerunAfterFix && !aborted && mountedRef.current) {
    const idx = baseSteps.length;
    setFixStepIndex(idx);
    setFixSteps((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, status: "running" } : s)),
    );
    try {
      await runDiagnostics({ resetSelection: false, resetHistory: false });
      setFixSteps((prev) =>
        prev.map((s, i) => (i === idx ? { ...s, status: "done" } : s)),
      );
    } catch (e: any) {
      setFixSteps((prev) =>
        prev.map((s, i) =>
          i === idx
            ? {
                ...s,
                status: "failed",
                message: safeTruncateText(e?.message || "Verify fehlgeschlagen", 160),
              }
            : s,
        ),
      );
    }
  }

  setFixDone(true);
  setFixStepIndex(steps.length);
  setFixModalSubtitle(aborted ? "Abgebrochen – bitte prüfen." : "Fertig – bitte kurz prüfen.");
}, [
  applyPatch,
  rerunAfterFix,
  runDiagnostics,
  selected,
  shouldSyncPatch,
  sortedResults,
  syncPatchToGitHub,
]);


    const autoFix = useCallback(async () => {
    if (!projectRef.current) return;
    if (applyBusyRef.current) return;

    const baseList = (autoFixScope === "visible" ? visibleResults : fixableResults).filter(
      (r) => !!r.fix?.patch,
    );

    const chosen = baseList.filter((r) => {
      const st = (r.status as Status) ?? "pass";
      if (st === "fail") return true;
      if (autoFixIncludeWarn && st === "warn") return true;
      return false;
    });

    if (!chosen.length) {
      Alert.alert(
        "Nichts zu fixen",
        autoFixIncludeWarn ? "Keine fail/warn Fixes gefunden." : "Keine fail Fixes gefunden.",
      );
      return;
    }

    const slice = chosen.slice(0, AUTOFIX_MAX);

    Alert.alert(
      "AutoFix starten?",
      `Es werden ${slice.length} Fix(es) automatisch angewendet.
Scope: ${autoFixScope}
Includes warnings: ${autoFixIncludeWarn ? "ja" : "nein"}

Tipp: Mit „Re-Run“ nach dem Fix wird automatisch gegengecheckt.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "AutoFix",
          onPress: async () => {
            const baseSteps: FixStep[] = slice.map((r) => ({
              key: r.id,
              title: r.title,
              status: "pending",
            }));

            const steps: FixStep[] = rerunAfterFix
              ? [
                  ...baseSteps,
                  {
                    key: "__rerun__",
                    title: "Re-Run Diagnostics (Verify)",
                    status: "pending",
                  },
                ]
              : baseSteps;

            setFixModalTitle("AutoFix");
            setFixModalSubtitle("Fixes werden automatisch angewendet…");
            setFixSteps(steps);
            setFixStepIndex(0);
            setFixDone(false);
            setFixModalVisible(true);

            let aborted = false;

            for (let i = 0; i < baseSteps.length; i++) {
              if (!mountedRef.current) break;
              setFixStepIndex(i);
              setFixSteps((prev) =>
                prev.map((s, idx) =>
                  idx === i ? { ...s, status: "running" } : s,
                ),
              );

              try {
                const r = slice[i];
                await applyPatch(r.title, r.fix!.patch, { syncToGitHub: false });

                const doSync = shouldSyncPatch(r.fix!.patch);
                if (doSync) {
                  await syncPatchToGitHub(r.title, r.fix!.patch);
                  setFixSteps((prev) =>
                    prev.map((s, idx) =>
                      idx === i ? { ...s, status: "done", message: "applied + synced" } : s,
                    ),
                  );
                } else {
                  setFixSteps((prev) =>
                    prev.map((s, idx) =>
                      idx === i ? { ...s, status: "done", message: "applied" } : s,
                    ),
                  );
                }
              } catch (e: any) {
                setFixSteps((prev) =>
                  prev.map((s, idx) =>
                    idx === i
                      ? {
                          ...s,
                          status: "failed",
                          message: safeTruncateText(
                            e?.message || "Fehler",
                            160,
                          ),
                        }
                      : s,
                  ),
                );
                aborted = true;
                break;
              }
            }

            if (rerunAfterFix && !aborted && mountedRef.current) {
              const idx = baseSteps.length;
              setFixStepIndex(idx);
              setFixSteps((prev) =>
                prev.map((s, i) => (i === idx ? { ...s, status: "running" } : s)),
              );
              try {
                await runDiagnostics({ resetSelection: false, resetHistory: false });
                setFixSteps((prev) =>
                  prev.map((s, i) => (i === idx ? { ...s, status: "done" } : s)),
                );
              } catch (e: any) {
                setFixSteps((prev) =>
                  prev.map((s, i) =>
                    i === idx
                      ? {
                          ...s,
                          status: "failed",
                          message: safeTruncateText(e?.message || "Verify fehlgeschlagen", 160),
                        }
                      : s,
                  ),
                );
              }
            }

            setFixDone(true);
            setFixStepIndex(steps.length);
            setFixModalSubtitle(aborted ? "Abgebrochen – bitte prüfen." : "Fertig – einmal kurz nachschauen.");
          },
        },
      ],
    );
  }, [
    applyPatch,
    autoFixIncludeWarn,
    autoFixScope,
    fixableResults,
    rerunAfterFix,
    runDiagnostics,
    shouldSyncPatch,
    syncPatchToGitHub,
    visibleResults,
  ]);


    const applySingle = useCallback(
    (r: PreflightCheckResult) => {
      if (!r.fix?.patch) return;

      const canSyncRepo = !!parseOwnerRepo(linkedRepo);
      const syncWouldHelp = shouldSyncPatch(r.fix.patch);

      const runOne = async (doSync: boolean) => {
        const steps: FixStep[] = [
          { key: "apply", title: "Apply patch (local)", status: "pending" },
          ...(doSync
            ? [{ key: "sync", title: "Sync to GitHub", status: "pending" as FixStepStatus }]
            : []),
          ...(rerunAfterFix
            ? [{ key: "rerun", title: "Re-Run Diagnostics (Verify)", status: "pending" as FixStepStatus }]
            : []),
        ];

        setFixModalTitle("Fix");
        setFixModalSubtitle(r.title);
        setFixSteps(steps);
        setFixStepIndex(0);
        setFixDone(false);
        setFixModalVisible(true);

        // Apply
        setFixSteps((prev) =>
          prev.map((s, i) => (i === 0 ? { ...s, status: "running" } : s)),
        );
        try {
          await applyPatch(r.title, r.fix!.patch, { syncToGitHub: false });
          setFixSteps((prev) =>
            prev.map((s, i) => (i === 0 ? { ...s, status: "done" } : s)),
          );
        } catch (e: any) {
          setFixSteps((prev) =>
            prev.map((s, i) =>
              i === 0
                ? { ...s, status: "failed", message: safeTruncateText(e?.message || "Fehler", 160) }
                : s,
            ),
          );
          setFixDone(true);
          return;
        }

        let stepCursor = 1;

        // Sync
        if (doSync) {
          setFixStepIndex(stepCursor);
          setFixSteps((prev) =>
            prev.map((s, i) => (i === stepCursor ? { ...s, status: "running" } : s)),
          );
          try {
            await syncPatchToGitHub(r.title, r.fix!.patch);
            setFixSteps((prev) =>
              prev.map((s, i) => (i === stepCursor ? { ...s, status: "done" } : s)),
            );
          } catch (e: any) {
            setFixSteps((prev) =>
              prev.map((s, i) =>
                i === stepCursor
                  ? { ...s, status: "failed", message: safeTruncateText(e?.message || "Sync fehlgeschlagen", 160) }
                  : s,
              ),
            );
            setFixDone(true);
            return;
          }
          stepCursor++;
        }

        // Verify
        if (rerunAfterFix) {
          setFixStepIndex(stepCursor);
          setFixSteps((prev) =>
            prev.map((s, i) => (i === stepCursor ? { ...s, status: "running" } : s)),
          );
          try {
            await runDiagnostics({ resetSelection: false, resetHistory: false });
            setFixSteps((prev) =>
              prev.map((s, i) => (i === stepCursor ? { ...s, status: "done" } : s)),
            );
          } catch (e: any) {
            setFixSteps((prev) =>
              prev.map((s, i) =>
                i === stepCursor
                  ? { ...s, status: "failed", message: safeTruncateText(e?.message || "Verify fehlgeschlagen", 160) }
                  : s,
              ),
            );
          }
        }

        setFixDone(true);
        setFixStepIndex(steps.length);
        setFixModalSubtitle("Fertig – bitte kurz prüfen.");
      };

      Alert.alert(
        "Fix anwenden?",
        `${r.title}

${safeTruncateText(r.message ?? "", 240)}${syncWouldHelp ? "\n\nHinweis: Dieser Fix betrifft Repo-Dateien → Sync macht Sinn." : ""}`,
        [
          { text: "Abbrechen", style: "cancel" },
          { text: "Preview", onPress: () => openPreview(r.title, r.fix!.patch) },
          {
            text: "Fix",
            onPress: () => runOne(false),
          },
          ...(canSyncRepo
            ? [
                {
                  text: "Fix + Sync",
                  onPress: () => runOne(true),
                },
              ]
            : []),
        ],
      );
    },
    [
      applyPatch,
      linkedRepo,
      openPreview,
      rerunAfterFix,
      runDiagnostics,
      shouldSyncPatch,
      syncPatchToGitHub,
    ],
  );


  const getOrCreateDeviceId = useCallback(async (): Promise<string> => {
    try {
      const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      if (existing) return existing;
    } catch {
      // ignore
    }
    let rand = "";
    try {
      const bytes = await Crypto.getRandomBytesAsync(16);
      rand = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      rand = Math.random().toString(16).slice(2);
    }
    const id = `dev_${rand}`;
    try {
      await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
    } catch {
      // ignore
    }
    return id;
  }, []);

  const upload = useCallback(async () => {
    const project = projectRef.current;
    if (!project) return;
    if (uploadBusyRef.current) return;

    if (uploadCooldownLeftSec > 0) {
      Alert.alert("■ Cooldown", `Bitte warte noch ${uploadCooldownLeftSec}s.`);
      return;
    }
    if (!results.length) {
      Alert.alert("Kein Report", "Erst „Run“ ausführen, dann Upload.");
      return;
    }

    uploadBusyRef.current = true;
    if (mountedRef.current) setUploadBusy(true);
    try {
      const deviceId = await getOrCreateDeviceId();
      const payload = sanitizeDiagnosticUpload(
        formatDiagnosticUpload({
          clientRequestId: getOrCreateUploadClientRequestId(),
          deviceId,
          projectName: project.name,
          target,
          results,
          files: project.files,
        }),
      );

      const id = await uploadDiagnosticToSupabase(payload);
      if (!id) throw new Error("Upload fehlgeschlagen");

      if (mountedRef.current) {
        const until = Date.now() + UPLOAD_COOLDOWN_MS;
        setUploadCooldownUntil(until);
        setCooldownNow(Date.now());
        AsyncStorage.setItem(UPLOAD_COOLDOWN_KEY, String(until)).catch(
          () => {},
        );
      }

      Alert.alert("■ Upload OK", `ID: ${id.id}`);
    } catch (e: any) {
      if (mountedRef.current) {
        const until = Date.now() + UPLOAD_RETRY_DELAY_MS;
        setUploadCooldownUntil(until);
        setCooldownNow(Date.now());
        AsyncStorage.setItem(UPLOAD_COOLDOWN_KEY, String(until)).catch(
          () => {},
        );
      }
      Alert.alert("Upload fehlgeschlagen", e?.message || "Unbekannter Fehler");
    } finally {
      uploadBusyRef.current = false;
      if (mountedRef.current) setUploadBusy(false);
    }
  }, [getOrCreateDeviceId, results, target, uploadCooldownLeftSec]);

  const copyReport = useCallback(async () => {
    const project = projectRef.current;
    if (!project) return;
    if (!results.length) {
      Alert.alert("Kein Report", "Erst „Run“ ausführen, dann kopieren.");
      return;
    }
    try {
      const deviceId = await getOrCreateDeviceId();
      const payload = sanitizeDiagnosticUpload(
        formatDiagnosticUpload({
          clientRequestId: getOrCreateUploadClientRequestId(),
          deviceId,
          projectName: project.name,
          target,
          results,
          files: project.files,
        }),
      );
      const json = JSON.stringify(payload, null, 2);
      await Clipboard.setStringAsync(safeTruncateText(json, 80_000));
      Alert.alert("✓ Kopiert", "Report wurde in die Zwischenablage kopiert.");
    } catch (e: any) {
      Alert.alert(
        "Kopieren fehlgeschlagen",
        e?.message || "Unbekannter Fehler",
      );
    }
  }, [getOrCreateDeviceId, results, target]);

  const headerStats = useMemo(() => {
    const name = projectRef.current?.name ?? "–";
    const mode =
      target.mode === "expoGo" ? "Expo Go" : `EAS: ${target.profile ?? "?"}`;
    return { name, mode };
  }, [linkedRepo, linkedBranch]);


  const toast = useInlineToast();
  const [reportVisible, setReportVisible] = useState(false);

  const [issueSheetVisible, setIssueSheetVisible] = useState(false);
  const [activeIssue, setActiveIssue] = useState<PreflightCheckResult | null>(null);

  const openIssue = useCallback((r: PreflightCheckResult) => {
    setActiveIssue(r);
    setIssueSheetVisible(true);
  }, []);

  const closeIssue = useCallback(() => setIssueSheetVisible(false), []);

  const activeIssueDetail = useMemo<IssueDetail | null>(() => {
    if (!activeIssue) return null;
    const st = ((activeIssue.status ?? "pass") as Status) ?? "pass";
    return {
      title: activeIssue.title,
      message: activeIssue.message,
      details: activeIssue.details,
      severity: toSeverity(st),
      hasFix: !!activeIssue.fix?.patch,
    };
  }, [activeIssue, toSeverity]);

  const applyIssueFix = useCallback(
    async (r: PreflightCheckResult) => {
      if (!r.fix?.patch) return;

      const doSync = shouldSyncPatch(r.fix.patch);

      const steps: FixStep[] = [
        { key: "apply", title: "Apply patch (local)", status: "pending" },
        ...(doSync
          ? [{ key: "sync", title: "Sync to GitHub", status: "pending" as FixStepStatus }]
          : []),
        ...(rerunAfterFix
          ? [{ key: "rerun", title: "Re-Run Diagnostics (Verify)", status: "pending" as FixStepStatus }]
          : []),
      ];

      setFixModalTitle("Fix");
      setFixModalSubtitle(r.title);
      setFixSteps(steps);
      setFixStepIndex(0);
      setFixDone(false);
      setFixModalVisible(true);

      // Apply
      setFixSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "running" } : s)));
      try {
        await applyPatch(r.title, r.fix.patch, { syncToGitHub: false });
        setFixSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "done" } : s)));
      } catch (e: any) {
        setFixSteps((prev) =>
          prev.map((s, i) =>
            i === 0
              ? { ...s, status: "failed", message: safeTruncateText(e?.message || "Fehler", 160) }
              : s,
          ),
        );
        setFixDone(true);
        return;
      }

      let cursor = 1;

      if (doSync) {
        setFixStepIndex(cursor);
        setFixSteps((prev) => prev.map((s, i) => (i === cursor ? { ...s, status: "running" } : s)));
        try {
          await syncPatchToGitHub(r.title, r.fix.patch);
          setFixSteps((prev) => prev.map((s, i) => (i === cursor ? { ...s, status: "done" } : s)));
        } catch (e: any) {
          setFixSteps((prev) =>
            prev.map((s, i) =>
              i === cursor
                ? { ...s, status: "failed", message: safeTruncateText(e?.message || "Sync fehlgeschlagen", 160) }
                : s,
            ),
          );
          setFixDone(true);
          return;
        }
        cursor++;
      }

      if (rerunAfterFix) {
        setFixStepIndex(cursor);
        setFixSteps((prev) => prev.map((s, i) => (i === cursor ? { ...s, status: "running" } : s)));
        try {
          await runDiagnostics({ resetSelection: false, resetHistory: false });
          setFixSteps((prev) => prev.map((s, i) => (i === cursor ? { ...s, status: "done" } : s)));
        } catch (e: any) {
          setFixSteps((prev) =>
            prev.map((s, i) =>
              i === cursor
                ? { ...s, status: "failed", message: safeTruncateText(e?.message || "Verify fehlgeschlagen", 160) }
                : s,
            ),
          );
        }
      }

      setFixDone(true);
      setFixStepIndex(steps.length);
      toast.show("Fix applied");
    },
    [applyPatch, rerunAfterFix, runDiagnostics, shouldSyncPatch, syncPatchToGitHub, toast],
  );

  const applyFixList = useCallback(
  async (items: PreflightCheckResult[], label: string) => {
    if (!projectRef.current) return;
    if (!items.length) return;

    const steps: FixStep[] = [];
    for (const r of items) {
      if (!r.fix?.patch) continue;
      steps.push({
        key: `apply:${r.id}`,
        title: `Apply: ${r.title}`,
        status: "pending",
      });
      if (shouldSyncPatch(r.fix.patch)) {
        steps.push({
          key: `sync:${r.id}`,
          title: `Sync: ${r.title}`,
          status: "pending",
        });
      }
    }
    if (rerunAfterFix) {
      steps.push({
        key: "rerun",
        title: "Re-Run Diagnostics (Verify)",
        status: "pending",
      });
    }

    setFixModalTitle(label);
    setFixModalSubtitle(`${items.length} Fixes`);
    setFixSteps(steps);
    setFixStepIndex(0);
    setFixDone(false);
    setFixModalVisible(true);

    let cursor = 0;

    const mark = (idx: number, patch: Partial<FixStep>) => {
      setFixSteps((prev) =>
        prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
      );
    };

    for (const r of items) {
      if (!r.fix?.patch) continue;

      mark(cursor, { status: "running" });
      try {
        await applyPatch(r.title, r.fix.patch, { syncToGitHub: false });
        mark(cursor, { status: "done" });
      } catch (e: any) {
        mark(cursor, {
          status: "failed",
          message: safeTruncateText(e?.message || "Apply fehlgeschlagen", 160),
        });
        setFixDone(true);
        return;
      }
      cursor++;

      if (shouldSyncPatch(r.fix.patch)) {
        setFixStepIndex(cursor);
        mark(cursor, { status: "running" });
        try {
          await syncPatchToGitHub(r.title, r.fix.patch);
          mark(cursor, { status: "done" });
        } catch (e: any) {
          mark(cursor, {
            status: "failed",
            message: safeTruncateText(e?.message || "Sync fehlgeschlagen", 160),
          });
          setFixDone(true);
          return;
        }
        cursor++;
      }
    }

    if (rerunAfterFix) {
      setFixStepIndex(cursor);
      mark(cursor, { status: "running" });
      try {
        await runDiagnostics({ resetSelection: false, resetHistory: false });
        mark(cursor, { status: "done" });
      } catch (e: any) {
        mark(cursor, {
          status: "failed",
          message: safeTruncateText(e?.message || "Verify fehlgeschlagen", 160),
        });
        setFixDone(true);
        return;
      }
    }

    setFixStepIndex(steps.length);
    setFixDone(true);
    toast.show("Fix applied");
  },
  [applyPatch, rerunAfterFix, runDiagnostics, shouldSyncPatch, syncPatchToGitHub, toast],
);

const smartFix = useCallback(async () => {
  if (!projectRef.current) return;
  if (applyBusyRef.current) return;

  const recommended = fixableResults.filter(
    (r) => ((r.status ?? "pass") as Status) === "fail" && !!r.fix?.patch,
  );

  if (!recommended.length) {
    Alert.alert("Nichts zu fixen", "Keine empfohlenen Fixes (Critical) gefunden.");
    return;
  }

  const total = recommended.length;
  const slice = recommended.slice(0, AUTOFIX_MAX);

  if (total > AUTOFIX_MAX) {
    const proceed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Smart Fix Limit",
        `Es werden nur ${AUTOFIX_MAX}/${total} empfohlenen Fixes angewendet. Filtere oder führe erneut aus, um weitere anzuwenden.`,
        [
          { text: "Abbrechen", style: "cancel", onPress: () => resolve(false) },
          { text: `Apply ${AUTOFIX_MAX}`, onPress: () => resolve(true) },
        ],
      );
    });
    if (!proceed) return;
  }

  await applyFixList(slice, "Smart Fix");
}, [applyFixList, fixableResults]);


  const tabDefs = useMemo(
    () => [
      { key: "overview" as const, label: "Overview" },
      { key: "issues" as const, label: "Issues", badge: counts.fail + counts.warn },
      { key: "fixes" as const, label: "Fixes", badge: fixableResults.length },
    ],
    [counts.fail, counts.warn, fixableResults.length],
  );

  const issueList = useMemo(() => visibleResults, [visibleResults]);

  const busy = running || applyBusy;

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