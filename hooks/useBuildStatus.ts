// hooks/useBuildStatus.ts
// REFACTORED: types → buildStatusTypes.ts

// hooks/useBuildStatus.ts - OPTIMIZED VERSION
// ✅ Timeout bei Netzwerkfehlern
// ✅ Error-Counter stoppt Polling nach 5 Fehlern (mit useRef statt State)
// ✅ Automatischer Stop bei finalen Status (success/failed)
// ✅ Besseres Status-Mapping (zentralisiert über buildStatusMapper)
// ✅ Callbacks statt Alert (bessere Testbarkeit)
// ✅ Kein Race Condition durch errorCount in Dependencies
// ✅ Adaptives Polling mit Backoff statt starrem Intervall

import { useEffect, useState, useRef, useCallback } from "react";
import { AppState } from "react-native";
import type { BuildStatus, BuildStatusDetails } from "../shared/types/build";
import {
  pollBuildStatusOnce,
  isFinalStatus,
} from "../project/services/buildPollingService";

import { logger } from "../lib/logger";

import {
  MAX_ERRORS,
  REQUEST_TIMEOUT_MS,
  getBuildStatusPollInterval,
} from "./buildStatusTypes";
import type { UseBuildStatusCallbacks } from "./buildStatusTypes";
export type { UseBuildStatusCallbacks } from "./buildStatusTypes";

const getErrorMessage = (error: unknown, fallback = "Netzwerkfehler") => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
};

