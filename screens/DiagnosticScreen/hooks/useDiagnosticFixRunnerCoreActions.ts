import { useCallback } from "react";
import { Alert } from "react-native";

import type { PreflightPatch } from "../../../lib/diagnostics/preflightTypes";
import { buildFixPreviewEntries, shouldSyncPatchToGitHub } from "./useDiagnosticFixRunnerHelpers";
import { applyPatchLocally, undoHistoryEntries, undoHistoryEntry } from "./fixRunnerLocalMutationExecutor";
import {
  dispatchWorkflowFix as dispatchWorkflowFixViaGitHub,
  syncPatchToGitHub as syncPatchToGitHubViaGitHub,
} from "./fixRunnerGitHubAdapter";
import type {
  ApplyPatchFn,
  UseDiagnosticFixRunnerOptions,
  UseDiagnosticFixRunnerState,
} from "./useDiagnosticFixRunner.contracts";
import { FIX_RUNNER_MAX_HISTORY } from "./useDiagnosticFixRunnerState";

export interface CoreActionResult {
  openPreview: (label: string, patch: PreflightPatch) => Promise<void>;
  shouldSyncPatch: (patch: PreflightPatch) => boolean;
  syncPatchToGitHub: (label: string, patch: PreflightPatch) => Promise<void>;
  applyPatch: ApplyPatchFn;
  dispatchWorkflowFix: (params: {
    owner: string;
    repo: string;
    workflowFileName: string;
    workflowRef: string;
    inputs: Record<string, string>;
    fallbackPatch?: PreflightPatch;
  }) => Promise<void>;
  undoLast: () => Promise<void>;
  undoAll: () => Promise<void>;
}

export function useDiagnosticFixRunnerCoreActions(params: {
  opts: Pick<
    UseDiagnosticFixRunnerOptions,
    | "projectRef"
    | "mountedRef"
    | "linkedRepo"
    | "linkedBranch"
    | "updateProjectFiles"
    | "replaceProjectFiles"
    | "deleteFile"
    | "syncFixesToGitHub"
  >;
  state: Pick<
    UseDiagnosticFixRunnerState,
    | "history"
    | "setHistory"
    | "setPreviewLabel"
    | "setPreviewEntries"
    | "setPreviewVisible"
    | "setApplyBusy"
    | "applyBusyRef"
  >;
}): CoreActionResult {
  const { opts, state } = params;
  const {
    projectRef,
    mountedRef,
    linkedRepo,
    linkedBranch,
    updateProjectFiles,
    replaceProjectFiles,
    deleteFile,
    syncFixesToGitHub,
  } = opts;
  const {
    history,
    setHistory,
    setPreviewLabel,
    setPreviewEntries,
    setPreviewVisible,
    setApplyBusy,
    applyBusyRef,
  } = state;

  const openPreview = useCallback(async (label: string, patch: PreflightPatch) => {
    if (!projectRef.current) return;
    const entries = buildFixPreviewEntries(projectRef.current.files, patch);
    setPreviewLabel(label);
    setPreviewEntries(entries);
    setPreviewVisible(true);
  }, [projectRef, setPreviewEntries, setPreviewLabel, setPreviewVisible]);

  const shouldSyncPatch = useCallback(
    (patch: PreflightPatch): boolean => {
      return shouldSyncPatchToGitHub({ patch, syncFixesToGitHub, linkedRepo });
    },
    [linkedRepo, syncFixesToGitHub],
  );

  const syncPatchToGitHub = useCallback(
    async (label: string, patch: PreflightPatch) => {
      await syncPatchToGitHubViaGitHub({ label, patch, linkedRepo, linkedBranch, projectRef });
    },
    [linkedBranch, linkedRepo, projectRef],
  );

  const applyPatch = useCallback<ApplyPatchFn>(
    async (label, patch) => {
      if (!projectRef.current) throw new Error("Kein Projekt geladen.");
      if (applyBusyRef.current) return;

      applyBusyRef.current = true;
      if (mountedRef.current) setApplyBusy(true);

      try {
        const result = await applyPatchLocally({
          label,
          patch,
          projectRef,
          deleteFile,
          replaceProjectFiles,
        });

        projectRef.current = { ...projectRef.current, files: result.nextFiles };
        setHistory((prev) => [result.historyEntry, ...prev].slice(0, FIX_RUNNER_MAX_HISTORY));

        return {
          status: result.status,
          localChangeApplied: result.localChangeApplied,
          partial: result.partial,
        };
      } finally {
        applyBusyRef.current = false;
        if (mountedRef.current) setApplyBusy(false);
      }
    },
    [
      applyBusyRef,
      deleteFile,
      mountedRef,
      projectRef,
      replaceProjectFiles,
      setApplyBusy,
      setHistory,
      updateProjectFiles,
    ],
  );

  const dispatchWorkflowFix = useCallback(
    async (workflowParams: {
      owner: string;
      repo: string;
      workflowFileName: string;
      workflowRef: string;
      inputs: Record<string, string>;
      fallbackPatch?: PreflightPatch;
    }) => {
      await dispatchWorkflowFixViaGitHub({
        ...workflowParams,
        applyPatch,
      });
    },
    [applyPatch],
  );

  const undoLast = useCallback(async () => {
    const last = history[0];
    if (!last) return;
    if (applyBusyRef.current) return;

    applyBusyRef.current = true;
    if (mountedRef.current) setApplyBusy(true);

    try {
      await undoHistoryEntry({ entry: last, deleteFile, updateProjectFiles });
      setHistory((prev) => prev.slice(1));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      Alert.alert("Undo fehlgeschlagen", msg);
    } finally {
      applyBusyRef.current = false;
      if (mountedRef.current) setApplyBusy(false);
    }
  }, [applyBusyRef, deleteFile, history, mountedRef, setApplyBusy, setHistory, updateProjectFiles]);

  const undoAll = useCallback(async () => {
    if (!history.length) return;
    if (applyBusyRef.current) return;

    Alert.alert("Alle Fixes rückgängig machen?", `${history.length} Fix(es) werden zurückgesetzt.`, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Undo All",
        style: "destructive",
        onPress: async () => {
          applyBusyRef.current = true;
          if (mountedRef.current) setApplyBusy(true);

          let undone = 0;
          try {
            const undoResult = await undoHistoryEntries({ entries: history, deleteFile, updateProjectFiles });
            undone = undoResult.undone;
            if (undoResult.failedMessage) {
              Alert.alert(
                "Undo All fehlgeschlagen",
                `Abgebrochen nach ${undone} Fix(es): ${undoResult.failedMessage}`,
              );
            }
            if (mountedRef.current && undone > 0) {
              setHistory((prev) => prev.slice(undone));
              Alert.alert("✓ Undo", `${undone} Fix(es) rückgängig gemacht.`);
            }
          } finally {
            applyBusyRef.current = false;
            if (mountedRef.current) setApplyBusy(false);
          }
        },
      },
    ]);
  }, [applyBusyRef, deleteFile, history, mountedRef, setApplyBusy, setHistory, updateProjectFiles]);

  return {
    openPreview,
    shouldSyncPatch,
    syncPatchToGitHub,
    applyPatch,
    dispatchWorkflowFix,
    undoLast,
    undoAll,
  };
}
