import type { PreflightCheckResult, PreflightPatch } from "../../../lib/diagnostics/preflightTypes";
import { buildBatchFixSteps } from "./fixRunnerHelpers";
import { dedupePatchCandidates } from "./fixRunnerOrchestrationHelpers";

export type BatchPatchItem = {
  result: PreflightCheckResult;
  patch: PreflightPatch;
};

export const collectBatchPatchItems = (items: PreflightCheckResult[]): BatchPatchItem[] =>
  items
    .filter((r): r is PreflightCheckResult & { fix: { patch: PreflightPatch } } => !!r.fix?.patch)
    .map((r) => ({ result: r, patch: r.fix.patch }));

export const collectBatchSafetyPatches = (items: PreflightCheckResult[]) =>
  collectBatchPatchItems(items).map(({ result, patch }) => ({ title: result.title, patch }));

export const buildBatchExecutionPlan = (params: {
  items: PreflightCheckResult[];
  rerunAfterFix: boolean;
  shouldSyncPatch: (patch: PreflightPatch) => boolean;
}) => {
  const patchItems = collectBatchPatchItems(params.items);
  const deduped = dedupePatchCandidates(patchItems);
  const steps = buildBatchFixSteps(
    deduped.map(({ result, patch }) => ({
      id: result.id,
      title: result.title,
      doSync: params.shouldSyncPatch(patch),
    })),
    params.rerunAfterFix,
  );
  const skipped = Math.max(0, patchItems.length - deduped.length);
  return { deduped, steps, skipped };
};
