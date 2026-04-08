import { useCallback } from "react";
import { Alert } from "react-native";

import type { PreflightCheckResult } from "../../../lib/diagnostics/preflightTypes";
import {
  pickAutoFixCandidates,
  pickSelectedFixCandidates,
  pickSmartFixCandidates,
} from "./fixRunnerOrchestrationHelpers";
import {
  buildAutoFixStartMessage,
  buildSelectedFixLimitMessage,
  buildSmartFixLimitMessage,
  confirmWithAlert,
} from "./fixRunnerPromptHelpers";
import {
  AUTOFIX_MAX,
  buildSingleFixPromptMessage,
  executeBatchFixFlow,
  executeIssueFixFlow,
  executeSingleFixFlow,
  getSingleFixPromptMeta,
} from "./fixRunnerFlowExecutor";
import type {
  UseDiagnosticFixRunnerOptions,
} from "./useDiagnosticFixRunner.contracts";
import type { CoreActionResult } from "./useDiagnosticFixRunnerCoreActions";

export function useDiagnosticFixRunnerApplyActions(params: {
  opts: Pick<
    UseDiagnosticFixRunnerOptions,
    | "projectRef"
    | "linkedRepo"
    | "linkedBranch"
    | "rerunAfterFix"
    | "autoFixIncludeWarn"
    | "autoFixScope"
    | "sortedResults"
    | "visibleResults"
    | "fixableResults"
    | "selected"
    | "runDiagnostics"
  >;
  progress: {
    openFixModal: ReturnType<typeof import("./useFixStepProgress").useFixStepProgress>["openFixModal"];
    runFixStep: ReturnType<typeof import("./useFixStepProgress").useFixStepProgress>["runFixStep"];
    finishWithResult: ReturnType<typeof import("./useFixStepProgress").useFixStepProgress>["finishWithResult"];
    markFixStepFailed: ReturnType<typeof import("./useFixStepProgress").useFixStepProgress>["markFixStepFailed"];
  };
  coreActions: Pick<
    CoreActionResult,
    | "openPreview"
    | "applyPatch"
    | "dispatchWorkflowFix"
    | "shouldSyncPatch"
    | "syncPatchToGitHub"
  >;
  applyBusyRef: { current: boolean };
}) {
  const { opts, progress, coreActions, applyBusyRef } = params;
  const {
    projectRef,
    linkedRepo,
    linkedBranch,
    rerunAfterFix,
    autoFixIncludeWarn,
    autoFixScope,
    sortedResults,
    visibleResults,
    fixableResults,
    selected,
    runDiagnostics,
  } = opts;
  const { openFixModal, runFixStep, finishWithResult, markFixStepFailed } = progress;
  const { openPreview, applyPatch, dispatchWorkflowFix, shouldSyncPatch, syncPatchToGitHub } = coreActions;

  const applyIssueFix = useCallback(
    async (r: PreflightCheckResult) => {
      await executeIssueFixFlow({
        result: r,
        linkedRepo,
        linkedBranch,
        rerunAfterFix,
        openFixModal,
        runFixStep,
        finishWithResult,
        markFixStepFailed,
        applyPatch,
        dispatchWorkflowFix,
        shouldSyncPatch,
        syncPatchToGitHub,
        runDiagnostics: () => runDiagnostics({ resetSelection: false, resetHistory: false }),
      });
    },
    [
      applyPatch,
      dispatchWorkflowFix,
      finishWithResult,
      linkedBranch,
      linkedRepo,
      markFixStepFailed,
      openFixModal,
      rerunAfterFix,
      runDiagnostics,
      runFixStep,
      shouldSyncPatch,
      syncPatchToGitHub,
    ],
  );

  const applyFixList = useCallback(
    async (items: PreflightCheckResult[], label: string) => {
      if (!projectRef.current) return;
      await executeBatchFixFlow({
        items,
        label,
        rerunAfterFix,
        openFixModal,
        runFixStep,
        finishWithResult,
        applyPatch,
        shouldSyncPatch,
        syncPatchToGitHub,
        runDiagnostics: () => runDiagnostics({ resetSelection: false, resetHistory: false }),
        onHardLimitBlock: (message) => {
          Alert.alert("Patch too large", message);
        },
      });
    },
    [
      applyPatch,
      finishWithResult,
      openFixModal,
      projectRef,
      rerunAfterFix,
      runDiagnostics,
      runFixStep,
      shouldSyncPatch,
      syncPatchToGitHub,
    ],
  );

  const smartFix = useCallback(async () => {
    if (!projectRef.current || applyBusyRef.current) return;

    const recommended = pickSmartFixCandidates(fixableResults).map(({ result }) => result);
    if (!recommended.length) {
      Alert.alert("Nichts zu fixen", "Keine empfohlenen Fixes (Critical) gefunden.");
      return;
    }

    const total = recommended.length;
    const slice = recommended.slice(0, AUTOFIX_MAX);
    if (total > AUTOFIX_MAX) {
      const proceed = await confirmWithAlert({
        title: "Smart Fix Limit",
        message: buildSmartFixLimitMessage({ max: AUTOFIX_MAX, total }),
        confirmText: `Apply ${AUTOFIX_MAX}`,
      });
      if (!proceed) return;
    }

    await applyFixList(slice, "Smart Fix");
  }, [applyBusyRef, applyFixList, fixableResults, projectRef]);

  const applySelected = useCallback(async () => {
    if (!projectRef.current || applyBusyRef.current) return;

    const chosenAll = pickSelectedFixCandidates({ sortedResults, selected }).map(({ result }) => result);
    if (!chosenAll.length) {
      Alert.alert("Nichts ausgewählt", "Bitte wähle Fixes aus.");
      return;
    }

    if (chosenAll.length > AUTOFIX_MAX) {
      const proceed = await confirmWithAlert({
        title: "Zu viele Fixes",
        message: buildSelectedFixLimitMessage({ max: AUTOFIX_MAX, selectedCount: chosenAll.length }),
        confirmText: `Weiter (${AUTOFIX_MAX}/${chosenAll.length})`,
      });
      if (!proceed) return;
    }

    await applyFixList(chosenAll.slice(0, AUTOFIX_MAX), "Fix Selected");
  }, [applyBusyRef, applyFixList, projectRef, selected, sortedResults]);

  const autoFix = useCallback(async () => {
    if (!projectRef.current || applyBusyRef.current) return;

    const chosen = pickAutoFixCandidates({
      autoFixScope,
      visibleResults,
      fixableResults,
      autoFixIncludeWarn,
    }).map(({ result }) => result);

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
      buildAutoFixStartMessage({ count: slice.length, autoFixScope, autoFixIncludeWarn }),
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "AutoFix",
          onPress: async () => {
            await applyFixList(slice, "AutoFix");
          },
        },
      ],
    );
  }, [applyBusyRef, applyFixList, autoFixIncludeWarn, autoFixScope, fixableResults, projectRef, visibleResults]);

  const applySingle = useCallback(
    (r: PreflightCheckResult) => {
      const { blockedReason, sizeNote, canSyncRepo, syncWouldHelp, patch } = getSingleFixPromptMeta({
        result: r,
        linkedRepo,
        shouldSyncPatch,
      });
      if (!patch) return;
      if (blockedReason) {
        Alert.alert("Patch too large", blockedReason);
        return;
      }

      const runOne = async (doSync: boolean) => {
        await executeSingleFixFlow({
          result: r,
          doSync,
          rerunAfterFix,
          openFixModal,
          runFixStep,
          finishWithResult,
          applyPatch,
          syncPatchToGitHub,
          runDiagnostics: () => runDiagnostics({ resetSelection: false, resetHistory: false }),
        });
      };

      Alert.alert("Fix anwenden?", buildSingleFixPromptMessage({ result: r, syncWouldHelp, sizeNote }), [
        { text: "Abbrechen", style: "cancel" },
        { text: "Preview", onPress: () => openPreview(r.title, patch) },
        { text: "Fix", onPress: () => runOne(false) },
        ...(canSyncRepo ? [{ text: "Fix + Sync", onPress: () => runOne(true) }] : []),
      ]);
    },
    [
      applyPatch,
      finishWithResult,
      linkedRepo,
      openFixModal,
      openPreview,
      rerunAfterFix,
      runDiagnostics,
      runFixStep,
      shouldSyncPatch,
      syncPatchToGitHub,
    ],
  );

  return {
    applyIssueFix,
    applyFixList,
    smartFix,
    applySelected,
    autoFix,
    applySingle,
  };
}

export type UseDiagnosticFixRunnerApplyActionsResult = ReturnType<typeof useDiagnosticFixRunnerApplyActions>;
