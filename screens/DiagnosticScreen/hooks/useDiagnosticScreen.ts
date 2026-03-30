// screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts
// REFACTORED: check runners → diagnosticRunners.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, LayoutAnimation, Platform, UIManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  STORAGE_KEYS,
  diagnosticLastOkKeyForSelection,
} from "../../../lib/storageKeys";


import type { BuildMode } from "../../../components/diagnostics/ModeSelector";
import type { TabKey } from "../../../components/diagnostics/SegmentedTabs";

import type { PreflightCheckResult, PreflightTarget } from "../../../lib/diagnostics/preflightTypes";

import { useDiagnosticCiAutofix } from "./useDiagnosticCiAutofix";

import { useInlineToast } from "../../../components/diagnostics/useInlineToast";
import type { IssueDetail } from "../../../components/diagnostics/IssueDetailSheet";
import type { Status } from "../types";

import { useDiagnosticPreferences } from "./useDiagnosticPreferences";
import { useDiagnosticUpload } from "./useDiagnosticUpload";
import { useDiagnosticFixRunner } from "./useDiagnosticFixRunner";
import { useDiagnosticSelection } from "./useDiagnosticSelection";
import { useDiagnosticIssueFiltering } from "./useDiagnosticIssueFiltering";
import { getDiagnosticFixOffer } from "../../../lib/diagnostics/fixResultContract";

import type { ProjectData, ProjectFile } from "../../../shared/types/project";

import { ORDER, runLocalChecks, runPipelineChecks } from "./diagnosticRunners";

export function pipelineCheckAppliesToModes(params: {
  checkId: string;
  modesAll: boolean;
  selectedModes: BuildMode[];
  recommendedMode: BuildMode;
}): boolean {
  const { checkId, modesAll, selectedModes, recommendedMode } = params;
  if (modesAll) return true;

  const enabled = new Set<BuildMode>(
    selectedModes.length ? selectedModes : [recommendedMode],
  );

  const isFor = (p: "development" | "preview" | "production") => {
    if (checkId.endsWith(`.${p}`)) return true;
    if (checkId.includes(`.${p}.`)) return true;
    if (checkId.includes(`easProfile.${p}`)) return true;
    return false;
  };

  const devOnly =
    checkId === "repo.easDevelopmentCoherent" ||
    checkId === "repo.easEnableDevClientFlow" ||
    checkId === "repo.dep.expoDevClient" ||
    checkId === "repo.dep.expoDevClient.read";

  if (devOnly) return enabled.has("development");
  if (isFor("development")) return enabled.has("development");
  if (isFor("preview")) return enabled.has("preview");
  if (isFor("production")) return enabled.has("production");
  return true;
}

