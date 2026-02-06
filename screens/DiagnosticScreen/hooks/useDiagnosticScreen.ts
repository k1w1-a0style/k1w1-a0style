import { v4 as uuidv4 } from "uuid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, UIManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ProjectData } from "../../../contexts/types";
import type { BuildMode } from "../../../components/diagnostics/ModeSelector";
import {
  autoFixCIWorkflows,
  checkRepoSecrets,
  parseOwnerRepo,
} from "../../../lib/diagnostics/ciAutoFix";

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


export function useDiagnosticScreen(opts: {
  projectData: ProjectData | null;
  linkedRepo: string;
  linkedBranch?: string;
  setPreferredBuildProfile?: (mode: BuildMode) => void;
}) {
  const { projectData, linkedRepo, linkedBranch, setPreferredBuildProfile } = opts;

  const projectRef = useRef<ProjectData | null>(projectData);
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

  const [uploadCooldownUntil, setUploadCooldownUntil] = useState(0);
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

  const uploadBusyRef = useRef(false);
  const uploadClientRequestIdRef = useRef<string | null>(null);
  const uploadClientRequestIdExpiresAtRef = useRef<number>(0);

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

  const [ciFixing, setCiFixing] = useState(false);
  const [ciFixLog, setCiFixLog] = useState<string | null>(null);

  const runCiAutofix = useCallback(async () => {
    const parsed = parseOwnerRepo(linkedRepo);
    if (!parsed) {
      Alert.alert(
        "CI/Workflows",
        "Kein gültiges GitHub Repo verknüpft (erwartet: owner/repo).",
      );
      return;
    }
    const branch = ((linkedBranch || "main") as string).trim();

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

  return {

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
    projectRef,
    mountedRef,
    uploadBusyRef,
    uploadCooldownUntil,
    setUploadCooldownUntil,
    setCooldownNow,
    uploadCooldownLeftSec,
    getOrCreateUploadClientRequestId,
    resetUploadClientRequestId,
  };
}
