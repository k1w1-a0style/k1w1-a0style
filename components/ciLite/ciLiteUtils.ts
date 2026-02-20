import type { PreflightPatch } from "../../lib/diagnostics/preflightTypes";
import { redactSecrets, truncateWithMarker } from "../../lib/secretRedaction";

export type StepState = "idle" | "waiting" | "running" | "success" | "failure";

export function safeUi(s: string): string {
  return truncateWithMarker(redactSecrets(s || ""), 900, "…");
}

export function inferStepStates(lines: string[]): {
  lint: StepState;
  typecheck: StepState;
  eslintErrors: number;
  tsErrors: number;
} {
  const joined = lines.join("\n");

  const lintStarted = /npm run lint:ci|eslint\s+\./i.test(joined);
  const typecheckStarted = /npm run typecheck|tsc\s+--noEmit/i.test(joined);

  const tsErrors = lines.filter((l) => /error\s+TS\d+:/i.test(l)).length;
  // ESLint (quiet) prints only errors; count typical lines containing " error  " but not TS errors.
  const eslintErrors = lines.filter(
    (l) => !/error\s+TS\d+:/i.test(l) && /\serror\s{2,}/i.test(l),
  ).length;

  const hasFailure = /Process completed with exit code\s+(?!0)\d+/i.test(joined);
  const hasSuccess = /✅\s*CI\s*Lite\s*passed|All checks passed|Done\s+in\s+\d/i.test(joined);

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