export function useDiagnosticScreen(opts: {
  projectData: ProjectData | null;
  linkedRepo: string;
  linkedBranch?: string;
  setPreferredBuildProfile?: (mode: BuildMode) => void;
  navigation?: any;
  updateProjectFiles: (files: ProjectFile[], newName?: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
}) {
  const {
    projectData,
    linkedRepo,
    linkedBranch,
    setPreferredBuildProfile,
    updateProjectFiles,
    deleteFile,
  } = opts;

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
    // NOTE: In der New Architecture ist setLayoutAnimationEnabledExperimental ein No-Op (warn spam).
    const isNewArch = !!(globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;
    if (Platform.OS === "android" && !isNewArch) {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  // UI: main tabs + accordions
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



  // Used to reset undo history from inside runDiagnostics without circular dependencies.
  const clearHistoryRef = useRef<null | (() => void)>(null);

  // Recommended by default, Advanced optional multi-select
  const recommendedMode = useMemo<BuildMode>(() => {
    const preferred = String(projectData?.preferredBuildProfile || "development");
    if (preferred === "preview" || preferred === "production" || preferred === "development") {
      return preferred;
    }
    return "development";
  }, [projectData]);

  const prefs = useDiagnosticPreferences({
    projectData,
    linkedRepo,
    recommendedMode,
    setPreferredBuildProfile,
  });

  const {
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
  } = prefs;

  // CI/Workflow autofix (GitHub repo)
  const { ciFixing, ciFixLog, runCiAutofix } = useDiagnosticCiAutofix({
    linkedRepo,
    linkedBranch,
  });

  // Diagnostics run
  const [target, setTarget] = useState<PreflightTarget>({ mode: "expoGo" });
  const [results, setResults] = useState<PreflightCheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);

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

  const { selected, setSelected, selectedCount, clearSelection } = useDiagnosticSelection();

  const { issuesFilter, setIssuesFilter, visibleResults } = useDiagnosticIssueFiltering(sortedResults);

  const toSeverity = useCallback((s: Status): IssueDetail["severity"] => {
    if (s === "fail") return "critical";
    if (s === "warn") return "warning";
    return "info";
  }, []);


  const fixableResults = useMemo(() => {
    const list = sortedResults.filter((r) => !!r.fix?.patch);
    list.sort(
      (a, b) =>
        ORDER[(a.status as Status) ?? "pass"] -
        ORDER[(b.status as Status) ?? "pass"],
    );
    return list;
  }, [sortedResults]);

  const pipelineAppliesToFocus = useCallback(
    (id: string): boolean =>
      pipelineCheckAppliesToModes({
        checkId: id,
        modesAll,
        selectedModes,
        recommendedMode,
      }),
    [modesAll, recommendedMode, selectedModes],
  );

  const runDiagnostics = useCallback(
    async (opts?: { resetSelection?: boolean; resetHistory?: boolean }) => {
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
      if (resetSelection) clearSelection();
      if (resetHistory) clearHistoryRef.current?.();
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

        await runLocalChecks({
          includeLocalChecks,
          focusedProfiles,
          files,
          all,
          mountedRef,
          setResults,
          setProgressStage,
        });
        await runPipelineChecks({
          includePipelineChecks,
          linkedRepo,
          linkedBranch,
          files,
          pipelineAppliesToFocus,
          all,
          mountedRef,
          setResults,
          setProgressStage,
        });

        if (mountedRef.current) {
          setResults(all);
          setLastRunAt(Date.now());
          setProgressStage(null);
          // Persist diagnostic status (selection-scoped + legacy global fallback)
          const hasFails = all.some((r) => r.status === "fail");
          const diagValue = hasFails ? "false" : "true";
          const scopedDiagnosticKey = diagnosticLastOkKeyForSelection({
            linkedRepo,
            linkedBranch,
          });
          await Promise.all([
            AsyncStorage.setItem(scopedDiagnosticKey, diagValue).catch(() => {}),
            AsyncStorage.setItem(STORAGE_KEYS.DIAGNOSTIC_LAST_OK, diagValue).catch(() => {}),
          ]);
        }
      } catch (e: any) {
        Alert.alert("Diagnostics fehlgeschlagen", e?.message || "Unbekannter Fehler");
        if (mountedRef.current) setProgressStage(null);
      } finally {
        runningRef.current = false;
        if (mountedRef.current) setRunning(false);
      }
    },
    [
      clearSelection,
      includeLocalChecks,
      includePipelineChecks,
      linkedRepo,
      linkedBranch,
      modesAll,
      mountedRef,
      pipelineAppliesToFocus,
      recommendedMode,
      selectedModes,
    ],
  );

  // Upload state
  const uploadState = useDiagnosticUpload({ projectRef, mountedRef, results, target });
  const {
    uploadBusyRef,
    uploadBusy,
    uploadCooldownUntil,
    setUploadCooldownUntil,
    setCooldownNow,
    uploadCooldownLeftSec,
    getOrCreateUploadClientRequestId,
    resetUploadClientRequestId,
    upload,
    copyReport,
  } = uploadState;

  const toast = useInlineToast();
  const [reportVisible, setReportVisible] = useState(false);

  // Fix runner (split out from the old monolith)
  const fixRunner = useDiagnosticFixRunner({
    projectRef,
    mountedRef,
    linkedRepo,
    linkedBranch,
    updateProjectFiles,
    deleteFile,
    syncFixesToGitHub,
    rerunAfterFix,
    autoFixIncludeWarn,
    autoFixScope,
    sortedResults,
    visibleResults,
    fixableResults,
    selected,
    setSelected,
    runDiagnostics,
    toast,
    clearHistoryRef,
  });

  const {
    history,
    previewVisible,
    setPreviewVisible,
    previewLabel,
    previewEntries,
    setPreviewLabel,
    setPreviewEntries,
    applyBusy,
    fixModalVisible,
    fixModalTitle,
    fixModalSubtitle,
    fixSteps,
    fixStepIndex,
    fixDone,
    closeFixModal,
    openPreview,
    applyPatch,
    undoLast,
    undoAll,
    applySingle,
    autoFix,
    applySelected,
    smartFix,
    applyIssueFix,
    applyFixList,
  } = fixRunner;

  const tabDefs = useMemo(
    () => [
      { key: "overview" as const, label: "Overview" },
      { key: "issues" as const, label: "Issues", badge: counts.fail + counts.warn },
      { key: "fixes" as const, label: "Fixes", badge: fixableResults.length },
    ],
    [counts.fail, counts.warn, fixableResults.length],
  );

  const issueList = visibleResults;
  const busy = running || applyBusy;

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
    const fixOffer = getDiagnosticFixOffer(activeIssue);
    return {
      title: activeIssue.title,
      message: activeIssue.message,
      details: activeIssue.details,
      severity: toSeverity(st),
      hasFix: fixOffer.status !== "advisory_only",
      fixLabel: activeIssue.fix?.label || fixOffer.actionLabel,
      previewAvailable: fixOffer.previewAvailable,
    };
  }, [activeIssue, toSeverity]);

  const headerStats = useMemo(() => {
    const name = projectData?.name ?? "–";
    const easProfile = target.mode === "eas" ? target.profile : undefined;
    const mode = target.mode === "expoGo" ? "Expo Go" : `EAS: ${easProfile ?? "?"}`;
    const prof = (() => {
      if (modesAll) return "all";
      if (selectedModes.length > 1) return `${selectedModes.length} profiles`;
      return selectedModes[0] ?? recommendedMode;
    })();
    return { name, mode, profileLabel: prof };
  }, [modesAll, projectData?.name, recommendedMode, selectedModes, target]);

  return {
    toast,
    tab,
    setTab,
    tabDefs,
    issueList,
    busy,
    advancedOpen,
    advancedFixesOpen,
    toggleAdvanced,
    toggleAdvancedFixes,
    issuesFilter,
    setIssuesFilter,
    selected,
    setSelected,
    selectedCount,
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

    // workflow
    target,
    setTarget,
    results,
    setResults,
    running,
    progressStage,
    lastRunAt,
    history,
    previewVisible,
    setPreviewVisible,
    previewLabel,
    previewEntries,
    setPreviewLabel,
    setPreviewEntries,
    applyBusy,
    uploadBusy,
    fixModalVisible,
    fixModalTitle,
    fixModalSubtitle,
    fixSteps,
    fixStepIndex,
    fixDone,
    closeFixModal,
    counts,
    sortedResults,
    toSeverity,
    visibleResults,
    fixableResults,
    pipelineAppliesToFocus,
    runDiagnostics,
    openPreview,
    applyPatch,
    undoLast,
    undoAll,
    applySingle,
    autoFix,
    applySelected,
    smartFix,
    reportVisible,
    setReportVisible,
    issueSheetVisible,
    activeIssue,
    activeIssueDetail,
    openIssue,
    closeIssue,
    applyIssueFix,
    applyFixList,
    upload,
    copyReport,
    headerStats,
  };
}
