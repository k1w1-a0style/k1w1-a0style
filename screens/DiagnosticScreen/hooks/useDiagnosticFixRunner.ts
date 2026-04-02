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
  patchFingerprint,
  summarizeBatchLimits,
  summarizeBatchRisk,
} from "../../../lib/diagnostics/fixSafety";
import { markRepoSyncSignature } from "../../../lib/repoSyncOrchestration";
import { validateFileContent, validateFilePath } from "../../../lib/validators";
import { createOrUpdateFile, deleteRepoFile, triggerWorkflow } from "../../../infra/github/githubService";
import { parseOwnerRepo } from "../../../lib/diagnostics/ciAutoFix";
import {
  DiagnosticFixApplyError,
  getDiagnosticFixExecutionResult,
} from "../../../lib/diagnostics/fixResultContract";
import { findOwnershipViolations } from "../../../lib/projectOwnership";
import {
  buildBatchFixSteps,
  buildIssueFixSteps,
  buildSingleFixSteps,
  setStepStatusAtIndex,
} from "./fixRunnerHelpers";
import {
  buildApplyFailureResult,
  buildFailedStepPatch,
  getErrorMessage,
} from "./fixRunnerResultHelpers";
import {
  formatBatchFixResultDetail,
  formatBatchFixSubtitle,
  formatIssueFixResultDetail,
  formatSingleFixResultDetail,
} from "./fixRunnerDisplayHelpers";
import {
  buildFixPreviewEntries,
  collectDeletedPatchPaths,
  collectPatchTouchedPaths,
  sameProjectFiles,
  shouldSyncPatchToGitHub,
} from "./useDiagnosticFixRunnerHelpers";

