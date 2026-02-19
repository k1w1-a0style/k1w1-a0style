import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { BuildMode } from "../../../components/diagnostics/ModeSelector";

// Diagnostics UI prefs
import type { ProjectData } from "../../../shared/types/project";
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

export function useDiagnosticPreferences(opts: {
  projectData: ProjectData | null;
  linkedRepo: string;
  recommendedMode: BuildMode;
  setPreferredBuildProfile?: (mode: BuildMode) => void;
}) {
  const { projectData, linkedRepo, recommendedMode, setPreferredBuildProfile } = opts;

  // UX (new): Recommended by default, Advanced optional multi-select
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

  const prefSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hydrated, setHydrated] = useState(false);

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

        // Mode persistence (single source of truth):
        // - If user enabled Advanced/All, restore the stored multi-mode selection.
        // - Otherwise ALWAYS follow the project's preferred build profile (recommendedMode).
        const advStored = advRaw === "1";
        const allStored = allRaw === "1";

        if (advRaw === "0" || advRaw === "1") setModeAdvanced(advStored);
        if (allRaw === "0" || allRaw === "1") setModesAll(allStored);

        if (advStored || allStored) {
          if (modesRaw) {
            const parts = modesRaw
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            const filtered = parts.filter(
              (m): m is BuildMode =>
                m === "development" || m === "preview" || m === "production",
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
          } else {
            setSelectedModes([recommendedMode]);
          }
        } else {
          // Recommended mode always follows global preferredBuildProfile
          setSelectedModes([recommendedMode]);
        }


        if (il === "0" || il === "1") setIncludeLocalChecks(il === "1");
        if (ip === "0" || ip === "1") setIncludePipelineChecks(ip === "1");
        if (sy === "0" || sy === "1") setSyncFixesToGitHub(sy === "1");
        if (rr === "0" || rr === "1") setRerunAfterFix(rr === "1");
        if (aw === "0" || aw === "1") setAutoFixIncludeWarn(aw === "1");
        if (as === "visible" || as === "all") setAutoFixScope(as);
        setHydrated(true);
      } catch (e) {
        console.warn("[DiagnosticPrefs] Failed to load preferences:", e);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefKey]);

  useEffect(() => {
    // Debounce preference writes to avoid AsyncStorage spam on rapid toggles.
    if (!hydrated) return;
    if (prefSaveTimer.current) clearTimeout(prefSaveTimer.current);

    prefSaveTimer.current = setTimeout(() => {
      (async () => {
        try {
          await AsyncStorage.multiSet([
            [prefKey(DIAG_PREF_MODES_KEY), selectedModes.join(",")],
            [prefKey(DIAG_PREF_MODES_ALL_KEY), modesAll ? "1" : "0"],
            [prefKey(DIAG_PREF_MODES_ADV_KEY), modeAdvanced ? "1" : "0"],
            [prefKey(DIAG_PREF_INCLUDE_LOCAL_KEY), includeLocalChecks ? "1" : "0"],
            [
              prefKey(DIAG_PREF_INCLUDE_PIPELINE_KEY),
              includePipelineChecks ? "1" : "0",
            ],
            [prefKey(DIAG_PREF_SYNC_FIXES_KEY), syncFixesToGitHub ? "1" : "0"],
            [prefKey(DIAG_PREF_RERUN_AFTER_FIX_KEY), rerunAfterFix ? "1" : "0"],
            [prefKey(DIAG_PREF_AUTOFIX_WARN_KEY), autoFixIncludeWarn ? "1" : "0"],
            [prefKey(DIAG_PREF_AUTOFIX_SCOPE_KEY), autoFixScope],
          ]);
        } catch (e) {
          console.warn("[DiagnosticPrefs] Failed to persist preferences:", e);
        }
      })();
    }, 500);

    return () => {
      if (prefSaveTimer.current) clearTimeout(prefSaveTimer.current);
      prefSaveTimer.current = null;
    };
  }, [
    hydrated,
    autoFixIncludeWarn,
    autoFixScope,
    includeLocalChecks,
    includePipelineChecks,
    modeAdvanced,
    modesAll,
    prefKey,
    rerunAfterFix,
    selectedModes,
    syncFixesToGitHub,
  ]);

  
  // Single source of truth: if the global preferred profile changes, follow it
  // immediately unless user explicitly enabled Advanced/All modes.
  useEffect(() => {
    if (!hydrated) return;
    if (modeAdvanced) return;
    if (modesAll) return;
    setSelectedModes((prev) => {
      const only = recommendedMode;
      return prev.length === 1 && prev[0] === only ? prev : [only];
    });
  }, [hydrated, modeAdvanced, modesAll, recommendedMode]);

// Keep the project's preferred build profile in sync (so Build Screen + Diagnostics agree).
  // Only sync when user is in Recommended mode (single selection).
  useEffect(() => {
    if (typeof setPreferredBuildProfile !== "function") return;
    if (modeAdvanced) return;
    if (modesAll) return;
    const only = selectedModes[0] ?? recommendedMode;
    setPreferredBuildProfile(only);
  }, [modeAdvanced, modesAll, recommendedMode, selectedModes, setPreferredBuildProfile]);

  const selectedModeLabel = useMemo(() => {
    if (modesAll) return "all";
    if (modeAdvanced) return selectedModes.join(",");
    return selectedModes[0] ?? recommendedMode;
  }, [modeAdvanced, modesAll, recommendedMode, selectedModes]);

  return {
    // state
    modeAdvanced,
    modesAll,
    selectedModes,
    includeLocalChecks,
    includePipelineChecks,
    syncFixesToGitHub,
    rerunAfterFix,
    autoFixIncludeWarn,
    autoFixScope,
    selectedModeLabel,

    // setters
    setModeAdvanced,
    setModesAll,
    setSelectedModes,
    setIncludeLocalChecks,
    setIncludePipelineChecks,
    setSyncFixesToGitHub,
    setRerunAfterFix,
    setAutoFixIncludeWarn,
    setAutoFixScope,
  };
}