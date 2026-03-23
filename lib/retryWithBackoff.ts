import { logger } from "./logger";
import {
  fetchWithTimeout,
  isAbortError,
  sleepWithSignal,
  throwIfAborted,
  type FetchWithTimeoutInit,
} from "./network/fetchWithTimeout";
/**
 * Retry with Backoff
 * Wiederholungslogik mit exponentiellem Backoff für API-Calls
 *
 * Wichtig: deterministische Delays (ohne Random/Jitter), damit
 * CI/Tests stabil bleiben und Fake-Timer korrekt funktionieren.
 */

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

export type RetryWithBackoffOptions = {
  signal?: AbortSignal;
};

/**
 * Berechnet Backoff-Delay basierend auf Versuchsnummer.
 * Exponentieller Backoff: 1s, 2s, 4s, 8s, ...
 *
 * @param attemptNumber - 0-basiert
 */
function calculateBackoff(attemptNumber: number): number {
  const delay = BASE_DELAY_MS * Math.pow(2, attemptNumber);
  return Math.min(delay, MAX_DELAY_MS);
}

/**
 * Führt einen fetch-Request mit Retry-Logik aus.
 */
export async function fetchWithBackoff(
  url: string,
  options: FetchWithTimeoutInit,
  maxRetries = 3,
): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    throwIfAborted(options.signal);

    try {
      const res = await fetchWithTimeout(url, options);

      // Bei Erfolg oder Client-Fehlern (404, 403) nicht wiederholen
      if (res.ok || res.status === 404 || res.status === 403) {
        return res;
      }

      // Bei Server-Fehlern (5xx) wiederholen, außer beim letzten Versuch
      if (res.status >= 500 && i < maxRetries - 1) {
        const delay = calculateBackoff(i);
        logger.debug(
          `[retryWithBackoff] Server error ${res.status}, retry ${i + 1}/${maxRetries} in ${delay}ms`,
        );
        await sleepWithSignal(delay, options.signal);
        continue;
      }

      return res;
    } catch (e) {
      if (isAbortError(e)) throw e;

      // Bei Netzwerkfehlern wiederholen, außer beim letzten Versuch
      if (i === maxRetries - 1) throw e;

      const delay = calculateBackoff(i);
      logger.debug(
        `[retryWithBackoff] Network error, retry ${i + 1}/${maxRetries} in ${delay}ms`,
      );
      await sleepWithSignal(delay, options.signal);
    }
  }

  throw new Error("Max retries reached");
}

/**
 * Generische Retry-Funktion für beliebige async Operationen.
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  shouldRetry?: (error: unknown) => boolean,
  retryOptions: RetryWithBackoffOptions = {},
): Promise<T> {
  const { signal } = retryOptions;

  for (let i = 0; i < maxRetries; i++) {
    throwIfAborted(signal);

    try {
      return await operation();
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      // Letzter Versuch - Error werfen
      if (i === maxRetries - 1) {
        throw error;
      }

      // Prüfen ob Retry sinnvoll ist
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      const delay = calculateBackoff(i);
      logger.debug(
        `[retryWithBackoff] Retry ${i + 1}/${maxRetries} in ${delay}ms`,
      );
      await sleepWithSignal(delay, signal);
    }
  }

  throw new Error("Max retries reached");
}
