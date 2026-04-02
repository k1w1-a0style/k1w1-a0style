import type { PreflightCheckResult } from "../../lib/diagnostics/preflightTypes";

export function getDiagnosticFailResults(
  results: readonly PreflightCheckResult[],
): PreflightCheckResult[] {
  return results.filter((result) => result.status === "fail");
}

export function getDiagnosticFailSummaryLines(
  results: readonly PreflightCheckResult[],
  maxLines = 12,
): string[] {
  return getDiagnosticFailResults(results)
    .slice(0, maxLines)
    .map((result) => `- ${result.title}: ${result.message || ""}`.trim());
}
