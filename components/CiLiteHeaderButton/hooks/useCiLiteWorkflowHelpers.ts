import type { WorkflowRunLookupDiagnosis } from "./workflowRunMatching";
import { buildCiLiteLookupFailureMessage } from "./ciLiteWorkflowErrors";
import { WORKFLOW_CI_LITE, WORKFLOW_CI_LITE_AUTOFIX, type StepState } from "../types";

export type ArtifactFetchContextInput = {
  githubRepo: string | null | undefined;
  workflowId: string | null | undefined;
  workflowRunId: number | null | undefined;
  workflowStatus: string | null | undefined;
};

export const resolveCiLiteArtifactRequest = (workflowId: string): {
  artifactName: "ci-lite-logs" | "ci-lite-autofix-logs";
  filePath: "ci-logs/ci-lite-result.json" | "ci-logs/ci-lite-autofix-result.json";
} => {
  if (workflowId === WORKFLOW_CI_LITE_AUTOFIX) {
    return {
      artifactName: "ci-lite-autofix-logs",
      filePath: "ci-logs/ci-lite-autofix-result.json",
    };
  }
  return {
    artifactName: "ci-lite-logs",
    filePath: "ci-logs/ci-lite-result.json",
  };
};

export const buildArtifactFetchContextKey = (
  input: ArtifactFetchContextInput,
): string | null => {
  const repo = String(input.githubRepo ?? "").trim();
  const workflowId = String(input.workflowId ?? "").trim();
  const status = String(input.workflowStatus ?? "").trim();

  if (!repo || !workflowId || !input.workflowRunId || status !== "completed") {
    return null;
  }

  return `${repo}::${workflowId}::${String(input.workflowRunId)}`;
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

export type CiLiteStepInfo = {
  lint: StepState;
  typecheck: StepState;
  eslintErrors: number;
  tsErrors: number;
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

export const resolveCiLiteLookupFailureLabel = (mode: "chain" | "default"): string => {
  return mode === "chain" ? "Autofix-Chain → CI Lite" : "Workflow";
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

export const splitRepoFullName = (
  repoFullName: string,
): { owner: string; repo: string } | null => {
  const [owner, repo] = String(repoFullName || "").trim().split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
};

export const getCiLiteWorkflowErrorMessage = (
  error: unknown,
  fallback = "",
): string => {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
};

export type CiLiteArtifactJson = {
  ok: boolean;
  eslint_exit?: number;
  tsc_exit?: number;
  source_commit_sha?: string;
  source_sha?: string;
  github_sha?: string;
};

export const parseCiLiteArtifactJson = (payload: unknown): CiLiteArtifactJson => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Artifact JSON missing or invalid");
  }

  const src = payload as Record<string, unknown>;
  const readNum = (k: "eslint_exit" | "tsc_exit"): number | undefined =>
    typeof src[k] === "number" ? src[k] : undefined;
  const readSha = (k: "source_commit_sha" | "source_sha" | "github_sha"): string | undefined =>
    typeof src[k] === "string" ? src[k].trim() || undefined : undefined;

  return {
    ok: typeof src.ok === "boolean" ? src.ok : Boolean(src.ok),
    eslint_exit: readNum("eslint_exit"),
    tsc_exit: readNum("tsc_exit"),
    source_commit_sha: readSha("source_commit_sha"),
    source_sha: readSha("source_sha"),
    github_sha: readSha("github_sha"),
  };
};

export const mergeWorkflowRunLookupDiagnosis = (
  previous: WorkflowRunLookupDiagnosis | null,
  next: WorkflowRunLookupDiagnosis | null,
): WorkflowRunLookupDiagnosis | null => {
  if (!next) return previous;
  if (!previous) return next;

  if (next.exactJobIdMatchFound || next.selectedTier) {
    return next;
  }

  if (!next.contractMismatchLikely && !next.ambiguous) {
    if (previous.contractMismatchLikely || previous.ambiguous) {
      return {
        ...next,
        ambiguous: previous.ambiguous || next.ambiguous,
        contractMismatchLikely: previous.contractMismatchLikely || next.contractMismatchLikely,
        fallbackCandidateCount: Math.max(previous.fallbackCandidateCount, next.fallbackCandidateCount),
        plausibleCandidateCount: Math.max(previous.plausibleCandidateCount, next.plausibleCandidateCount),
      };
    }
  }

  return next;
};

export const resolveCiLiteLookupFailureMessage = (params: {
  diagnosis: WorkflowRunLookupDiagnosis | null;
  workflowLabel: string;
}): string => {
  const { diagnosis, workflowLabel } = params;
  if (diagnosis?.ambiguous) {
    return buildCiLiteLookupFailureMessage({ workflowLabel, kind: "ambiguous" });
  }
  if (diagnosis?.contractMismatchLikely) {
    return buildCiLiteLookupFailureMessage({
      workflowLabel,
      kind: "contract_mismatch",
      hasExistingRunCandidate:
        diagnosis.plausibleCandidateCount > 0 || diagnosis.fallbackCandidateCount > 0,
    });
  }
  return buildCiLiteLookupFailureMessage({ workflowLabel, kind: "timeout" });
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

export const resolveCiLiteMissingJwtMessage = (
  context: "artifact" | "lookup" | "dispatch",
): string => {
  if (context === "artifact") {
    return "CI-Lite-Artefakt blockiert: Der aktuelle Supabase-Login hat keine Operator-Rolle. Erforderlich ist JWT role=build_admin (oder service_role fuer Server-Caller). build_admin wird im Betriebs-/Provisioning-Prozess ausserhalb dieses Repos per Supabase-User-Claim vergeben. Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim sind fuer diesen Operator-Flow fail-closed blockiert.";
  }
  if (context === "lookup") {
    return "Workflow-Run-Lookup blockiert: Der aktuelle Supabase-Login hat keine Operator-Rolle. Erforderlich ist JWT role=build_admin (oder service_role fuer Server-Caller). build_admin wird im Betriebs-/Provisioning-Prozess ausserhalb dieses Repos per Supabase-User-Claim vergeben. Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim sind fuer diesen Operator-Flow fail-closed blockiert.";
  }
  return "Workflow-Dispatch blockiert: Der aktuelle Supabase-Login hat keine Operator-Rolle. Erforderlich ist JWT role=build_admin (oder service_role fuer Server-Caller). build_admin wird im Betriebs-/Provisioning-Prozess ausserhalb dieses Repos per Supabase-User-Claim vergeben. Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim sind fuer diesen Operator-Flow fail-closed blockiert.";
};
