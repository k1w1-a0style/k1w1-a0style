import type { OrchestratorResult } from "../lib/orchestrator";

export const getBuilderFailureDetails = (
  result: OrchestratorResult | null | undefined,
): string => {
  const details =
    result?.error ||
    result?.errors?.join?.("\n") ||
    "Kein ok=true (unbekannter Fehler).";

  return details;
};

export const getBuilderFailureMessage = (
  result: OrchestratorResult | null | undefined,
): string => {
  return `KI-Request fehlgeschlagen: ${getBuilderFailureDetails(result)}`;
};
