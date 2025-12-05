// hooks/useBuildStatus.ts - REFACTORED WITHOUT ALERTS
// ✅ Timeout bei Netzwerkfehlern
// ✅ Error-Counter stoppt Polling nach 5 Fehlern
// ✅ Automatischer Stop bei finalen Status (success/failed)
// ✅ Besseres Status-Mapping
// ✅ KEINE Alerts im Hook - nur Callbacks (Clean Architecture)

import { useEffect, useState } from 'react';
import { CONFIG } from '../config';
import {
  type CheckEASBuildResponse,
  isCheckEASBuildResponse,
  validateSupabaseResponse,
} from '../lib/supabaseTypes';

export type BuildStatus =
  | 'idle'
  | 'queued'
  | 'building'
  | 'success'
  | 'failed'
  | 'error';

export type BuildStatusDetails = {
  jobId: number;
  status: BuildStatus;
  urls?: {
    html?: string | null;
    artifacts?: string | null;
  };
  raw?: any;
  errorMessage?: string;
};

/**
 * Callback-Typen für Build-Status-Events
 */
export type BuildStatusCallbacks = {
  onSuccess?: (details: BuildStatusDetails) => void;
  onFailure?: (details: BuildStatusDetails) => void;
  onError?: (errorMessage: string, errorCount: number) => void;
  onPollingStopped?: (reason: string) => void;
};

const POLL_INTERVAL_MS = 6000; // 6 Sekunden
const MAX_ERRORS = 5; // Nach 5 Fehlern stoppen
const REQUEST_TIMEOUT_MS = 10000; // 10 Sekunden Timeout pro Request

// ✅ Timeout-Helper für Fetch
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
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
    if (error?.name === 'AbortError') {
      throw new Error('Request timeout - Keine Antwort vom Server');
    }
    throw error;
  }
}

import { mapBuildStatus } from '../lib/buildStatusMapper';

/**
 * Hook für Build-Status-Polling mit Callbacks
 * 
 * ✅ CLEAN: Keine UI-Logik im Hook, nur Callbacks
 * 
 * @param jobIdFromScreen - Job-ID für Polling
 * @param callbacks - Optional: Event-Callbacks für UI-Updates
 * @returns Status, Details, Fehlerinfo
 */
export function useBuildStatus(
  jobIdFromScreen?: number | null,
  callbacks?: BuildStatusCallbacks
) {
  const [status, setStatus] = useState<BuildStatus>('idle');
  const [details, setDetails] = useState<BuildStatusDetails | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobIdFromScreen) {
      setStatus('idle');
      setDetails(null);
      setErrorCount(0);
      setLastError(null);
      return;
    }

    let interval: NodeJS.Timeout | null = null;
    let isMounted = true;
    let hasNotified = false;

    const poll = async () => {
      try {
        console.log(
          `[useBuildStatus] 🔄 Polling Job ${jobIdFromScreen}. (Fehler: ${errorCount}/${MAX_ERRORS})`
        );

        const res = await fetchWithTimeout(
          `${CONFIG.API.SUPABASE_EDGE_URL}/check-eas-build`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: jobIdFromScreen }),
          },
          REQUEST_TIMEOUT_MS
        );

        if (!isMounted) return;

        // ✅ TYPENSICHERHEIT: Response parsen und validieren
        let json: CheckEASBuildResponse;
        try {
          const rawJson = await res.json();
          json = validateSupabaseResponse(
            rawJson,
            isCheckEASBuildResponse,
            'Invalid check-eas-build response'
          );
        } catch (e) {
          console.warn('[useBuildStatus] Response-Validierung fehlgeschlagen:', e);
          setErrorCount((prev) => prev + 1);
          setLastError('Ungültige Server-Antwort');
          return;
        }

        // ✅ Fehlerfall
        if (!res.ok || json.ok === false) {
          console.log('[useBuildStatus] ❌ Error Response:', json);
          setErrorCount((prev) => prev + 1);
          setLastError(json.error || `HTTP ${res.status}`);

          if (errorCount + 1 >= MAX_ERRORS) {
            setStatus('error');
            if (interval) clearInterval(interval);
            if (!hasNotified) {
              hasNotified = true;
              callbacks?.onPollingStopped?.(
                `Zu viele Fehler beim Status-Abruf (${MAX_ERRORS}x). Letzter Fehler: ${
                  json?.error || 'Unbekannt'
                }`
              );
            }
          }
          return;
        }

        // ✅ Erfolg: Fehler-Counter zurücksetzen
        setErrorCount(0);
        setLastError(null);

        const mapped = mapBuildStatus(json.status);
        setStatus(mapped);

        const newDetails: BuildStatusDetails = {
          jobId: jobIdFromScreen,
          status: mapped,
          urls: json.urls ?? undefined,
          raw: json,
        };

        setDetails(newDetails);

        console.log('[useBuildStatus] ✅ Status:', mapped);

        // ✅ Polling bei finalen Status stoppen
        if (['success', 'failed', 'error'].includes(mapped)) {
          if (interval) {
            clearInterval(interval);
            console.log('[useBuildStatus] ⏸ Polling gestoppt (finaler Status)');
          }

          if (!hasNotified) {
            hasNotified = true;

            if (mapped === 'success') {
              callbacks?.onSuccess?.(newDetails);
            } else if (mapped === 'failed') {
              callbacks?.onFailure?.(newDetails);
            }
          }
        }
      } catch (e: any) {
        if (!isMounted) return;

        console.log('[useBuildStatus] ⚠️ Poll Error:', e?.message);
        setErrorCount((prev) => prev + 1);
        setLastError(e?.message || 'Netzwerkfehler');

        if (errorCount + 1 >= MAX_ERRORS) {
          setStatus('error');
          if (interval) clearInterval(interval);

          if (!hasNotified) {
            hasNotified = true;
            callbacks?.onError?.(
              e?.message || 'Netzwerkfehler',
              MAX_ERRORS
            );
            callbacks?.onPollingStopped?.(
              `Zu viele Netzwerkfehler (${MAX_ERRORS}x). Letzter Fehler: ${
                e?.message || 'Unbekannt'
              }`
            );
          }
        }
      }
    };

    // ✅ Sofort einmal pollen, dann Intervall
    poll();
    interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (interval) {
        clearInterval(interval);
        console.log('[useBuildStatus] 🛑  Hook unmounted, Polling gestoppt');
      }
    };
  }, [jobIdFromScreen, errorCount, callbacks]);

  return {
    status,
    details,
    errorCount,
    lastError,
    isPolling: status === 'queued' || status === 'building',
  };
}
