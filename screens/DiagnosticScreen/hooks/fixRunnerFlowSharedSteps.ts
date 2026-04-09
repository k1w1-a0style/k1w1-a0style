import type { PreflightPatch } from "../../../lib/diagnostics/preflightTypes";
import { runApplyStep, runSyncStep, runVerifyStep } from "./fixRunnerExecutionHelpers";

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

export const runPatchApplyAndSync = async (params: {
  stepIndex: number;
  runFixStep: RunFixStep;
  finishWithResult: FinishWithResult;
  label: string;
  patch: PreflightPatch;
  applyPatch: (label: string, patch: PreflightPatch) => Promise<unknown>;
  applyEnabled?: boolean;
  shouldSync: boolean;
  syncPatchToGitHub: (label: string, patch: PreflightPatch) => Promise<void>;
  localChangeAppliedOnFailure?: boolean;
  failMessage?: string;
}): Promise<{ ok: boolean; nextIndex: number; patchApplied: boolean }> => {
  const applyEnabled = params.applyEnabled ?? true;
  const applyStep = await runApplyStep({
    enabled: applyEnabled,
    stepIndex: params.stepIndex,
    runFixStep: params.runFixStep,
    apply: async () => {
      await params.applyPatch(params.label, params.patch);
    },
    finishWithResult: params.finishWithResult,
    localChangeAppliedOnFailure: applyEnabled ? params.localChangeAppliedOnFailure : undefined,
    failMessage: params.failMessage,
  });
  if (!applyStep.ok) {
    return { ok: false, nextIndex: params.stepIndex, patchApplied: false };
  }

  const syncStep = await runSyncStep({
    enabled: params.shouldSync,
    stepIndex: applyStep.nextIndex,
    runFixStep: params.runFixStep,
    sync: () => params.syncPatchToGitHub(params.label, params.patch),
    finishWithResult: params.finishWithResult,
    localChangeApplied: applyStep.applied,
  });
  if (!syncStep.ok) {
    return { ok: false, nextIndex: applyStep.nextIndex, patchApplied: applyStep.applied };
  }

  return {
    ok: true,
    nextIndex: syncStep.nextIndex,
    patchApplied: applyStep.applied,
  };
};

export const runOptionalVerify = async (params: {
  enabled: boolean;
  stepIndex: number;
  runFixStep: RunFixStep;
  finishWithResult: FinishWithResult;
  runDiagnostics: () => Promise<void>;
  localChangeApplied: boolean;
  workflowTriggered?: boolean;
}): Promise<{ ok: boolean; nextIndex: number }> => {
  const verifyStep = await runVerifyStep({
    enabled: params.enabled,
    stepIndex: params.stepIndex,
    runFixStep: params.runFixStep,
    verify: params.runDiagnostics,
    finishWithResult: params.finishWithResult,
    localChangeApplied: params.localChangeApplied,
    workflowTriggered: params.workflowTriggered,
  });
  if (!verifyStep.ok) {
    return { ok: false, nextIndex: params.stepIndex };
  }

  return { ok: true, nextIndex: verifyStep.nextIndex };
};

export function markStepBlocked(params: {
  markFixStepFailed: (index: number, error: unknown, fallback: string) => void;
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
