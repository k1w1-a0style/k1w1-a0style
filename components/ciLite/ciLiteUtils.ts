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

  return onlyErrorsCount == 0 && !hasErrorText;
}

export function safeUi(s: string): string {
  return truncateWithMarker(redactSecrets(s || ""), 900, "…");
}

export function findWorkflowRunByJobId(runs: any[], jobId: string): any | null {
  if (!Array.isArray(runs) || !jobId?.trim()) return null;
  const jid = jobId.trim();

  const exactPatterns = [
    `[${jid}]`,
    `(job_id=${jid})`,
    `job_id=${jid}`,
    `job_id: ${jid}`,
  ];

  const withTitle = runs
    .map((r) => ({
      run: r,
      title: String(r?.display_title ?? r?.name ?? "").trim(),
    }))
    .filter((x) => x.title.length > 0);

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

  const lintStarted = /npm run lint:ci|eslint\s+\.|\blint:ci\b|Lint \(CI\)/i.test(joined);
  const typecheckStarted = /npm run typecheck|tsc\s+--noEmit|Typecheck/i.test(joined);

  const tsErrors = lines.filter((l) => /error\s+TS\d+:|Type \".*\" is not assignable/i.test(l)).length;
  // ESLint (quiet) prints only errors; zähle typische Formate inkl. compact formatter.
  const eslintErrors = lines.filter(
    (l) => !/error\s+TS\d+:/i.test(l) && (/\serror\s{2,}/i.test(l) || /\d+\s+problems?\s*\(\d+\s+errors?/i.test(l)),
  ).length;

  const hasFailure = /Process completed with exit code\s+(?!0)\d+/i.test(joined);
  const hasSuccess = /✅\s*CI\s*Lite\s*passed|All checks passed|Done\s+in\s+\d|0\s+problems\s*\(0\s+errors|Typecheck\s*(ok|passed)/i.test(joined);

  const lint: StepState = lintStarted
    ? eslintErrors > 0
      ? "failure"
      : hasSuccess || /Lint \(CI\).*\s+\(\d+\)/i.test(joined)
        ? "success"
        : hasFailure
          ? "failure"
          : "running"
    : "waiting";

  const typecheck: StepState = typecheckStarted
    ? tsErrors > 0
      ? "failure"
      : hasSuccess
        ? "success"
        : hasFailure
          ? "failure"
          : "running"
    : "waiting";

  return { lint, typecheck, eslintErrors, tsErrors };
}

export function normalizePreflightPatch(input: any): PreflightPatch {
  if (!input || typeof input !== "object") throw new Error("Patch JSON ist leer oder ungültig.");

  // Accept either a plain patch or { patch: ... }
  const p =
    (input as any).patch && typeof (input as any).patch === "object" ? (input as any).patch : input;

  const out: PreflightPatch = {};
  if (Array.isArray((p as any).upsert)) out.upsert = (p as any).upsert;
  if (Array.isArray((p as any).delete)) out.delete = (p as any).delete;
  if (Array.isArray((p as any).jsonMerge)) out.jsonMerge = (p as any).jsonMerge;
  if (typeof (p as any).explanation === "string") out.explanation = (p as any).explanation;

  if (!out.upsert?.length && !out.delete?.length && !out.jsonMerge?.length) {
    throw new Error("Patch hat keine Operationen (upsert/delete/jsonMerge).");
  }
  return out;
}
