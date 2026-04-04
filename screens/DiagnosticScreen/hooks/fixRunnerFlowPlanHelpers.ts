import type { PreflightCheckResult, PreflightPatch } from "../../../lib/diagnostics/preflightTypes";
import { buildIssueFixSteps, buildSingleFixSteps } from "./fixRunnerHelpers";
import { formatIssueFixResultDetail, formatSingleFixResultDetail } from "./fixRunnerDisplayHelpers";

export const buildIssueFixPlan = (params: {
  result: PreflightCheckResult;
  rerunAfterFix: boolean;
  shouldSyncPatch: (patch: PreflightPatch) => boolean;
}) => {
  const patchForApply = params.result.fix?.patch;
  const dispatch = params.result.fix?.workflowDispatch;
  const doSync = patchForApply ? params.shouldSyncPatch(patchForApply) : false;
  const steps = buildIssueFixSteps({
    hasPatch: !!patchForApply,
    hasDispatch: !!dispatch,
    doSync,
    rerunAfterFix: params.rerunAfterFix,
  });
  return { patchForApply, dispatch, doSync, steps };
};

export const buildIssueFixSuccessResult = (params: {
  rerunAfterFix: boolean;
  hasDispatch: boolean;
  patchApplied: boolean;
  stepsLength: number;
}) => ({
  status: params.rerunAfterFix || params.hasDispatch
    ? "pending_recheck"
    : params.patchApplied
      ? "patch_applied"
      : "workflow_dispatched",
  detail: formatIssueFixResultDetail({
    hasDispatch: params.hasDispatch,
    patchApplied: params.patchApplied,
    rerunAfterFix: params.rerunAfterFix,
  }),
  localChangeApplied: params.patchApplied,
  workflowTriggered: params.hasDispatch,
  stepIndex: params.stepsLength,
} as const);

export const buildSingleFixPlan = (params: {
  doSync: boolean;
  rerunAfterFix: boolean;
}) => ({
  steps: buildSingleFixSteps({
    doSync: params.doSync,
    rerunAfterFix: params.rerunAfterFix,
  }),
});

export const buildSingleFixSuccessResult = (params: {
  rerunAfterFix: boolean;
  patchApplied: boolean;
  stepsLength: number;
}) => ({
  status: params.rerunAfterFix ? "pending_recheck" : "patch_applied",
  detail: formatSingleFixResultDetail(params.rerunAfterFix),
  localChangeApplied: params.patchApplied,
  stepIndex: params.stepsLength,
} as const);
