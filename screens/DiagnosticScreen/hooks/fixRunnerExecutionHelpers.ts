import { getErrorMessage } from "./fixRunnerResultHelpers";

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
