// hooks/useBuildStatus.ts - OPTIMIZED VERSION
// ✅ Timeout bei Netzwerkfehlern
// ✅ Error-Counter stoppt Polling nach 5 Fehlern (mit useRef statt State)
// ✅ Automatischer Stop bei finalen Status (success/failed)
// ✅ Besseres Status-Mapping (zentralisiert über buildStatusMapper)
// ✅ Callbacks statt Alert (bessere Testbarkeit)
// ✅ Kein Race Condition durch errorCount in Dependencies

import { useEffect, useState, useRef, useCallback } from "react";
import { AppState } from "react-native";
import type { BuildStatus, BuildStatusDetails } from "../shared/types/build";
import {
  pollBuildStatusOnce,
  isFinalStatus,
} from "../project/services/buildPollingService";

const POLL_INTERVAL_MS = 6000; // 6 Sekunden
const MAX_ERRORS = 5; // Nach 5 Fehlern stoppen
const REQUEST_TIMEOUT_MS = 10000; // 10 Sekunden Timeout pro Request

// ============================================
// CALLBACK TYPES
// ============================================
export interface UseBuildStatusCallbacks {
  onSuccess?: (details: BuildStatusDetails) => void;
  onFailed?: (details: BuildStatusDetails) => void;
  onError?: (error: string, errorCount: number) => void;
  onMaxErrors?: (lastError: string, maxErrors: number) => void;
}

// ============================================
// HOOK
// ============================================
export function useBuildStatus(
  jobIdFromScreen?: string | null,
  callbacks?: UseBuildStatusCallbacks,
) {
  const [status, setStatus] = useState<BuildStatus>("idle");
  const [details, setDetails] = useState<BuildStatusDetails | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  // ✅ FIX: State für errorCount um reaktive Updates zu ermöglichen
  const [errorCount, setErrorCount] = useState(0);

  // Use refs for values that shouldn't trigger re-renders
  const errorCountRef = useRef(0);
  const hasAlertedRef = useRef(false);
  const isMountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRequestPendingRef = useRef(false);
  const latestDetailsRef = useRef<BuildStatusDetails | null>(null);

  const buildFailureDetails = useCallback(
    (statusOverride: BuildStatus = "error"): BuildStatusDetails | null => {
      if (latestDetailsRef.current) {
        return { ...latestDetailsRef.current, status: statusOverride };
      }

      if (!jobIdFromScreen) return null;

      return {
        jobId: jobIdFromScreen,
        status: statusOverride,
        urls: undefined,
        raw: null,
        runId: null,
      };
    },
    [jobIdFromScreen],
  );

  const notifyFailure = useCallback(
    (statusOverride: BuildStatus = "error") => {
      const failureDetails = buildFailureDetails(statusOverride);
      if (failureDetails) {
        callbacks?.onFailed?.(failureDetails);
      }
    },
    [buildFailureDetails, callbacks],
  );

  // Memoized poll function
  const poll = useCallback(async () => {
    if (!jobIdFromScreen) return;
    if (isRequestPendingRef.current) return;
    isRequestPendingRef.current = true;

    try {
      console.log(
        `[useBuildStatus] 🔄 Polling Job ${jobIdFromScreen}. (Fehler: ${errorCountRef.current}/${MAX_ERRORS})`,
      );

      const result = await pollBuildStatusOnce(jobIdFromScreen, {
        timeoutMs: REQUEST_TIMEOUT_MS,
      });

      if (!isMountedRef.current) return;

      // ✅ Fehlerfall
      if (!result.ok) {
        console.log("[useBuildStatus] ❌ Error Response:", result.raw);
        const errorMsg = result.error;
        errorCountRef.current += 1;
        setErrorCount(errorCountRef.current);
        setLastError(errorMsg);

        // Callback für jeden Fehler
        callbacks?.onError?.(errorMsg, errorCountRef.current);

        if (errorCountRef.current >= MAX_ERRORS) {
          setStatus("error");
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          if (!hasAlertedRef.current) {
            hasAlertedRef.current = true;
            // Callback statt Alert
            callbacks?.onMaxErrors?.(errorMsg, MAX_ERRORS);
            notifyFailure("error");
          }
        }
        return;
      }

      // ✅ Erfolg: Fehler-Counter zurücksetzen
      errorCountRef.current = 0;
      setErrorCount(0);
      setLastError(null);

      const mapped = result.status;
      setStatus(mapped);

      const newDetails: BuildStatusDetails = result.details;

      setDetails(newDetails);
      latestDetailsRef.current = newDetails;

      console.log("[useBuildStatus] ✅ Status:", mapped);

      // ✅ Polling bei finalen Status stoppen
      if (isFinalStatus(mapped)) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          console.log("[useBuildStatus] ⏸ Polling gestoppt (finaler Status)");
        }

        if (!hasAlertedRef.current) {
          hasAlertedRef.current = true;

          // Callbacks statt Alerts
          if (mapped === "success") {
            callbacks?.onSuccess?.(newDetails);
          } else {
            callbacks?.onFailed?.(newDetails);
          }
        }
      }
    } catch (e: any) {
      if (!isMountedRef.current) return;

      console.log("[useBuildStatus] ⚠️ Poll Error:", e?.message);
      const errorMsg = e?.message || "Netzwerkfehler";
      errorCountRef.current += 1;
      setErrorCount(errorCountRef.current);
      setLastError(errorMsg);

      // Callback für jeden Fehler
      callbacks?.onError?.(errorMsg, errorCountRef.current);

      if (errorCountRef.current >= MAX_ERRORS) {
        setStatus("error");
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        if (!hasAlertedRef.current) {
          hasAlertedRef.current = true;
          // Callback statt Alert
          callbacks?.onMaxErrors?.(errorMsg, MAX_ERRORS);
          notifyFailure("error");
        }
      }
    } finally {
      isRequestPendingRef.current = false;
    }
  }, [jobIdFromScreen, callbacks, notifyFailure]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!jobIdFromScreen) {
      setStatus("idle");
      setDetails(null);
      latestDetailsRef.current = null;
      setLastError(null);
      errorCountRef.current = 0;
      setErrorCount(0);
      hasAlertedRef.current = false;
      isRequestPendingRef.current = false;
      return;
    }

    // Reset error tracking for new job
    errorCountRef.current = 0;
    setErrorCount(0);
    hasAlertedRef.current = false;
    isRequestPendingRef.current = false;
    latestDetailsRef.current = null;

    // ✅ Sofort einmal pollen, dann Intervall
    poll();

    // Start interval polling
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    intervalRef.current = setInterval(() => {
      poll();
    }, POLL_INTERVAL_MS);

    // Pause/Resume on AppState (Android background reliability)
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      // Resume if still relevant and not final
      if (jobIdFromScreen && !intervalRef.current && !isFinalStatus(status)) {
        poll();
        intervalRef.current = setInterval(() => {
          poll();
        }, POLL_INTERVAL_MS);
      }
    });

    return () => {
      isMountedRef.current = false;
      sub.remove();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log("[useBuildStatus] 🛑 Hook unmounted, Polling gestoppt");
      }
    };
  }, [jobIdFromScreen, poll, status]);

  return {
    status,
    details,
    errorCount,
    lastError,
    isPolling: status === "queued" || status === "building",
  };
}
