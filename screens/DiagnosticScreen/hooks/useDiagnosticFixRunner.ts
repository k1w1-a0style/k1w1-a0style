import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import type { ProjectData, ProjectFile } from "../../../shared/types/project";
import type {
  PreflightCheckResult,
  PreflightPatch,
} from "../../../lib/diagnostics/preflightTypes";
import { markRepoSyncSignature } from "../../../lib/repoSyncOrchestration";
import { createOrUpdateFile, deleteRepoFile, triggerWorkflow } from "../../../infra/github/githubService";
import { parseOwnerRepo } from "../../../lib/diagnostics/ciAutoFix";
import {
  DiagnosticFixApplyError,
} from "../../../lib/diagnostics/fixResultContract";
import { findOwnershipViolations } from "../../../lib/projectOwnership";
import {
} from "./fixRunnerHelpers";
import {
  getErrorMessage,
} from "./fixRunnerResultHelpers";
import {
  pickAutoFixCandidates,
  pickSelectedFixCandidates,
  pickSmartFixCandidates,
} from "./fixRunnerOrchestrationHelpers";
import { useFixStepProgress } from "./useFixStepProgress";
import {
  applyUndoHistoryEntry,
  buildPatchApplyState,
  collectNormalizedTouchedPaths,
  countPatchOperations,
} from "./fixRunnerMutationHelpers";
import {
  buildAutoFixStartMessage,
  buildSelectedFixLimitMessage,
  buildSmartFixLimitMessage,
  confirmWithAlert,
} from "./fixRunnerPromptHelpers";
import {
  buildFixPreviewEntries,
  collectDeletedPatchPaths,
  collectPatchTouchedPaths,
  sameProjectFiles,
  shouldSyncPatchToGitHub,
} from "./useDiagnosticFixRunnerHelpers";
import {
  AUTOFIX_MAX,
  buildSingleFixPromptMessage,
  executeBatchFixFlow,
  executeIssueFixFlow,
  executeSingleFixFlow,
  getSingleFixPromptMeta,
} from "./fixRunnerFlowExecutor";

import type {
  FixHistoryEntry,
} from "../types";

const MAX_HISTORY = 10;
type ToastLike = { show: (msg: string) => void };

