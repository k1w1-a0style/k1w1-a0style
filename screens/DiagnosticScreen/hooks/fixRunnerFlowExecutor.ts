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
import { parseOwnerRepo } from "../../../lib/diagnostics/ciAutoFix";
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
import { resolveWorkflowDispatchTarget } from "./fixRunnerOrchestrationHelpers";
import {
  buildBatchExecutionPlan,
  collectBatchSafetyPatches,
} from "./fixRunnerBatchPlanHelpers";
import {
  buildBatchRiskPromptMessage,
  confirmWithAlert,
} from "./fixRunnerPromptHelpers";
import type { FixStep } from "../types";

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

  const patchStep = await runApplyStep({
    enabled: !!patchForApply,
    stepIndex: cursor,
    runFixStep,
    apply: async () => {
      await applyPatch(result.title, patchForApply as PreflightPatch);
    },
    finishWithResult,
    failMessage: "Patch konnte nicht angewendet werden.",
  });
  if (!patchStep.ok) return;
  const patchApplied = patchStep.applied;
  cursor = patchStep.nextIndex;

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

  const syncStep = await runSyncStep({
    enabled: !!(doSync && patchForApply),
    stepIndex: cursor,
    runFixStep,
    sync: () => syncPatchToGitHub(result.title, patchForApply as PreflightPatch),
    finishWithResult,
    localChangeApplied: patchApplied,
  });
  if (!syncStep.ok) return;
  cursor = syncStep.nextIndex;

  const verifyStep = await runVerifyStep({
    enabled: rerunAfterFix,
    stepIndex: cursor,
    runFixStep,
    verify: runDiagnostics,
    finishWithResult,
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

  const batch = collectBatchSafetyPatches(items);

  const limitSummary = summarizeBatchLimits(batch, DEFAULT_PATCH_LIMITS);
  if (limitSummary.hasHard) {
    const lines = limitSummary.hardLines.join("\n");
    params.onHardLimitBlock(
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
    verify: runDiagnostics,
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

  const patchStep = await runApplyStep({
    enabled: true,
    stepIndex: 0,
    runFixStep,
    apply: async () => {
      await applyPatch(result.title, patch);
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
    sync: () => syncPatchToGitHub(result.title, patch),
    finishWithResult,
    localChangeApplied: patchApplied,
  });
  if (!syncStep.ok) return;
  stepCursor = syncStep.nextIndex;

  const verifyStep = await runVerifyStep({
    enabled: rerunAfterFix,
    stepIndex: stepCursor,
    runFixStep,
    verify: runDiagnostics,
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
}

export function getSingleFixPromptMeta(params: {
  result: PreflightCheckResult;
  linkedRepo: string;
  shouldSyncPatch: (patch: PreflightPatch) => boolean;
}): {
  blockedReason: string | null;
  sizeNote: string;
  canSyncRepo: boolean;
  syncWouldHelp: boolean;
  patch: PreflightPatch | null;
} {
  const { result, linkedRepo, shouldSyncPatch } = params;
  if (!result.fix?.patch) {
    return {
      blockedReason: null,
      sizeNote: "",
      canSyncRepo: false,
      syncWouldHelp: false,
      patch: null,
    };
  }

  const patch = result.fix.patch as PreflightPatch;
  const sizeCheck = checkPatchLimits(patch, DEFAULT_PATCH_LIMITS);
  if (sizeCheck.hardFail) {
    return {
      blockedReason:
        "Dieser Fix ist zu groß/komplex und wird aus Sicherheitsgründen blockiert.\n\n" +
        sizeCheck.reasons.join("\n"),
      sizeNote: "",
      canSyncRepo: false,
      syncWouldHelp: false,
      patch: null,
    };
  }

  const sizeNote = sizeCheck.softWarn
    ? `\n\n⚠ Größe/Komplexität: ${sizeCheck.reasons.join(", ")}`
    : "";

  return {
    blockedReason: null,
    sizeNote,
    canSyncRepo: !!parseOwnerRepo(linkedRepo),
    syncWouldHelp: shouldSyncPatch(patch),
    patch,
  };
}

export function buildSingleFixPromptMessage(params: {
  result: PreflightCheckResult;
  syncWouldHelp: boolean;
  sizeNote: string;
}): string {
  const { result, syncWouldHelp, sizeNote } = params;
  return `${result.title}\n\n${safeTruncateText(result.message ?? "", 240)}${syncWouldHelp ? "\n\nHinweis: Dieser Fix betrifft Repo-Dateien → Sync macht Sinn." : ""}${sizeNote}`;
}

function markStepBlocked(params: {
  markFixStepFailed: MarkFixStepFailed;
  cursor: number;
  detail: string;
  finishWithResult: FinishWithResult;
  patchApplied: boolean;
}) {
  const { markFixStepFailed, cursor, detail, finishWithResult, patchApplied } = params;
  markFixStepFailed(cursor, detail, detail);
  finishWithResult({
    status: "blocked",
    detail,
    localChangeApplied: patchApplied,
    stepIndex: cursor,
  });
}
