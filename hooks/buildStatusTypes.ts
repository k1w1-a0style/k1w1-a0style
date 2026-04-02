// hooks/buildStatusTypes.ts
// Extracted from useBuildStatus.ts: shared constants and polling helpers.

import type { BuildStatusDetails } from "../shared/types/build";

export const POLL_INTERVALS_MS = [6_000, 10_000, 15_000, 30_000] as const;
const DEFAULT_POLL_MAX_INTERVAL_MS = 30_000;
export const POLL_MAX_INTERVAL_MS = POLL_INTERVALS_MS[POLL_INTERVALS_MS.length - 1] ?? DEFAULT_POLL_MAX_INTERVAL_MS;
export const MAX_ERRORS = 5; // Nach 5 Fehlern stoppen
export const REQUEST_TIMEOUT_MS = 10_000; // 10 Sekunden Timeout pro Request

export interface UseBuildStatusCallbacks {
  onSuccess?: (details: BuildStatusDetails) => void;
  onFailed?: (details: BuildStatusDetails) => void;
  onError?: (error: string, errorCount: number) => void;
  onMaxErrors?: (lastError: string, maxErrors: number) => void;
}

export type BuildStatusPollIntervalParams = {
  errorCount: number;
  elapsedMs: number;
};

export function getBuildStatusPollInterval({
  errorCount,
  elapsedMs,
}: BuildStatusPollIntervalParams): number {
  if (errorCount > 2) return POLL_MAX_INTERVAL_MS;
  const boundedElapsed = Math.max(0, elapsedMs);
  const idx = Math.min(
    Math.floor(boundedElapsed / 120_000),
    POLL_INTERVALS_MS.length - 1,
  );
  const interval = POLL_INTERVALS_MS[idx];
  return interval ?? POLL_MAX_INTERVAL_MS;
}