export function useDiagnosticFixRunner(opts: {
  projectRef: MutableRefObject<ProjectData | null>;
  mountedRef: MutableRefObject<boolean>;
  linkedRepo: string;
  linkedBranch?: string;
  updateProjectFiles: (files: ProjectFile[]) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;

  // Fix options
  syncFixesToGitHub: boolean;
  rerunAfterFix: boolean;
  autoFixIncludeWarn: boolean;
  autoFixScope: "visible" | "all";

  // Lists
  sortedResults: PreflightCheckResult[];
  visibleResults: PreflightCheckResult[];
  fixableResults: PreflightCheckResult[];

  // Selection state (owned by parent)
  selected: Record<string, boolean>;
  setSelected: Dispatch<SetStateAction<Record<string, boolean>>>;

  // Diagnostics re-run callback
  runDiagnostics: (opts?: { resetSelection?: boolean; resetHistory?: boolean }) => Promise<void>;

  // Optional toast
  toast?: ToastLike;

  // Optional: parent can trigger history reset (e.g. on a fresh diagnostics run)
  clearHistoryRef?: MutableRefObject<null | (() => void)>;
}) {
  const {
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
  } = opts;

  const [history, setHistory] = useState<FixHistoryEntry[]>([]);

  // Allow parent to reset undo history without creating a circular dependency.
  useEffect(() => {
    if (!clearHistoryRef) return;
    clearHistoryRef.current = () => setHistory([]);
    return () => {
      // avoid keeping a stale closure around
      if (clearHistoryRef.current) clearHistoryRef.current = null;
    };
  }, [clearHistoryRef]);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLabel, setPreviewLabel] = useState("");
  const [previewEntries, setPreviewEntries] = useState<
    Array<{ path: string; oldText: string | null; newText: string | null }>
  >([]);

  const [applyBusy, setApplyBusy] = useState(false);
  const applyBusyRef = useRef(false);

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
  } = useFixStepProgress(toast);

  const openPreview = useCallback(async (label: string, patch: PreflightPatch) => {
    if (!projectRef.current) return;
    const entries = buildFixPreviewEntries(projectRef.current.files, patch);

    setPreviewLabel(label);
    setPreviewEntries(entries);
    setPreviewVisible(true);
  }, [projectRef]);

  const patchTouchedPaths = useCallback((patch: PreflightPatch): string[] => {
    return collectPatchTouchedPaths(patch);
  }, []);

  const shouldSyncPatch = useCallback(
    (patch: PreflightPatch): boolean => {
      return shouldSyncPatchToGitHub({
        patch,
        syncFixesToGitHub,
        linkedRepo,
      });
    },
    [linkedRepo, syncFixesToGitHub],
  );

  const syncPatchToGitHub = useCallback(
    async (label: string, patch: PreflightPatch) => {
      const parsed = parseOwnerRepo(linkedRepo);
      if (!parsed) throw new Error("Kein verknüpftes Repo gefunden (owner/repo).");

      const branch = (linkedBranch || "").trim();
      if (!branch) {
        throw new Error("Kein Branch verknüpft.");
      }
      const touched = patchTouchedPaths(patch);

      const deletedSet = new Set(collectDeletedPatchPaths(patch));

      const filesNow = projectRef.current?.files ?? [];
      const nowMap = new Map(filesNow.map((f) => [f.path, f.content] as const));

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

      for (const p of Array.from(deletedSet)) {
        await deleteRepoFile(parsed.owner, parsed.repo, p, `Diagnostics: ${label}`, branch);
      }

      await markRepoSyncSignature({
        linkedRepo,
        linkedBranch: branch,
        files: projectRef.current?.files ?? [],
      });
    },
    [linkedRepo, linkedBranch, patchTouchedPaths, projectRef],
  );

  const applyPatch = useCallback(
    async (label: string, patch: PreflightPatch) => {
      if (!projectRef.current) throw new Error("Kein Projekt geladen.");
      if (applyBusyRef.current) return;

      applyBusyRef.current = true;
      if (mountedRef.current) setApplyBusy(true);

      const currentFiles = projectRef.current.files;
      const operationCount = countPatchOperations(patch);
      if (operationCount === 0) {
        throw new DiagnosticFixApplyError({
          message: "Patch enthält keine anwendbaren Änderungen.",
          status: "blocked",
        });
      }

      let deletedCount = 0;
      try {
        const normalizedTouched = collectNormalizedTouchedPaths(patch);

        const ownershipViolations = findOwnershipViolations("diagnosisAutofix", normalizedTouched);
        if (ownershipViolations.length) {
          const details = ownershipViolations
            .map((v) => `- ${v.path}: ${v.reason}`)
            .join("\n");
          throw new Error(
            `Patch überschreitet Ownership-Grenzen und wurde blockiert:\n${details}`,
          );
        }

        const { nextFiles, snapshot, createdPaths, deletePaths } = await buildPatchApplyState({
          patch,
          currentFiles,
          applyJsonMerge: async (files, jsonMerge) => {
            const { applyJsonMergePatchSafe } = await import("../../../lib/diagnostics/smartPatch");
            return applyJsonMergePatchSafe(files, jsonMerge);
          },
        });

        for (const p of deletePaths) {
          await deleteFile(p);
          deletedCount++;
        }

        if (sameProjectFiles(currentFiles, nextFiles)) {
          throw new DiagnosticFixApplyError({
            message: "Patch hat lokal keine wirksamen Änderungen erzeugt.",
            status: "blocked",
          });
        }

        await updateProjectFiles(nextFiles);

        // Only update the shadow ref after both delete + upsert succeeded.
        // This keeps projectRef consistent with projectData for subsequent
        // batch patches that read from projectRef.current.
        projectRef.current = { ...projectRef.current, files: nextFiles };

        setHistory((prev) => {
          const entry: FixHistoryEntry = { label, at: Date.now(), snapshot, createdPaths };
          return [entry, ...prev].slice(0, MAX_HISTORY);
        });
        return {
          status: "patch_applied" as const,
          localChangeApplied: true,
          partial: false,
        };
      } catch (error: unknown) {
        if (error instanceof DiagnosticFixApplyError) {
          throw error;
        }
        const message = error instanceof Error ? error.message : "Patch konnte nicht angewendet werden.";
        throw new DiagnosticFixApplyError({
          message,
          status: "failed",
          partial: deletedCount > 0,
          localChangeApplied: deletedCount > 0,
        });
      } finally {
        applyBusyRef.current = false;
        if (mountedRef.current) setApplyBusy(false);
      }
    },
    [deleteFile, mountedRef, projectRef, updateProjectFiles],
  );

  const dispatchWorkflowFix = useCallback(
    async (params: {
      owner: string;
      repo: string;
      workflowFileName: string;
      workflowRef: string;
      inputs: Record<string, string>;
      fallbackPatch?: PreflightPatch;
    }) => {
      try {
        await triggerWorkflow(
          params.owner,
          params.repo,
          params.workflowFileName,
          params.workflowRef,
          params.inputs,
        );
      } catch (error: unknown) {
        const msg = getErrorMessage(error, "");
        if (/404|not found/i.test(msg) && params.fallbackPatch) {
          await applyPatch(`Bootstrap ${params.workflowFileName}`, params.fallbackPatch);
          await triggerWorkflow(
            params.owner,
            params.repo,
            params.workflowFileName,
            params.workflowRef,
            params.inputs,
          );
          return;
        }
        throw error;
      }
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
      await applyUndoHistoryEntry({
        entry: last,
        deleteFile,
        updateProjectFiles,
      });
      setHistory((prev) => prev.slice(1));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      Alert.alert("Undo fehlgeschlagen", msg);
    } finally {
      applyBusyRef.current = false;
      if (mountedRef.current) setApplyBusy(false);
    }
  }, [deleteFile, history, mountedRef, updateProjectFiles]);

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
            for (const entry of history) {
              try {
                await applyUndoHistoryEntry({
                  entry,
                  deleteFile,
                  updateProjectFiles,
                });
                undone++;
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
                Alert.alert(
                  "Undo All fehlgeschlagen",
                  `Abgebrochen nach ${undone} Fix(es): ${msg}`,
                );
                break;
              }
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
  }, [deleteFile, history, mountedRef, updateProjectFiles]);

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
      finishWithResult,
      linkedBranch,
      linkedRepo,
      rerunAfterFix,
      runDiagnostics,
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
    [applyPatch, finishWithResult, projectRef, rerunAfterFix, runDiagnostics, shouldSyncPatch, syncPatchToGitHub],
  );

  const smartFix = useCallback(async () => {
    if (!projectRef.current) return;
    if (applyBusyRef.current) return;

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
  }, [applyFixList, fixableResults]);

  const applySelected = useCallback(async () => {
    if (!projectRef.current) return;
    if (applyBusyRef.current) return;

    const chosenAll = pickSelectedFixCandidates({ sortedResults, selected }).map(
      ({ result }) => result,
    );
    if (!chosenAll.length) {
      Alert.alert("Nichts ausgewählt", "Bitte wähle Fixes aus.");
      return;
    }

    if (chosenAll.length > AUTOFIX_MAX) {
      const proceed = await confirmWithAlert({
        title: "Zu viele Fixes",
        message: buildSelectedFixLimitMessage({
          max: AUTOFIX_MAX,
          selectedCount: chosenAll.length,
        }),
        confirmText: `Weiter (${AUTOFIX_MAX}/${chosenAll.length})`,
      });
      if (!proceed) return;
    }

    const chosen = chosenAll.slice(0, AUTOFIX_MAX);
    await applyFixList(chosen, "Fix Selected");
  }, [applyFixList, projectRef, selected, sortedResults]);

  const autoFix = useCallback(async () => {
    if (!projectRef.current) return;
    if (applyBusyRef.current) return;

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
      buildAutoFixStartMessage({
        count: slice.length,
        autoFixScope,
        autoFixIncludeWarn,
      }),
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
  }, [applyFixList, autoFixIncludeWarn, autoFixScope, fixableResults, projectRef, visibleResults]);

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

      Alert.alert(
        "Fix anwenden?",
        buildSingleFixPromptMessage({ result: r, syncWouldHelp, sizeNote }),
        [
          { text: "Abbrechen", style: "cancel" },
          { text: "Preview", onPress: () => openPreview(r.title, patch) },
          { text: "Fix", onPress: () => runOne(false) },
          ...(canSyncRepo ? [{ text: "Fix + Sync", onPress: () => runOne(true) }] : []),
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
      finishWithResult,
    ],
  );

  const applyFixListPublic = applyFixList; // naming parity with old hook

  return {
    // state
    history,
    previewVisible,
    setPreviewVisible,
    previewLabel,
    previewEntries,
    setPreviewLabel,
    setPreviewEntries,
    applyBusy,

    // modals
    fixModalVisible,
    fixModalTitle,
    fixModalSubtitle,
    fixSteps,
    fixStepIndex,
    fixDone,
    closeFixModal,

    // actions
    setSelected,
    openPreview,
    applyPatch,
    undoLast,
    undoAll,
    applySingle,
    autoFix,
    applySelected,
    smartFix,
    applyIssueFix,
    applyFixList: applyFixListPublic,
  };
}
