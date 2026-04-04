import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import type { ProjectData, ProjectFile } from "../../../shared/types/project";
import type {
  PreflightCheckResult,
  PreflightPatch,
} from "../../../lib/diagnostics/preflightTypes";
import { safeTruncateText } from "../../../lib/diagnostics/sanitize";
import {
  DEFAULT_PATCH_LIMITS,
  checkPatchLimits,
  summarizeBatchLimits,
  summarizeBatchRisk,
} from "../../../lib/diagnostics/fixSafety";
import { markRepoSyncSignature } from "../../../lib/repoSyncOrchestration";
import { validateFileContent, validateFilePath } from "../../../lib/validators";
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
  formatBatchFixResultDetail,
  formatBatchFixSubtitle,
} from "./fixRunnerDisplayHelpers";
import {
  buildIssueFixPlan,
  buildIssueFixSuccessResult,
  buildSingleFixPlan,
  buildSingleFixSuccessResult,
} from "./fixRunnerFlowPlanHelpers";
import {
  runApplyStep,
  runDispatchStep,
  runSyncStep,
  runVerifyStep,
} from "./fixRunnerExecutionHelpers";
import {
  pickAutoFixCandidates,
  pickSelectedFixCandidates,
  pickSmartFixCandidates,
  resolveWorkflowDispatchTarget,
} from "./fixRunnerOrchestrationHelpers";
import { useFixStepProgress } from "./useFixStepProgress";
import {
  buildBatchExecutionPlan,
  collectBatchSafetyPatches,
} from "./fixRunnerBatchPlanHelpers";
import {
  buildAutoFixStartMessage,
  buildBatchRiskPromptMessage,
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

import type {
  FixHistoryEntry,
} from "../types";

const MAX_HISTORY = 10;
export const AUTOFIX_MAX = 50; // safety: don't apply endless chains

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
      const operationCount =
        (patch.upsert?.length ?? 0) + (patch.delete?.length ?? 0) + (patch.jsonMerge?.length ?? 0);
      if (operationCount === 0) {
        throw new DiagnosticFixApplyError({
          message: "Patch enthält keine anwendbaren Änderungen.",
          status: "blocked",
        });
      }

      let deletedCount = 0;
      try {
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
              throw new Error(`Ungültiger Pfad im Patch: ${p} (${v.errors.join(", ") || "invalid"})`);
            return v.normalized;
          })
          .sort();

        const ownershipViolations = findOwnershipViolations("diagnosisAutofix", normalizedTouched);
        if (ownershipViolations.length) {
          const details = ownershipViolations
            .map((v) => `- ${v.path}: ${v.reason}`)
            .join("\n");
          throw new Error(
            `Patch überschreitet Ownership-Grenzen und wurde blockiert:\n${details}`,
          );
        }

        const currentMap = new Map(currentFiles.map((f) => [f.path, f] as const));
        const snapshot: ProjectFile[] = [];
        const createdPaths: string[] = [];
        for (const p of normalizedTouched) {
          const prev = currentMap.get(p);
          if (prev) snapshot.push(prev);
          else createdPaths.push(p);
        }

        const nextMap = new Map(currentFiles.map((f) => [f.path, f.content] as const));

        for (const u of patch.upsert ?? []) {
          const pv = validateFilePath(u.path);
          if (!pv.valid || !pv.normalized)
            throw new Error(`Ungültiger Pfad im Patch: ${u.path} (${pv.errors.join(", ") || "invalid"})`);
          const cv = validateFileContent(u.content ?? "");
          if (!cv.valid) throw new Error(`Ungültiger File-Content für ${u.path}: ${cv.error ?? "unknown"}`);
          nextMap.set(pv.normalized, u.content ?? "");
        }

        for (const p of patch.delete ?? []) {
          const pv = validateFilePath(p);
          if (!pv.valid || !pv.normalized)
            throw new Error(`Ungültiger Pfad im Patch: ${p} (${pv.errors.join(", ") || "invalid"})`);
          nextMap.delete(pv.normalized);
        }

        if (patch.jsonMerge?.length) {
          const { applyJsonMergePatchSafe } = await import("../../../lib/diagnostics/smartPatch");
          const merged = await applyJsonMergePatchSafe(
            Array.from(nextMap.entries()).map(([path, content]) => ({ path, content })),
            patch.jsonMerge,
          );
          nextMap.clear();
          for (const f of merged) nextMap.set(f.path, f.content);
        }

        const nextFiles: ProjectFile[] = Array.from(nextMap.entries()).map(([path, content]) => ({
          path,
          content,
        }));

        // Delete files first. If any delete fails we must NOT silently continue,
        // because updateProjectFiles is an UPSERT/merge — it won't remove files.
        // A swallowed error here causes projectRef vs projectData divergence.
        const deletePaths = (patch.delete ?? [])
          .map((p) => {
            const pv = validateFilePath(p);
            return pv.valid && pv.normalized ? pv.normalized : null;
          })
          .filter(Boolean) as string[];

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
      for (const p of last.createdPaths ?? []) await deleteFile(p);
      if (last.snapshot.length) await updateProjectFiles(last.snapshot);
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
                for (const p of entry.createdPaths ?? []) await deleteFile(p);
                if (entry.snapshot.length) await updateProjectFiles(entry.snapshot);
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
      if (!r.fix?.patch && !r.fix?.workflowDispatch) return;

      const { patchForApply, dispatch, doSync, steps } = buildIssueFixPlan({
        result: r,
        rerunAfterFix,
        shouldSyncPatch,
      });

      openFixModal({ title: "Fix", subtitle: r.title, steps });

      let cursor = 0;

      let patchApplied = false;
      const patchStep = await runApplyStep({
        enabled: !!patchForApply,
        stepIndex: cursor,
        runFixStep,
        apply: async () => {
          await applyPatch(r.title, patchForApply as PreflightPatch);
        },
        finishWithResult,
        failMessage: "Patch konnte nicht angewendet werden.",
      });
      if (!patchStep.ok) return;
      patchApplied = patchStep.applied;
      cursor = patchStep.nextIndex;

      if (dispatch) {
        const dispatchTarget = resolveWorkflowDispatchTarget({
          linkedRepo,
          linkedBranch,
          dispatchRef: dispatch.ref,
        });
        if (!dispatchTarget.ok) {
          const detail = dispatchTarget.detail;
          markFixStepFailed(cursor, detail, detail);
          finishWithResult({
            status: "blocked",
            detail,
            localChangeApplied: patchApplied,
            stepIndex: cursor,
          });
          return;
        }

        const dispatchStep = await runDispatchStep({
          enabled: true,
          stepIndex: cursor,
          runFixStep,
          dispatch: async () => {
            await dispatchWorkflowFix({
              owner: dispatchTarget.owner,
              repo: dispatchTarget.repo,
              workflowFileName: dispatch.workflowFileName,
              workflowRef: dispatchTarget.workflowRef,
              inputs: dispatch.inputs || {},
              fallbackPatch: dispatch.fallbackPatch,
            });
          },
          finishWithResult,
          localChangeApplied: patchApplied,
        });
        if (!dispatchStep.ok) return;
        cursor = dispatchStep.nextIndex;
      }

      const syncStep = await runSyncStep({
        enabled: !!(doSync && patchForApply),
        stepIndex: cursor,
        runFixStep,
        sync: () => syncPatchToGitHub(r.title, patchForApply as PreflightPatch),
        finishWithResult,
        localChangeApplied: patchApplied,
      });
      if (!syncStep.ok) return;
      cursor = syncStep.nextIndex;

      const verifyStep = await runVerifyStep({
        enabled: rerunAfterFix,
        stepIndex: cursor,
        runFixStep,
        verify: () => runDiagnostics({ resetSelection: false, resetHistory: false }),
        finishWithResult,
        localChangeApplied: patchApplied,
        workflowTriggered: !!dispatch,
      });
      if (!verifyStep.ok) return;
      cursor = verifyStep.nextIndex;

      finishWithResult(
        buildIssueFixSuccessResult({
          rerunAfterFix,
          hasDispatch: !!dispatch,
          patchApplied,
          stepsLength: steps.length,
        }),
      );
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
      if (!items.length) return;

      // --- Safety gate for batch runs ---
      // In batch mode it's easy to "silently" apply changes that touch CI / build plumbing.
      // We do one extra confirmation if any patch looks risky.
      const batch = collectBatchSafetyPatches(items);

      // --- Size/complexity guard ---
      // Even if paths are not "risky", very large patches can slow devices and raise regression risk.
      const limitSummary = summarizeBatchLimits(batch, DEFAULT_PATCH_LIMITS);
      if (limitSummary.hasHard) {
        const lines = limitSummary.hardLines.join("\n");
        Alert.alert(
          "Patch too large",
          `Mindestens ein Fix ist zu groß/komplex und wird aus Sicherheitsgründen blockiert.\n\n${lines}`,
        );
        return;
      }

      const riskSummary = summarizeBatchRisk(batch);
      if (riskSummary.hasRisk || limitSummary.hasSoft) {
        const proceed = await confirmWithAlert({
          title: "Risky batch fix",
          message: buildBatchRiskPromptMessage({
            hasRisk: riskSummary.hasRisk,
            shortPaths: riskSummary.shortPaths,
            more: riskSummary.more,
            softLines: limitSummary.hasSoft ? limitSummary.softLines : [],
          }),
        });
        if (!proceed) return;
      }

      const { deduped, steps, skipped } = buildBatchExecutionPlan({
        items,
        rerunAfterFix,
        shouldSyncPatch,
      });
      openFixModal({
        title: label,
        subtitle: formatBatchFixSubtitle(deduped.length, skipped),
        steps,
      });

      let cursor = 0;

      let appliedCount = 0;
      for (const { result, patch } of deduped) {
        const applyStep = await runApplyStep({
          enabled: true,
          stepIndex: cursor,
          runFixStep,
          apply: async () => {
            await applyPatch(result.title, patch);
          },
          finishWithResult,
          localChangeAppliedOnFailure: appliedCount > 0 || undefined,
        });
        if (!applyStep.ok) return;
        if (applyStep.applied) appliedCount++;
        cursor = applyStep.nextIndex;

        const syncStep = await runSyncStep({
          enabled: shouldSyncPatch(patch),
          stepIndex: cursor,
          runFixStep,
          sync: () => syncPatchToGitHub(result.title, patch),
          finishWithResult,
          localChangeApplied: appliedCount > 0,
        });
        if (!syncStep.ok) return;
        cursor = syncStep.nextIndex;
      }

      const verifyStep = await runVerifyStep({
        enabled: rerunAfterFix,
        stepIndex: cursor,
        runFixStep,
        verify: () => runDiagnostics({ resetSelection: false, resetHistory: false }),
        finishWithResult,
        localChangeApplied: appliedCount > 0,
      });
      if (!verifyStep.ok) return;

      finishWithResult({
        status: rerunAfterFix ? "pending_recheck" : "patch_applied",
        detail: formatBatchFixResultDetail(rerunAfterFix),
        localChangeApplied: appliedCount > 0,
        stepIndex: steps.length,
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
      if (!r.fix?.patch) return;

      // Note: TypeScript does not keep narrowing for r.fix across nested closures.
      // Capture once so we can safely reference inside callbacks.
      const patch = r.fix.patch as PreflightPatch;

      const sizeCheck = checkPatchLimits(patch, DEFAULT_PATCH_LIMITS);
      if (sizeCheck.hardFail) {
        Alert.alert(
          "Patch too large",
          "Dieser Fix ist zu groß/komplex und wird aus Sicherheitsgründen blockiert.\n\n" +
            sizeCheck.reasons.join("\n"),
        );
        return;
      }
      const sizeNote = sizeCheck.softWarn
        ? `\n\n⚠ Größe/Komplexität: ${sizeCheck.reasons.join(", ")}`
        : "";

      const canSyncRepo = !!parseOwnerRepo(linkedRepo);
      const syncWouldHelp = shouldSyncPatch(patch);

      const runOne = async (doSync: boolean) => {
        const { steps } = buildSingleFixPlan({ doSync, rerunAfterFix });

        openFixModal({ title: "Fix", subtitle: r.title, steps });

        const patchStep = await runApplyStep({
          enabled: true,
          stepIndex: 0,
          runFixStep,
          apply: async () => {
            await applyPatch(r.title, patch);
          },
          finishWithResult,
          failMessage: "Fehler",
        });
        if (!patchStep.ok) return;
        const patchApplied = patchStep.applied;

        let stepCursor = patchStep.nextIndex;
        const syncStep = await runSyncStep({
          enabled: doSync,
          stepIndex: stepCursor,
          runFixStep,
          sync: () => syncPatchToGitHub(r.title, patch),
          finishWithResult,
          localChangeApplied: patchApplied,
        });
        if (!syncStep.ok) return;
        stepCursor = syncStep.nextIndex;

        const verifyStep = await runVerifyStep({
          enabled: rerunAfterFix,
          stepIndex: stepCursor,
          runFixStep,
          verify: () => runDiagnostics({ resetSelection: false, resetHistory: false }),
          finishWithResult,
          localChangeApplied: patchApplied,
        });
        if (!verifyStep.ok) return;

        finishWithResult(
          buildSingleFixSuccessResult({
            rerunAfterFix,
            patchApplied,
            stepsLength: steps.length,
          }),
        );
      };

      Alert.alert(
        "Fix anwenden?",
        `${r.title}\n\n${safeTruncateText(r.message ?? "", 240)}${syncWouldHelp ? "\n\nHinweis: Dieser Fix betrifft Repo-Dateien → Sync macht Sinn." : ""}${sizeNote}`,
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
