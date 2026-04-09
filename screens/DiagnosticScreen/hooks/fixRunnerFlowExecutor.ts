import type {
  PreflightCheckResult,
  PreflightPatch,
} from "../../../lib/diagnostics/preflightTypes";
import { safeTruncateText } from "../../../lib/diagnostics/sanitize";
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
  runDispatchStep,
} from "./fixRunnerExecutionHelpers";
import { resolveWorkflowDispatchTarget } from "./fixRunnerOrchestrationHelpers";
import {
  buildBatchExecutionPlan,
} from "./fixRunnerBatchPlanHelpers";
import type { FixStep } from "../types";
import {
  markStepBlocked,
  runOptionalVerify,
  runPatchApplyAndSync,
} from "./fixRunnerFlowSharedSteps";
import { confirmBatchFixSafety, getSingleFixPromptMeta } from "./fixRunnerFlowExecutorHelpers";
export { getSingleFixPromptMeta } from "./fixRunnerFlowExecutorHelpers";

export const AUTOFIX_MAX = 50; // safety: don't apply endless chains

type RunFixStep = (
  params: {
    index: number;
    run: () => Promise<void>;
    failMessage: string;
  },
) => Promise<unknown | null>;

type FinishWithResult = (params: {
  status:
    | "advisory_only"
    | "patch_applicable"
    | "patch_applied"
    | "workflow_dispatched"
    | "blocked"
    | "failed"
    | "pending_recheck";
  detail?: string;
  localChangeApplied?: boolean;
  workflowTriggered?: boolean;
  partial?: boolean;
  stepIndex?: number;
}) => unknown;

type OpenFixModal = (params: {
  title: string;
  subtitle: string;
  steps: FixStep[];
}) => void;

type MarkFixStepFailed = (index: number, error: unknown, fallback: string) => void;

type DispatchWorkflowFix = (params: {
  owner: string;
  repo: string;
  workflowFileName: string;
  workflowRef: string;
  inputs: Record<string, string>;
  fallbackPatch?: PreflightPatch;
}) => Promise<void>;

type SharedFlowDeps = {
  rerunAfterFix: boolean;
  runFixStep: RunFixStep;
  finishWithResult: FinishWithResult;
  openFixModal: OpenFixModal;
  runDiagnostics: () => Promise<void>;
};

type PatchDeps = {
  applyPatch: (label: string, patch: PreflightPatch) => Promise<unknown>;
  shouldSyncPatch: (patch: PreflightPatch) => boolean;
  syncPatchToGitHub: (label: string, patch: PreflightPatch) => Promise<void>;
};

