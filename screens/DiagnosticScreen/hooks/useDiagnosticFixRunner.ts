import { useFixStepProgress } from "./useFixStepProgress";

import type { UseDiagnosticFixRunnerOptions } from "./useDiagnosticFixRunner.contracts";
import { useDiagnosticFixRunnerState } from "./useDiagnosticFixRunnerState";
import { useDiagnosticFixRunnerCoreActions } from "./useDiagnosticFixRunnerCoreActions";
import { useDiagnosticFixRunnerApplyActions } from "./useDiagnosticFixRunnerApplyActions";

export function useDiagnosticFixRunner(opts: UseDiagnosticFixRunnerOptions) {
  const state = useDiagnosticFixRunnerState({ clearHistoryRef: opts.clearHistoryRef });

  const {
    fixModalVisible,
    fixModalTitle,
    fixModalSubtitle,
    fixSteps,
    fixStepIndex,
    fixDone,
    finishWithResult,
    closeFixModal,
    openFixModal,
    markFixStepFailed,
    runFixStep,
  } = useFixStepProgress(opts.toast);

  const coreActions = useDiagnosticFixRunnerCoreActions({
    opts: {
      projectRef: opts.projectRef,
      mountedRef: opts.mountedRef,
      linkedRepo: opts.linkedRepo,
      linkedBranch: opts.linkedBranch,
      updateProjectFiles: opts.updateProjectFiles,
      deleteFile: opts.deleteFile,
      syncFixesToGitHub: opts.syncFixesToGitHub,
    },
    state: {
      history: state.history,
      setHistory: state.setHistory,
      setPreviewLabel: state.setPreviewLabel,
      setPreviewEntries: state.setPreviewEntries,
      setPreviewVisible: state.setPreviewVisible,
      setApplyBusy: state.setApplyBusy,
      applyBusyRef: state.applyBusyRef,
    },
  });

  const applyActions = useDiagnosticFixRunnerApplyActions({
    opts: {
      projectRef: opts.projectRef,
      linkedRepo: opts.linkedRepo,
      linkedBranch: opts.linkedBranch,
      rerunAfterFix: opts.rerunAfterFix,
      autoFixIncludeWarn: opts.autoFixIncludeWarn,
      autoFixScope: opts.autoFixScope,
      sortedResults: opts.sortedResults,
      visibleResults: opts.visibleResults,
      fixableResults: opts.fixableResults,
      selected: opts.selected,
      runDiagnostics: opts.runDiagnostics,
    },
    progress: {
      openFixModal,
      runFixStep,
      finishWithResult,
      markFixStepFailed,
    },
    coreActions: {
      openPreview: coreActions.openPreview,
      applyPatch: coreActions.applyPatch,
      dispatchWorkflowFix: coreActions.dispatchWorkflowFix,
      shouldSyncPatch: coreActions.shouldSyncPatch,
      syncPatchToGitHub: coreActions.syncPatchToGitHub,
    },
    applyBusyRef: state.applyBusyRef,
  });

  return {
    history: state.history,
    previewVisible: state.previewVisible,
    setPreviewVisible: state.setPreviewVisible,
    previewLabel: state.previewLabel,
    previewEntries: state.previewEntries,
    setPreviewLabel: state.setPreviewLabel,
    setPreviewEntries: state.setPreviewEntries,
    applyBusy: state.applyBusy,

    fixModalVisible,
    fixModalTitle,
    fixModalSubtitle,
    fixSteps,
    fixStepIndex,
    fixDone,
    closeFixModal,

    setSelected: opts.setSelected,
    openPreview: coreActions.openPreview,
    applyPatch: coreActions.applyPatch,
    undoLast: coreActions.undoLast,
    undoAll: coreActions.undoAll,
    applySingle: applyActions.applySingle,
    autoFix: applyActions.autoFix,
    applySelected: applyActions.applySelected,
    smartFix: applyActions.smartFix,
    applyIssueFix: applyActions.applyIssueFix,
    applyFixList: applyActions.applyFixList,
  };
}
