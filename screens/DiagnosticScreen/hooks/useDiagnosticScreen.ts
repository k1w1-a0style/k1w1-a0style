// screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts
// REFACTORED: Diagnostic screen hooks split into run/results/ui/action modules.

import { useEffect, useMemo, useRef } from "react";
import { Platform, UIManager } from "react-native";

import type { BuildMode } from "../../../components/diagnostics/ModeSelector";

import { useDiagnosticCiAutofix } from "./useDiagnosticCiAutofix";
import { useInlineToast } from "../../../components/diagnostics/useInlineToast";
import { useDiagnosticPreferences } from "./useDiagnosticPreferences";
import { useDiagnosticUpload } from "./useDiagnosticUpload";
import { useDiagnosticSelection } from "./useDiagnosticSelection";

import type { UseDiagnosticScreenOptions } from "./diagnosticScreen.contracts";
import { useDiagnosticUiState } from "./useDiagnosticUiState";
import { useDiagnosticRunController } from "./useDiagnosticRunController";
import { useDiagnosticResultsModel } from "./useDiagnosticResultsModel";
import { useDiagnosticActions } from "./useDiagnosticActions";
import { pipelineCheckAppliesToModes } from "./diagnosticPipelineModeRules";

export { pipelineCheckAppliesToModes };

export function useDiagnosticScreen(opts: UseDiagnosticScreenOptions) {
  const {
    projectData,
    linkedRepo,
    linkedBranch,
    setPreferredBuildProfile,
    updateProjectFiles,
    replaceProjectFiles,
    deleteFile,
  } = opts;

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
    const isNewArch = !!(globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;
    if (Platform.OS === "android" && !isNewArch) {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  const clearHistoryRef = useRef<null | (() => void)>(null);

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

  const { ciFixing, ciFixLog, runCiAutofix } = useDiagnosticCiAutofix({
    linkedRepo,
    linkedBranch,
  });

  const { selected, setSelected, selectedCount, clearSelection } = useDiagnosticSelection();
  const ui = useDiagnosticUiState();

  const run = useDiagnosticRunController({
    projectRef,
    mountedRef,
    linkedRepo,
    linkedBranch,
    includeLocalChecks,
    includePipelineChecks,
    modesAll,
    selectedModes,
    recommendedMode,
    pipelineAppliesToFocus: (id) =>
      pipelineCheckAppliesToModes({
        checkId: id,
        modesAll,
        selectedModes,
        recommendedMode,
      }),
    clearSelection,
    clearHistoryRef,
    onScopeInvalidated: () => {
      ui.setReportVisible(false);
      ui.setIssueSheetVisible(false);
      ui.setActiveIssue(null);
    },
  });

  const model = useDiagnosticResultsModel({
    results: run.results,
    modesAll,
    selectedModes,
    recommendedMode,
  });

  const toast = useInlineToast();

  const actions = useDiagnosticActions({
    projectRef,
    mountedRef,
    linkedRepo,
    linkedBranch,
    updateProjectFiles,
    replaceProjectFiles,
    deleteFile,
    syncFixesToGitHub,
    rerunAfterFix,
    autoFixIncludeWarn,
    autoFixScope,
    sortedResults: model.sortedResults,
    visibleResults: model.visibleResults,
    fixableResults: model.fixableResults,
    selected,
    setSelected,
    runDiagnostics: run.runDiagnostics,
    toast,
    clearHistoryRef,
    activeIssue: ui.activeIssue,
    setActiveIssue: ui.setActiveIssue,
    setIssueSheetVisible: ui.setIssueSheetVisible,
    toSeverity: model.toSeverity,
  });

  useEffect(() => {
    if (!ui.issueSheetVisible) {
      ui.setActiveIssue(null);
    }
  }, [ui.issueSheetVisible, ui.setActiveIssue]);

  useEffect(() => {
    if (run.scopeResetSeq === 0) return;
    actions.setPreviewVisible(false);
    actions.setPreviewLabel("");
    actions.setPreviewEntries([]);
  }, [run.scopeResetSeq, actions.setPreviewEntries, actions.setPreviewLabel, actions.setPreviewVisible]);

  useEffect(() => {
    if (!actions.previewVisible) {
      actions.setPreviewLabel("");
      actions.setPreviewEntries([]);
    }
  }, [actions.previewVisible, actions.setPreviewEntries, actions.setPreviewLabel]);

  const uploadState = useDiagnosticUpload({
    projectRef,
    mountedRef,
    results: run.results,
    target: run.target,
  });

  const tabDefs = useMemo(
    () => [
      { key: "overview" as const, label: "Overview" },
      { key: "issues" as const, label: "Issues", badge: model.counts.fail + model.counts.warn },
      { key: "fixes" as const, label: "Fixes", badge: model.fixableResults.length },
    ],
    [model.counts.fail, model.counts.warn, model.fixableResults.length],
  );

  const headerStats = useMemo(() => {
    const name = projectData?.name ?? "–";
    const easProfile = run.target.mode === "eas" ? run.target.profile : undefined;
    const mode = run.target.mode === "expoGo" ? "Expo Go" : `EAS: ${easProfile ?? "?"}`;
    const prof = (() => {
      if (modesAll) return "all";
      if (selectedModes.length > 1) return `${selectedModes.length} profiles`;
      return selectedModes[0] ?? recommendedMode;
    })();
    return { name, mode, profileLabel: prof };
  }, [modesAll, projectData?.name, recommendedMode, run.target, selectedModes]);

  return {
    toast,
    tab: ui.tab,
    setTab: ui.setTab,
    tabDefs,
    issueList: model.visibleResults,
    busy: run.running || actions.applyBusy,
    advancedOpen: ui.advancedOpen,
    advancedFixesOpen: ui.advancedFixesOpen,
    toggleAdvanced: ui.toggleAdvanced,
    toggleAdvancedFixes: ui.toggleAdvancedFixes,
    issuesFilter: model.issuesFilter,
    setIssuesFilter: model.setIssuesFilter,
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
    ...uploadState,

    target: run.target,
    setTarget: run.setTarget,
    results: run.results,
    setResults: run.setResults,
    running: run.running,
    progressStage: run.progressStage,
    lastRunAt: run.lastRunAt,

    ...actions,

    counts: model.counts,
    sortedResults: model.sortedResults,
    toSeverity: model.toSeverity,
    visibleResults: model.visibleResults,
    fixableResults: model.fixableResults,
    pipelineAppliesToFocus: model.pipelineAppliesToFocus,
    runDiagnostics: run.runDiagnostics,

    reportVisible: ui.reportVisible,
    setReportVisible: ui.setReportVisible,
    issueSheetVisible: ui.issueSheetVisible,
    activeIssue: ui.activeIssue,
    headerStats,
  };
}