export function useBuildStatus(
  jobIdFromScreen?: string | null,
  callbacks?: UseBuildStatusCallbacks,
) {
  const [status, setStatus] = useState<BuildStatus>("idle");
  const [details, setDetails] = useState<BuildStatusDetails | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [errorCount, setErrorCount] = useState(0);

  const errorCountRef = useRef(0);
  const hasAlertedRef = useRef(false);
  const isMountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRequestPendingRef = useRef(false);
  const latestDetailsRef = useRef<BuildStatusDetails | null>(null);
  const statusRef = useRef<BuildStatus>("idle");
  const callbacksRef = useRef<UseBuildStatusCallbacks | undefined>(callbacks);
  const pollingStartedAtRef = useRef<number | null>(null);
  const scheduleNextPollRef = useRef<((errorCountOverride?: number) => void) | null>(null);

  const clearPollTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

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
        callbacksRef.current?.onFailed?.(failureDetails);
      }
    },
    [buildFailureDetails],
  );

  const poll = useCallback(async () => {
    if (!jobIdFromScreen) return;
    if (isRequestPendingRef.current) return;
    isRequestPendingRef.current = true;
    clearPollTimer();

    let shouldScheduleNext = false;
    let nextErrorCount = errorCountRef.current;

    try {
      logger.debug(
        `[useBuildStatus] 🔄 Polling Job ${jobIdFromScreen}. (Fehler: ${errorCountRef.current}/${MAX_ERRORS})`,
      );

      const result = await pollBuildStatusOnce(jobIdFromScreen, {
        timeoutMs: REQUEST_TIMEOUT_MS,
      });

      if (!isMountedRef.current) return;

      if (!result.ok) {
        logger.debug("[useBuildStatus] ❌ Error Response:", result.raw);
        const errorMsg = result.error;
        errorCountRef.current += 1;
        nextErrorCount = errorCountRef.current;
        setErrorCount(errorCountRef.current);
        setLastError(errorMsg);

        callbacksRef.current?.onError?.(errorMsg, errorCountRef.current);

        if (errorCountRef.current >= MAX_ERRORS) {
          statusRef.current = "error";
          setStatus("error");
          clearPollTimer();
          if (!hasAlertedRef.current) {
            hasAlertedRef.current = true;
            callbacksRef.current?.onMaxErrors?.(errorMsg, MAX_ERRORS);
            notifyFailure("error");
          }
        } else {
          shouldScheduleNext = true;
        }
        return;
      }

      errorCountRef.current = 0;
      nextErrorCount = 0;
      setErrorCount(0);
      setLastError(null);

      const mapped = result.status;
      statusRef.current = mapped;
      setStatus(mapped);

      const newDetails: BuildStatusDetails = result.details;
      setDetails(newDetails);
      latestDetailsRef.current = newDetails;

      logger.debug("[useBuildStatus] ✅ Status:", mapped);

      if (isFinalStatus(mapped)) {
        clearPollTimer();
        logger.debug("[useBuildStatus] ⏸ Polling gestoppt (finaler Status)");

        if (!hasAlertedRef.current) {
          hasAlertedRef.current = true;
          if (mapped === "success") {
            callbacksRef.current?.onSuccess?.(newDetails);
          } else {
            callbacksRef.current?.onFailed?.(newDetails);
          }
        }
        return;
      }

      shouldScheduleNext = true;
    } catch (e: unknown) {
      if (!isMountedRef.current) return;

      const errorMsg = getErrorMessage(e);
      logger.debug("[useBuildStatus] ⚠️ Poll Error:", errorMsg);
      errorCountRef.current += 1;
      nextErrorCount = errorCountRef.current;
      setErrorCount(errorCountRef.current);
      setLastError(errorMsg);

      callbacksRef.current?.onError?.(errorMsg, errorCountRef.current);

      if (errorCountRef.current >= MAX_ERRORS) {
        statusRef.current = "error";
        setStatus("error");
        clearPollTimer();

        if (!hasAlertedRef.current) {
          hasAlertedRef.current = true;
          callbacksRef.current?.onMaxErrors?.(errorMsg, MAX_ERRORS);
          notifyFailure("error");
        }
      } else {
        shouldScheduleNext = true;
      }
    } finally {
      isRequestPendingRef.current = false;
      if (shouldScheduleNext && isMountedRef.current && !isFinalStatus(statusRef.current)) {
        scheduleNextPollRef.current?.(nextErrorCount);
      }
    }
  }, [clearPollTimer, jobIdFromScreen, notifyFailure]);

  const scheduleNextPoll = useCallback((errorCountOverride?: number) => {
    if (!jobIdFromScreen || !isMountedRef.current || isFinalStatus(statusRef.current)) return;

    const startedAt = pollingStartedAtRef.current ?? Date.now();
    const delay = getBuildStatusPollInterval({
      errorCount: errorCountOverride ?? errorCountRef.current,
      elapsedMs: Date.now() - startedAt,
    });

    clearPollTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      poll().catch(() => undefined);
    }, delay);
  }, [clearPollTimer, jobIdFromScreen, poll]);

  useEffect(() => {
    scheduleNextPollRef.current = scheduleNextPoll;
  }, [scheduleNextPoll]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!jobIdFromScreen) {
      clearPollTimer();
      statusRef.current = "idle";
      setStatus("idle");
      setDetails(null);
      latestDetailsRef.current = null;
      setLastError(null);
      errorCountRef.current = 0;
      setErrorCount(0);
      hasAlertedRef.current = false;
      isRequestPendingRef.current = false;
      pollingStartedAtRef.current = null;
      return;
    }

    errorCountRef.current = 0;
    setErrorCount(0);
    hasAlertedRef.current = false;
    isRequestPendingRef.current = false;
    latestDetailsRef.current = null;
    pollingStartedAtRef.current = Date.now();

    poll().catch(() => undefined);

    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        clearPollTimer();
        return;
      }

      if (jobIdFromScreen && !timerRef.current && !isFinalStatus(statusRef.current)) {
        poll().catch(() => undefined);
      }
    });

    return () => {
      isMountedRef.current = false;
      sub.remove();
      clearPollTimer();
      logger.debug("[useBuildStatus] 🛑 Hook unmounted, Polling gestoppt");
    };
  }, [clearPollTimer, jobIdFromScreen, poll]);

  return {
    status,
    details,
    errorCount,
    lastError,
    isPolling: status === "queued" || status === "building",
  };
}