import type {
  FixHistoryEntry,
  FixStep,
  Status,
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

  const [fixModalVisible, setFixModalVisible] = useState(false);
  const [fixModalTitle, setFixModalTitle] = useState("AutoFix");
  const [fixModalSubtitle, setFixModalSubtitle] = useState<string | undefined>(
    undefined,
  );
  const [fixSteps, setFixSteps] = useState<FixStep[]>([]);
  const [fixStepIndex, setFixStepIndex] = useState(0);
  const [fixDone, setFixDone] = useState(false);

  const finishWithResult = useCallback(
    (params: {
      status: "advisory_only" | "patch_applicable" | "patch_applied" | "workflow_dispatched" | "blocked" | "failed" | "pending_recheck";
      detail?: string;
      localChangeApplied?: boolean;
      workflowTriggered?: boolean;
      partial?: boolean;
      stepIndex?: number;
    }) => {
      const result = getDiagnosticFixExecutionResult(params);
      setFixDone(true);
      if (typeof params.stepIndex === "number") {
        setFixStepIndex(params.stepIndex);
      }
      toast?.show?.(result.summary);
      return result;
    },
    [toast],
  );

  const closeFixModal = useCallback(() => {
    if (!fixDone) return; // only closable when done
    setFixModalVisible(false);
  }, [fixDone]);

  const markFixStepRunning = useCallback((index: number) => {
    setFixStepIndex(index);
    setFixSteps((prev) => setStepStatusAtIndex(prev, index, { status: "running" }));
  }, []);

  const markFixStepDone = useCallback((index: number) => {
    setFixSteps((prev) => setStepStatusAtIndex(prev, index, { status: "done" }));
  }, []);

  const markFixStepFailed = useCallback(
    (index: number, error: unknown, fallback: string) => {
      setFixSteps((prev) =>
        setStepStatusAtIndex(prev, index, buildFailedStepPatch(error, fallback)),
      );
    },
    [],
  );

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

      const patchForApply = r.fix?.patch;
      const dispatch = r.fix?.workflowDispatch;
      const doSync = patchForApply ? shouldSyncPatch(patchForApply) : false;

      const steps = buildIssueFixSteps({
        hasPatch: !!patchForApply,
        hasDispatch: !!dispatch,
        doSync,
        rerunAfterFix,
      });

      setFixModalTitle("Fix");
      setFixModalSubtitle(r.title);
      setFixSteps(steps);
      setFixStepIndex(0);
      setFixDone(false);
      setFixModalVisible(true);

      let cursor = 0;
      const runStep = async (fn: () => Promise<void>, failMsg: string) => {
        markFixStepRunning(cursor);
        try {
          await fn();
          markFixStepDone(cursor);
          cursor++;
          return null;
        } catch (error: unknown) {
          markFixStepFailed(cursor, error, failMsg);
          setFixDone(true);
          return error;
        }
      };

      let patchApplied = false;
      if (patchForApply) {
        const stepError = await runStep(async () => {
          await applyPatch(r.title, patchForApply);
          patchApplied = true;
        }, "Fehler");
        if (stepError) {
          finishWithResult(
            buildApplyFailureResult({
              error: stepError,
              fallback: "Patch konnte nicht angewendet werden.",
              stepIndex: cursor,
            }),
          );
          return;
        }
      }

      if (dispatch) {
        const parsed = parseOwnerRepo(linkedRepo);
        if (!parsed) {
          finishWithResult({
            status: "blocked",
            detail: "Workflow-Fix ist ohne verknüpftes Repo nicht anwendbar.",
            localChangeApplied: patchApplied,
            stepIndex: cursor,
          });
          return;
        }
        const workflowRef = (dispatch.ref || linkedBranch || "").trim();
        if (!workflowRef) {
          const detail = "Workflow-Fix ist ohne verknüpften Branch nicht anwendbar.";
          markFixStepFailed(cursor, detail, detail);
          finishWithResult({
            status: "blocked",
            detail,
            localChangeApplied: patchApplied,
            stepIndex: cursor,
          });
          return;
        }

        const stepError = await runStep(async () => {
          try {
            await triggerWorkflow(
              parsed.owner,
              parsed.repo,
              dispatch.workflowFileName,
              workflowRef,
              dispatch.inputs || {},
            );
          } catch (error: unknown) {
            const msg = getErrorMessage(error, "");
            if (/404|not found/i.test(msg) && dispatch.fallbackPatch) {
              await applyPatch(`Bootstrap ${dispatch.workflowFileName}`, dispatch.fallbackPatch);
              await triggerWorkflow(
                parsed.owner,
                parsed.repo,
                dispatch.workflowFileName,
                workflowRef,
                dispatch.inputs || {},
              );
              return;
            }
            throw error;
          }
        }, "Workflow dispatch fehlgeschlagen");
        if (stepError) {
          finishWithResult({
            status: "failed",
            detail: getErrorMessage(stepError, "Workflow dispatch fehlgeschlagen"),
            localChangeApplied: patchApplied,
            workflowTriggered: false,
            partial: patchApplied,
            stepIndex: cursor,
          });
          return;
        }
      }

      if (doSync && patchForApply) {
        const stepError = await runStep(
          () => syncPatchToGitHub(r.title, patchForApply),
          "Sync fehlgeschlagen",
        );
        if (stepError) {
          finishWithResult({
            status: "failed",
            detail: getErrorMessage(stepError, "Sync fehlgeschlagen"),
            localChangeApplied: patchApplied,
            partial: patchApplied,
            stepIndex: cursor,
          });
          return;
        }
      }

      if (rerunAfterFix) {
        const stepError = await runStep(
          () => runDiagnostics({ resetSelection: false, resetHistory: false }),
          "Verify fehlgeschlagen",
        );
        if (stepError) {
          finishWithResult({
            status: "pending_recheck",
            detail: getErrorMessage(stepError, "Verify fehlgeschlagen"),
            localChangeApplied: patchApplied,
            workflowTriggered: !!dispatch,
            stepIndex: cursor,
          });
          return;
        }
      }

      finishWithResult({
        status:
          rerunAfterFix || !!dispatch
            ? "pending_recheck"
            : patchApplied
              ? "patch_applied"
              : "workflow_dispatched",
        detail: formatIssueFixResultDetail({
          hasDispatch: !!dispatch,
          patchApplied,
          rerunAfterFix,
        }),
        localChangeApplied: patchApplied,
        workflowTriggered: !!dispatch,
        stepIndex: steps.length,
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
      if (!items.length) return;

      // --- Safety gate for batch runs ---
      // In batch mode it's easy to "silently" apply changes that touch CI / build plumbing.
      // We do one extra confirmation if any patch looks risky.
      const batch = items
        .filter((r) => !!r.fix?.patch)
        .map((r) => ({ title: r.title, patch: r.fix!.patch as PreflightPatch }));

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
        const softNote = limitSummary.hasSoft
          ? `\n\nGroße Fixes (Bestätigung nötig):\n${limitSummary.softLines.join("\n")}`
          : "";
        const proceed = await new Promise<boolean>((resolve) => {
          const header = riskSummary.hasRisk
            ? "Einige Fixes betreffen CI/Build/Infra Dateien."
            : "Einige Fixes sind sehr groß/komplex.";
          const pathsBlock = riskSummary.hasRisk
            ? `\n\nBetroffene Pfade:\n- ${riskSummary.shortPaths.join("\n- ")}${riskSummary.more}`
            : "";
          Alert.alert(
            "Risky batch fix",
            `${header}${pathsBlock}${softNote}\n\nWillst du wirklich fortfahren?`,
            [
              { text: "Abbrechen", style: "cancel", onPress: () => resolve(false) },
              { text: "Weiter", onPress: () => resolve(true) },
            ],
          );
        });
        if (!proceed) return;
      }

      // De-dup patches in batch mode: prevents repeated apply of identical patch sets.
      const seen = new Set<string>();
      const deduped: Array<{ r: PreflightCheckResult; patch: PreflightPatch }> = [];
      for (const r of items) {
        if (!r.fix?.patch) continue;
        const patch = r.fix.patch as PreflightPatch;
        const fp = patchFingerprint(patch);
        if (seen.has(fp)) continue;
        seen.add(fp);
        deduped.push({ r, patch });
      }

      const steps = buildBatchFixSteps(
        deduped.map(({ r, patch }) => ({ id: r.id, title: r.title, doSync: shouldSyncPatch(patch) })),
        rerunAfterFix,
      );

      const skipped = Math.max(0, items.filter((r) => !!r.fix?.patch).length - deduped.length);
      setFixModalTitle(label);
      setFixModalSubtitle(formatBatchFixSubtitle(deduped.length, skipped));
      setFixSteps(steps);
      setFixStepIndex(0);
      setFixDone(false);
      setFixModalVisible(true);

      let cursor = 0;
      const mark = (idx: number, patch: Partial<FixStep>) => {
        setFixSteps((prev) => setStepStatusAtIndex(prev, idx, patch));
      };

      let appliedCount = 0;
      for (const { r, patch } of deduped) {
        setFixStepIndex(cursor);
        mark(cursor, { status: "running" });
        try {
          await applyPatch(r.title, patch);
          mark(cursor, { status: "done" });
          appliedCount++;
        } catch (error: unknown) {
          const message = getErrorMessage(error, "Apply fehlgeschlagen");
          mark(cursor, buildFailedStepPatch(error, "Apply fehlgeschlagen"));
          finishWithResult(
            buildApplyFailureResult({
              error,
              fallback: "Apply fehlgeschlagen",
              stepIndex: cursor,
              localChangeApplied: appliedCount > 0 || undefined,
              partial: appliedCount > 0 || undefined,
            }),
          );
          return;
        }
        cursor++;

        if (shouldSyncPatch(patch)) {
          setFixStepIndex(cursor);
          mark(cursor, { status: "running" });
          try {
            await syncPatchToGitHub(r.title, patch);
            mark(cursor, { status: "done" });
          } catch (error: unknown) {
            const message = getErrorMessage(error, "Sync fehlgeschlagen");
            mark(cursor, buildFailedStepPatch(error, "Sync fehlgeschlagen"));
            finishWithResult({
              status: "failed",
              detail: message,
              localChangeApplied: appliedCount > 0,
              partial: appliedCount > 0,
              stepIndex: cursor,
            });
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
        } catch (error: unknown) {
          const message = getErrorMessage(error, "Verify fehlgeschlagen");
          mark(cursor, buildFailedStepPatch(error, "Verify fehlgeschlagen"));
          finishWithResult({
            status: "pending_recheck",
            detail: message,
            localChangeApplied: appliedCount > 0,
            partial: false,
            stepIndex: cursor,
          });
          return;
        }
      }

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

  const applySelected = useCallback(async () => {
    if (!projectRef.current) return;
    if (applyBusyRef.current) return;

    const chosenAll = sortedResults.filter((r) => selected[r.id] && r.fix?.patch);
    if (!chosenAll.length) {
      Alert.alert("Nichts ausgewählt", "Bitte wähle Fixes aus.");
      return;
    }

    if (chosenAll.length > AUTOFIX_MAX) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Zu viele Fixes",
          `Es sind ${chosenAll.length} Fixes ausgewählt, aber maximal ${AUTOFIX_MAX} können auf einmal angewendet werden.\n\nTipp: Nutze Filter (z.B. fail-only), oder führe AutoFix mehrfach aus.`,
          [
            { text: "Abbrechen", style: "cancel", onPress: () => resolve(false) },
            { text: `Weiter (${AUTOFIX_MAX}/${chosenAll.length})`, onPress: () => resolve(true) },
          ],
        );
      });
      if (!proceed) return;
    }

    const chosen = chosenAll.slice(0, AUTOFIX_MAX);
    await applyFixList(chosen, "Fix Selected");
  }, [applyFixList, projectRef, selected, sortedResults]);

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
      `Es werden ${slice.length} Fix(es) automatisch angewendet.\nScope: ${autoFixScope}\nIncludes warnings: ${autoFixIncludeWarn ? "ja" : "nein"}\n\nTipp: Mit „Re-Run“ nach dem Fix wird automatisch gegengecheckt.`,
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
        const steps = buildSingleFixSteps({ doSync, rerunAfterFix });

        setFixModalTitle("Fix");
        setFixModalSubtitle(r.title);
        setFixSteps(steps);
        setFixStepIndex(0);
        setFixDone(false);
        setFixModalVisible(true);

        markFixStepRunning(0);
        let patchApplied = false;
        try {
          await applyPatch(r.title, patch);
          patchApplied = true;
          markFixStepDone(0);
        } catch (error: unknown) {
          markFixStepFailed(0, error, "Fehler");
          finishWithResult(
            buildApplyFailureResult({
              error,
              fallback: "Fehler",
              stepIndex: 0,
            }),
          );
          return;
        }

        let stepCursor = 1;
        if (doSync) {
          markFixStepRunning(stepCursor);
          try {
            await syncPatchToGitHub(r.title, patch);
            markFixStepDone(stepCursor);
          } catch (error: unknown) {
            const message = getErrorMessage(error, "Sync fehlgeschlagen");
            markFixStepFailed(stepCursor, error, "Sync fehlgeschlagen");
            finishWithResult({
              status: "failed",
              detail: message,
              localChangeApplied: patchApplied,
              partial: patchApplied,
              stepIndex: stepCursor,
            });
            return;
          }
          stepCursor++;
        }

        if (rerunAfterFix) {
          markFixStepRunning(stepCursor);
          try {
            await runDiagnostics({ resetSelection: false, resetHistory: false });
            markFixStepDone(stepCursor);
          } catch (error: unknown) {
            const message = getErrorMessage(error, "Verify fehlgeschlagen");
            markFixStepFailed(stepCursor, error, "Verify fehlgeschlagen");
            finishWithResult({
              status: "pending_recheck",
              detail: message,
              localChangeApplied: patchApplied,
              stepIndex: stepCursor,
            });
            return;
          }
        }

        finishWithResult({
          status: rerunAfterFix ? "pending_recheck" : "patch_applied",
          detail: formatSingleFixResultDetail(rerunAfterFix),
          localChangeApplied: patchApplied,
          stepIndex: steps.length,
        });
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
