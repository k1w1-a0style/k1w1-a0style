import type { PreflightPatch } from "../../lib/diagnostics/preflightTypes";
import { redactSecrets, truncateWithMarker } from "../../lib/secretRedaction";

export type StepState = "idle" | "waiting" | "running" | "success" | "failure";

export type CiLiteRunMeta = {
  status?: "queued" | "in_progress" | "completed";
  conclusion?: string | null;
} | null;

/**
 * Decide whether CI Lite should be shown as green.
 *
 * Rule:
 * - If GitHub provides a completed run, trust its conclusion.
 * - Otherwise, fall back to parsed output.
 */
export function computeCiLiteOk(args: {
  done: boolean;
  workflowRun: CiLiteRunMeta;
  onlyErrorsCount: number;
  hasErrorText: boolean;
  resultOk?: boolean | null;
  eslintExit?: number | null;
  tscExit?: number | null;
}): boolean {
  const { done, workflowRun, onlyErrorsCount, hasErrorText, resultOk } = args;
  if (done && typeof resultOk === "boolean") return resultOk;
  if (!done) return false;

  if (workflowRun?.status === "completed") {
    return (workflowRun.conclusion || "").toLowerCase() === "success";
  }

  return onlyErrorsCount === 0 && !hasErrorText;
}

export function safeUi(s: string): string {
  return truncateWithMarker(redactSecrets(s || ""), 900, "…");
}

type WorkflowRunForLookup = Record<string, unknown> & {
  display_title?: unknown;
  name?: unknown;
};

type WorkflowRunWithTitle = {
  run: WorkflowRunForLookup;
  title: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toWorkflowRunCandidate(value: unknown): WorkflowRunForLookup | null {
  return isRecord(value) ? value : null;
}

function getRunTitle(run: WorkflowRunForLookup): string {
  const displayTitle = typeof run.display_title === "string" ? run.display_title : "";
  const name = typeof run.name === "string" ? run.name : "";
  return String(displayTitle || name).trim();
}

function toWorkflowRunWithTitle(value: unknown): WorkflowRunWithTitle | null {
  const run = toWorkflowRunCandidate(value);
  if (!run) return null;
  const title = getRunTitle(run);
  if (!title) return null;
  return { run, title };
}

export function findWorkflowRunByJobId(runs: unknown, jobId: string): WorkflowRunForLookup | null {
  if (!Array.isArray(runs) || !jobId?.trim()) return null;
  const jid = jobId.trim();

  const exactPatterns = [
    `[${jid}]`,
    `(job_id=${jid})`,
    `job_id=${jid}`,
    `job_id: ${jid}`,
  ];

  const withTitle = runs
    .map(toWorkflowRunWithTitle)
    .filter((entry): entry is WorkflowRunWithTitle => entry !== null);

  const exact = withTitle.find(({ title }) => exactPatterns.some((p) => title.includes(p)));
  if (exact) return exact.run;

  const fallback = withTitle.find(({ title }) => title.includes(jid));
  return fallback?.run ?? null;
}

export function inferStepStates(lines: string[]): {
  lint: StepState;
  typecheck: StepState;
  eslintErrors: number;
  tsErrors: number;
} {
  const joined = lines.join("\n");

  // Workflow emits deterministic markers (metadata.env + summaries). Keep regex fallback for legacy logs.
  const lintExitCodeMatch = joined.match(/LINT_EXIT=(\d+)/i);
  const typecheckExitCodeMatch = joined.match(/TSC_EXIT=(\d+)/i);
  const lintExitCode = lintExitCodeMatch ? Number(lintExitCodeMatch[1]) : null;
  const typecheckExitCode = typecheckExitCodeMatch ? Number(typecheckExitCodeMatch[1]) : null;

  const lintStarted =
    lintExitCode !== null ||
    /npm run lint:ci|eslint\s+\.|\blint:ci\b|Lint \(CI\)/i.test(joined);
  const typecheckStarted =
    typecheckExitCode !== null ||
    /npm run typecheck|tsc\s+--noEmit|Typecheck/i.test(joined);

  const tsErrors = lines.filter((l) => /error\s+TS\d+:|Type \".*\" is not assignable/i.test(l)).length;
  // ESLint (quiet) prints only errors; zähle typische Formate inkl. compact formatter.
  const eslintErrors = lines.filter(
    (l) => !/error\s+TS\d+:/i.test(l) && (/\serror\s{2,}/i.test(l) || /\d+\s+problems?\s*\(\d+\s+errors?/i.test(l)),
  ).length;

  const hasFailure = /Process completed with exit code\s+(?!0)\d+/i.test(joined);
  const hasSuccess = /✅\s*CI\s*Lite\s*passed|All checks passed|Done\s+in\s+\d|0\s+problems\s*\(0\s+errors|Typecheck\s*(ok|passed)/i.test(joined);

  const lint: StepState = lintStarted
    ? lintExitCode === 0
      ? "success"
      : typeof lintExitCode === "number" && lintExitCode !== 0
        ? "failure"
        : eslintErrors > 0
          ? "failure"
          : hasSuccess || /Lint \(CI\).*\s+\(\d+\)/i.test(joined)
            ? "success"
            : hasFailure
              ? "failure"
              : "running"
    : "waiting";

  const typecheck: StepState = typecheckStarted
    ? typecheckExitCode === 0
      ? "success"
      : typeof typecheckExitCode === "number" && typecheckExitCode !== 0
        ? "failure"
        : tsErrors > 0
          ? "failure"
          : hasSuccess
            ? "success"
            : hasFailure
              ? "failure"
              : "running"
    : "waiting";

  return { lint, typecheck, eslintErrors, tsErrors };
}

export function normalizePreflightPatch(input: unknown): PreflightPatch {
  if (!isRecord(input)) throw new Error("Patch JSON ist leer oder ungültig.");

  // Accept either a plain patch or { patch: ... }
  const patchCandidate = isRecord(input.patch) ? input.patch : input;

  const out: PreflightPatch = {};
  const upsert = patchCandidate.upsert;
  const deletions = patchCandidate.delete;
  const jsonMerge = patchCandidate.jsonMerge;
  if (Array.isArray(upsert)) out.upsert = upsert;
  if (Array.isArray(deletions)) out.delete = deletions;
  if (Array.isArray(jsonMerge)) out.jsonMerge = jsonMerge;
  if (typeof patchCandidate.explanation === "string") out.explanation = patchCandidate.explanation;

  if (!out.upsert?.length && !out.delete?.length && !out.jsonMerge?.length) {
    throw new Error("Patch hat keine Operationen (upsert/delete/jsonMerge).");
  }
  return out;
}
