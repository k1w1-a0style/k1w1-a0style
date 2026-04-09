import type { PreflightCheckResult, PreflightPatch } from "../../../lib/diagnostics/preflightTypes";
import {
  DEFAULT_PATCH_LIMITS,
  checkPatchLimits,
  summarizeBatchLimits,
  summarizeBatchRisk,
} from "../../../lib/diagnostics/fixSafety";
import { parseOwnerRepo } from "../../../lib/diagnostics/ciAutoFix";
import { buildBatchRiskPromptMessage, confirmWithAlert } from "./fixRunnerPromptHelpers";
import { collectBatchSafetyPatches } from "./fixRunnerBatchPlanHelpers";

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

export async function confirmBatchFixSafety(params: {
  items: PreflightCheckResult[];
  onHardLimitBlock: (message: string) => void;
}): Promise<boolean> {
  const batch = collectBatchSafetyPatches(params.items);

  const limitSummary = summarizeBatchLimits(batch, DEFAULT_PATCH_LIMITS);
  if (limitSummary.hasHard) {
    const lines = limitSummary.hardLines.join("\n");
    params.onHardLimitBlock(
      `Mindestens ein Fix ist zu groß/komplex und wird aus Sicherheitsgründen blockiert.\n\n${lines}`,
    );
    return false;
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
    if (!proceed) return false;
  }

  return true;
}
