import { WORKFLOW_CI_LITE, type StepState } from "../types";

export type CiLiteStepInfo = {
  lint: StepState;
  typecheck: StepState;
  eslintErrors: number;
  tsErrors: number;
};

export const resolveCiLitePendingRunMessage = (params: {
  chainWaiting: boolean;
  workflowId: string;
  jobId: string | null;
}): string => {
  const { chainWaiting, workflowId, jobId } = params;
  if (chainWaiting && workflowId === WORKFLOW_CI_LITE) {
    return `Autofix fertig – starte CI Lite (chain-run)… (job_id: ${jobId || ""})`;
  }
  if (jobId) {
    return `Warte auf GitHub Run… (job_id: ${jobId})`;
  }
  return "Warte auf GitHub Run…";
};

export const resolveHydratedCiLiteStepInfo = (params: {
  lintOk: boolean;
  typecheckOk: boolean;
}): CiLiteStepInfo => {
  return {
    lint: params.lintOk ? "success" : "failure",
    typecheck: params.typecheckOk ? "success" : "failure",
    eslintErrors: params.lintOk ? 0 : 1,
    tsErrors: params.typecheckOk ? 0 : 1,
  };
};

export const resolveCiLiteCompletionErrorText = (params: {
  workflowStatus: string | null | undefined;
  workflowConclusion: string | null | undefined;
  hydratedConclusion: string | null | undefined;
}): string => {
  const workflowStatus = String(params.workflowStatus ?? "").trim();
  const workflowConclusion = String(params.workflowConclusion ?? "").trim();
  if (workflowStatus === "completed" && workflowConclusion && workflowConclusion !== "success") {
    return `Workflow failed (${workflowConclusion}). Open the run for details.`;
  }

  const hydratedConclusion = String(params.hydratedConclusion ?? "").trim();
  if (hydratedConclusion && hydratedConclusion !== "success") {
    return `Letzter CI-Lite-Run ist beendet, aber nicht grün (${hydratedConclusion}).`;
  }

  return "";
};

export const resolveCiLiteBusyState = (params: {
  dispatching: boolean;
  locatingRun: boolean;
  chainWaiting: boolean;
  logsLoading: boolean;
  workflowStatus: string | null | undefined;
}): boolean => {
  return (
    params.dispatching ||
    params.locatingRun ||
    params.chainWaiting ||
    params.logsLoading ||
    params.workflowStatus === "in_progress" ||
    params.workflowStatus === "queued"
  );
};

export const isCiLiteRunContextActive = (params: {
  dispatching: boolean;
  locatingRun: boolean;
  chainWaiting: boolean;
  runId: number | null | undefined;
}): boolean => {
  return params.dispatching || params.locatingRun || params.chainWaiting || params.runId != null;
};

const AUTOFIX_CHAIN_SKIP_REASON_RULES: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /No\s+TARGET_BRANCH.*skipping\s+CI\s*Lite\s+chain-?run/i,
    reason: "Kein TARGET_BRANCH im Autofix-Run",
  },
  {
    pattern: /Ref\s+looks\s+like\s+a\s+SHA.*skipping\s+CI\s*Lite\s+chain-?run/i,
    reason: "Ref wurde als SHA statt Branch erkannt",
  },
  {
    pattern: /Unsafe\s+ref.*skipping\s+CI\s*Lite\s+chain-?run/i,
    reason: "Ref enthält unsichere Zeichen",
  },
  {
    pattern: /CI\s*Lite\s+chain-?run\s+disabled\s+for.*regex:/i,
    reason: "Ref ist laut Workflow-Regeln nicht für Chain-Run erlaubt",
  },
  {
    pattern: /is\s+not\s+a\s+remote\s+branch.*skipping\s+CI\s*Lite\s+chain-?run/i,
    reason: "Ref existiert nicht als Remote-Branch",
  },
];

export const getAutofixChainSkipReason = (lines: string[]): string | null => {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const joined = lines.join("\n");
  return AUTOFIX_CHAIN_SKIP_REASON_RULES.find(({ pattern }) => pattern.test(joined))?.reason ?? null;
};

export const resolveCiLiteDisplaySnapshot = <TSnapshot>(params: {
  hasActiveRunContext: boolean;
  workflowRunPresent: boolean;
  hydratedSnapshot: TSnapshot | null;
}): TSnapshot | null => {
  if (params.hasActiveRunContext) return null;
  if (params.workflowRunPresent) return null;
  return params.hydratedSnapshot;
};

export const resolveCiLiteTargetRef = (params: {
  targetRef: string | null | undefined;
  hydratedBranch: string | null | undefined;
  branch: string | null | undefined;
}): string | null => {
  const resolved =
    String(params.targetRef ?? "").trim() ||
    String(params.hydratedBranch ?? "").trim() ||
    String(params.branch ?? "").trim();
  return resolved || null;
};
