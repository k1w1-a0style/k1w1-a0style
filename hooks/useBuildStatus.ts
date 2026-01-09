// hooks/useBuildStatus.ts - OPTIMIZED VERSION
// ✅ Timeout bei Netzwerkfehlern
// ✅ Error-Counter stoppt Polling nach 5 Fehlern (mit useRef statt State)
// ✅ Automatischer Stop bei finalen Status (success/failed)
// ✅ Besseres Status-Mapping (zentralisiert über buildStatusMapper)
// ✅ Callbacks statt Alert (bessere Testbarkeit)
// ✅ Kein Race Condition durch errorCount in Dependencies

import { useEffect, useState, useRef, useCallback } from "react";
import { CONFIG } from "../config";
import { BuildStatus, mapBuildStatus } from "../lib/buildStatusMapper";
import { BuildStatusDetails } from "../lib/supabaseTypes";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getEdgeAdminKey } from "../contexts/githubService";

const POLL_INTERVAL_MS = 6000; // 6 Sekunden
const MAX_ERRORS = 5; // Nach 5 Fehlern stoppen
const REQUEST_TIMEOUT_MS = 10000; // 10 Sekunden Timeout pro Request

async function getSupabaseEdgeUrl(): Promise<string> {
  const storedUrl = await AsyncStorage.getItem("supabase_url").catch(
    () => null,
  );
  const runtimeUrl =
    storedUrl ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((typeof process !== "undefined"
      ? (process as any).env?.EXPO_PUBLIC_SUPABASE_URL
      : null) as string | null) ||
    null;

  if (runtimeUrl) {
    return `${runtimeUrl.replace(/\/$/, "")}/functions/v1`;
  }

  return CONFIG.API.SUPABASE_EDGE_URL;
}

// ✅ Timeout-Helper für Fetch
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") {
      throw new Error("Request timeout - Keine Antwort vom Server");
    }
    throw error;
  }
}

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
  jobIdFromScreen?: number | null,
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

      const edgeUrl = await getSupabaseEdgeUrl();
      const edgeAdminKey = await getEdgeAdminKey().catch(() => null);
      const res = await fetchWithTimeout(
        `${edgeUrl}/check-eas-build`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(edgeAdminKey ? { "x-k1w1-admin-key": edgeAdminKey } : {}),
          },
          body: JSON.stringify({ jobId: jobIdFromScreen }),
        },
        REQUEST_TIMEOUT_MS,
      );

      if (!isMountedRef.current) return;

      // ✅ Response parsen (mit Fallback)
      let json: any = null;
      try {
        json = await res.json();
      } catch (e) {
        console.warn("[useBuildStatus] JSON Parse fehlgeschlagen:", e);
        errorCountRef.current += 1;
        setErrorCount(errorCountRef.current);
        setLastError("Ungültige Server-Antwort");
        return;
      }

      // ✅ Fehlerfall
      if (!res.ok || !json || json.ok === false) {
        console.log("[useBuildStatus] ❌ Error Response:", json);
        const errorMsg = json?.error || `HTTP ${res.status}`;
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

      const mapped = mapBuildStatus(json.status);
      setStatus(mapped);

      const newDetails: BuildStatusDetails = {
        jobId: jobIdFromScreen,
        status: mapped,
        urls: json.urls ?? undefined,
        raw: json,
        runId: json.runId || json.run_id || null,
      };

      setDetails(newDetails);
      latestDetailsRef.current = newDetails;

      console.log("[useBuildStatus] ✅ Status:", mapped);

      // ✅ Polling bei finalen Status stoppen
      if (["success", "failed", "error"].includes(mapped)) {
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
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log("[useBuildStatus] 🛑 Hook unmounted, Polling gestoppt");
      }
    };
  }, [jobIdFromScreen, poll]);

  return {
    status,
    details,
    errorCount,
    lastError,
    isPolling: status === "queued" || status === "building",
  };
}
