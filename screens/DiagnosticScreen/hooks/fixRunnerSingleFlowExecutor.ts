import { safeTruncateText } from "../../../lib/diagnostics/sanitize";
import type { PreflightCheckResult, PreflightPatch } from "../../../lib/diagnostics/preflightTypes";
import { buildSingleFixPlan, buildSingleFixSuccessResult } from "./fixRunnerFlowPlanHelpers";
import { runOptionalVerify, runPatchApplyAndSync } from "./fixRunnerFlowSharedSteps";
import type { SharedFlowDeps } from "./fixRunnerFlowExecutor.shared";

type SinglePatchDeps = {
  applyPatch: (label: string, patch: PreflightPatch) => Promise<unknown>;
  syncPatchToGitHub: (label: string, patch: PreflightPatch) => Promise<void>;
};

export async function executeSingleFixFlow(params: {
  result: PreflightCheckResult;
  doSync: boolean;
} & SharedFlowDeps & SinglePatchDeps): Promise<void> {
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
