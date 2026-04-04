import { getErrorMessage } from "./fixRunnerResultHelpers";
import { buildApplyFailureResult } from "./fixRunnerResultHelpers";

type RunFixStep = (params: {
  index: number;
  run: () => Promise<void>;
  failMessage: string;
}) => Promise<unknown | null>;

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

export const runSyncStep = async (params: {
  enabled: boolean;
  stepIndex: number;
  runFixStep: RunFixStep;
  sync: () => Promise<void>;
  finishWithResult: FinishWithResult;
  localChangeApplied: boolean;
  partial?: boolean;
  failMessage?: string;
}): Promise<{ ok: boolean; nextIndex: number }> => {
  if (!params.enabled) return { ok: true, nextIndex: params.stepIndex };

  const failMessage = params.failMessage ?? "Sync fehlgeschlagen";
  const syncError = await params.runFixStep({
    index: params.stepIndex,
    run: params.sync,
    failMessage,
  });
  if (syncError) {
    params.finishWithResult({
      status: "failed",
      detail: getErrorMessage(syncError, failMessage),
      localChangeApplied: params.localChangeApplied,
      partial: params.partial ?? params.localChangeApplied,
      stepIndex: params.stepIndex,
    });
    return { ok: false, nextIndex: params.stepIndex };
  }

  return { ok: true, nextIndex: params.stepIndex + 1 };
};

export const runApplyStep = async (params: {
  enabled: boolean;
  stepIndex: number;
  runFixStep: RunFixStep;
  apply: () => Promise<void>;
  finishWithResult: FinishWithResult;
  failMessage?: string;
  localChangeAppliedOnFailure?: boolean;
}): Promise<{ ok: boolean; nextIndex: number; applied: boolean }> => {
  if (!params.enabled) return { ok: true, nextIndex: params.stepIndex, applied: false };

  const failMessage = params.failMessage ?? "Apply fehlgeschlagen";
  const applyError = await params.runFixStep({
    index: params.stepIndex,
    run: params.apply,
    failMessage,
  });
  if (applyError) {
    params.finishWithResult(
      buildApplyFailureResult({
        error: applyError,
        fallback: failMessage,
        stepIndex: params.stepIndex,
        localChangeApplied: params.localChangeAppliedOnFailure,
        partial: params.localChangeAppliedOnFailure,
      }),
    );
    return { ok: false, nextIndex: params.stepIndex, applied: false };
  }

  return { ok: true, nextIndex: params.stepIndex + 1, applied: true };
};

export const runDispatchStep = async (params: {
  enabled: boolean;
  stepIndex: number;
  runFixStep: RunFixStep;
  dispatch: () => Promise<void>;
  finishWithResult: FinishWithResult;
  localChangeApplied: boolean;
  failMessage?: string;
}): Promise<{ ok: boolean; nextIndex: number }> => {
  if (!params.enabled) return { ok: true, nextIndex: params.stepIndex };

  const failMessage = params.failMessage ?? "Workflow dispatch fehlgeschlagen";
  const dispatchError = await params.runFixStep({
    index: params.stepIndex,
    run: params.dispatch,
    failMessage,
  });
  if (dispatchError) {
    params.finishWithResult({
      status: "failed",
      detail: getErrorMessage(dispatchError, failMessage),
      localChangeApplied: params.localChangeApplied,
      workflowTriggered: false,
      partial: params.localChangeApplied,
      stepIndex: params.stepIndex,
    });
    return { ok: false, nextIndex: params.stepIndex };
  }

  return { ok: true, nextIndex: params.stepIndex + 1 };
};

export const runVerifyStep = async (params: {
  enabled: boolean;
  stepIndex: number;
  runFixStep: RunFixStep;
  verify: () => Promise<void>;
  finishWithResult: FinishWithResult;
  localChangeApplied: boolean;
  workflowTriggered?: boolean;
  failMessage?: string;
}): Promise<{ ok: boolean; nextIndex: number }> => {
  if (!params.enabled) return { ok: true, nextIndex: params.stepIndex };

  const failMessage = params.failMessage ?? "Verify fehlgeschlagen";
  const verifyError = await params.runFixStep({
    index: params.stepIndex,
    run: params.verify,
    failMessage,
  });
  if (verifyError) {
    params.finishWithResult({
      status: "pending_recheck",
      detail: getErrorMessage(verifyError, failMessage),
      localChangeApplied: params.localChangeApplied,
      workflowTriggered: params.workflowTriggered,
      stepIndex: params.stepIndex,
    });
    return { ok: false, nextIndex: params.stepIndex };
  }

  return { ok: true, nextIndex: params.stepIndex + 1 };
};
