import type { OrchestratorResult } from "../lib/orchestrator";

export const readOrchestratorErrorText = (
  result: OrchestratorResult | null | undefined,
): string => {
  if (!result) return "";
  return [result.error, ...(result.errors ?? [])].filter(Boolean).join("\n");
};

export const readOrchestratorRuntimeNote = (
  result: OrchestratorResult | null | undefined,
): string => {
  const note = typeof result?.runtimeNote === "string" ? result.runtimeNote.trim() : "";
  return note;
};

export const parseRetryAfterMs = (errorText: string): number | null => {
  const secondsMatch = errorText.match(/retry-?after[^\d]*(\d+(?:\.\d+)?)\s*s/i);
  if (secondsMatch) return Math.round(Number(secondsMatch[1]) * 1000);

  const millisecondsMatch = errorText.match(/retry-?after[^\d]*(\d+)\s*ms/i);
  if (millisecondsMatch) return Number(millisecondsMatch[1]);

  return null;
};

export const isRetryableBuilderError = (errorText: string): boolean => {
  return /\b429\b|\brate\s*limit\b|\b503\b|overloaded|timeout|timed\s*out|ECONNRESET|network/i.test(
    errorText,
  );
};
