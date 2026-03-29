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

export const getInputValidationMessage = (error?: string): string => {
  if (error === "Nachricht ist zu lang") {
    return "⚠️ Deine Nachricht ist zu lang. Bitte kürze den Prompt oder teile ihn in kleinere Schritte auf.";
  }

  return `⚠️ ${error || "Nachricht konnte nicht verarbeitet werden."}`;
};