export async function executeIssueFixFlow(params: {
  result: PreflightCheckResult;
  linkedRepo: string;
  linkedBranch?: string;
  dispatchWorkflowFix: DispatchWorkflowFix;
  markFixStepFailed: MarkFixStepFailed;
} & SharedFlowDeps & PatchDeps): Promise<void> {
  const {
    result,
    rerunAfterFix,
    shouldSyncPatch,
    openFixModal,
    runFixStep,
    finishWithResult,
    applyPatch,
    dispatchWorkflowFix,
    linkedRepo,
    linkedBranch,
    syncPatchToGitHub,
    runDiagnostics,
  } = params;

  if (!result.fix?.patch && !result.fix?.workflowDispatch) return;

  const { patchForApply, dispatch, doSync, steps } = buildIssueFixPlan({
    result,
    rerunAfterFix,
    shouldSyncPatch,
  });

  openFixModal({ title: "Fix", subtitle: result.title, steps });

  let cursor = 0;

  let patchApplied = false;
  if (patchForApply) {
    const patchStep = await runPatchApplyAndSync({
      stepIndex: cursor,
      runFixStep,
      finishWithResult,
      label: result.title,
      patch: patchForApply as PreflightPatch,
      applyPatch,
      shouldSync: false,
      syncPatchToGitHub,
      failMessage: "Patch konnte nicht angewendet werden.",
    });
    if (!patchStep.ok) return;
    patchApplied = patchStep.patchApplied;
    cursor = patchStep.nextIndex;
  }

  if (dispatch) {
    const dispatchTarget = resolveWorkflowDispatchTarget({
      linkedRepo,
      linkedBranch,
      dispatchRef: dispatch.ref,
    });
    if (!dispatchTarget.ok) {
      const detail = dispatchTarget.detail;
      markStepBlocked({
        markFixStepFailed: params.markFixStepFailed,
        cursor,
        detail,
        finishWithResult,
        patchApplied,
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

  if (doSync && patchForApply) {
    const syncStep = await runPatchApplyAndSync({
      stepIndex: cursor,
      runFixStep,
      finishWithResult,
      label: result.title,
      patch: patchForApply as PreflightPatch,
      applyPatch: async () => undefined,
      applyEnabled: false,
      shouldSync: true,
      syncPatchToGitHub,
    });
    if (!syncStep.ok) return;
    cursor = syncStep.nextIndex;
  }

  const verifyStep = await runOptionalVerify({
    enabled: rerunAfterFix,
    stepIndex: cursor,
    runFixStep,
    finishWithResult,
    runDiagnostics,
    localChangeApplied: patchApplied,
    workflowTriggered: !!dispatch,
  });
  if (!verifyStep.ok) return;

  finishWithResult(
    buildIssueFixSuccessResult({
      rerunAfterFix,
      hasDispatch: !!dispatch,
      patchApplied,
      stepsLength: steps.length,
    }),
  );
}

export async function executeBatchFixFlow(params: {
  items: PreflightCheckResult[];
  label: string;
  onHardLimitBlock: (message: string) => void;
} & SharedFlowDeps & PatchDeps): Promise<void> {
  const {
    items,
    label,
    rerunAfterFix,
    shouldSyncPatch,
    openFixModal,
    runFixStep,
    finishWithResult,
    applyPatch,
    syncPatchToGitHub,
    runDiagnostics,
  } = params;
  if (!items.length) return;

  const safetyConfirmed = await confirmBatchFixSafety({
    items,
    onHardLimitBlock: params.onHardLimitBlock,
  });
  if (!safetyConfirmed) return;

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
    const patchStep = await runPatchApplyAndSync({
      stepIndex: cursor,
      runFixStep,
      finishWithResult,
      label: result.title,
      patch,
      applyPatch,
      shouldSync: shouldSyncPatch(patch),
      syncPatchToGitHub,
      localChangeAppliedOnFailure: appliedCount > 0 || undefined,
    });
    if (!patchStep.ok) return;
    if (patchStep.patchApplied) appliedCount++;
    cursor = patchStep.nextIndex;
  }

  const verifyStep = await runOptionalVerify({
    enabled: rerunAfterFix,
    stepIndex: cursor,
    runFixStep,
    finishWithResult,
    runDiagnostics,
    localChangeApplied: appliedCount > 0,
  });
  if (!verifyStep.ok) return;

  finishWithResult({
    status: rerunAfterFix ? "pending_recheck" : "patch_applied",
    detail: formatBatchFixResultDetail(rerunAfterFix),
    localChangeApplied: appliedCount > 0,
    stepIndex: steps.length,
  });
}

export async function executeSingleFixFlow(params: {
  result: PreflightCheckResult;
  doSync: boolean;
} & SharedFlowDeps & Pick<PatchDeps, "applyPatch" | "syncPatchToGitHub">): Promise<void> {
  const {
    result,
    doSync,
    rerunAfterFix,
    openFixModal,
    runFixStep,
    finishWithResult,
    applyPatch,
    syncPatchToGitHub,
    runDiagnostics,
  } = params;

  if (!result.fix?.patch) return;
  const patch = result.fix.patch as PreflightPatch;

  const { steps } = buildSingleFixPlan({ doSync, rerunAfterFix });
  openFixModal({ title: "Fix", subtitle: result.title, steps });

  const patchStep = await runPatchApplyAndSync({
    stepIndex: 0,
    runFixStep,
    finishWithResult,
    label: result.title,
    patch,
    applyPatch,
    shouldSync: false,
    syncPatchToGitHub,
    failMessage: "Fehler",
  });
  if (!patchStep.ok) return;
  const patchApplied = patchStep.patchApplied;

  let stepCursor = patchStep.nextIndex;
  if (doSync) {
    const syncStep = await runPatchApplyAndSync({
      stepIndex: stepCursor,
      runFixStep,
      finishWithResult,
      label: result.title,
      patch,
      applyPatch: async () => undefined,
      applyEnabled: false,
      shouldSync: true,
      syncPatchToGitHub,
    });
    if (!syncStep.ok) return;
    stepCursor = syncStep.nextIndex;
  }

  const verifyStep = await runOptionalVerify({
    enabled: rerunAfterFix,
    stepIndex: stepCursor,
    runFixStep,
    finishWithResult,
    runDiagnostics,
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
}

export function buildSingleFixPromptMessage(params: {
  result: PreflightCheckResult;
  syncWouldHelp: boolean;
  sizeNote: string;
}): string {
  const { result, syncWouldHelp, sizeNote } = params;
  return `${result.title}\n\n${safeTruncateText(result.message ?? "", 240)}${syncWouldHelp ? "\n\nHinweis: Dieser Fix betrifft Repo-Dateien → Sync macht Sinn." : ""}${sizeNote}`;
}
