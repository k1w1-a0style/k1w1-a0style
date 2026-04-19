import type {
  PreflightCheckResult,
  PreflightPatch,
} from "../../../lib/diagnostics/preflightTypes";
import {
  buildIssueFixPlan,
  buildIssueFixSuccessResult,
} from "./fixRunnerFlowPlanHelpers";
import {
  runDispatchStep,
} from "./fixRunnerExecutionHelpers";
import { resolveWorkflowDispatchTarget } from "./fixRunnerOrchestrationHelpers";
import type { SharedFlowDeps, PatchDeps } from "./fixRunnerFlowExecutor.shared";
import {
  markStepBlocked,
  runOptionalVerify,
  runPatchApplyAndSync,
} from "./fixRunnerFlowSharedSteps";
import { getSingleFixPromptMeta } from "./fixRunnerFlowExecutorHelpers";
import { executeBatchFixFlow } from "./fixRunnerBatchFlowExecutor";
import { executeSingleFixFlow, buildSingleFixPromptMessage } from "./fixRunnerSingleFlowExecutor";
export { getSingleFixPromptMeta, executeBatchFixFlow, executeSingleFixFlow, buildSingleFixPromptMessage };

export const AUTOFIX_MAX = 50; // safety: don't apply endless chains

type MarkFixStepFailed = (index: number, error: unknown, fallback: string) => void;

type DispatchWorkflowFix = (params: {
  owner: string;
  repo: string;
  workflowFileName: string;
  workflowRef: string;
  inputs: Record<string, string>;
  fallbackPatch?: PreflightPatch;
}) => Promise<void>;

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

