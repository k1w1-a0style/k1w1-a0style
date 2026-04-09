import type { PreflightCheckResult } from "../../../lib/diagnostics/preflightTypes";
import { formatBatchFixResultDetail, formatBatchFixSubtitle } from "./fixRunnerDisplayHelpers";
import { buildBatchExecutionPlan } from "./fixRunnerBatchPlanHelpers";
import { runOptionalVerify, runPatchApplyAndSync } from "./fixRunnerFlowSharedSteps";
import { confirmBatchFixSafety } from "./fixRunnerFlowExecutorHelpers";
import type { PatchDeps, SharedFlowDeps } from "./fixRunnerFlowExecutor.shared";

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
