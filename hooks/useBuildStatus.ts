// hooks/useBuildStatus.ts - MIT VOLLSTÄNDIGEM CLEANUP (C)
// ✅ AbortController für jeden Request
// ✅ Intervalle und Timeouts werden bereinigt
// ✅ Ref für aktuelle Job-ID verhindert Race Conditions
// ✅ Keine Memory Leaks beim Unmount
// ✅ Alert-Benachrichtigungen bei finalem Status / Fehlern

import { useEffect, useState, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { CONFIG } from '../config';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;
  errorMessage?: string;
};

const POLL_INTERVAL_MS = 6000; // 6 Sekunden
const MAX_ERRORS = 5; // Nach 5 Fehlern stoppen
const REQUEST_TIMEOUT_MS = 10000; // 10 Sekunden Timeout pro Request

// ✅ Status-Mapping (GitHub Actions / Supabase -> k1w1)
function mapStatus(rawStatus: string): BuildStatus {
  const status = (rawStatus || '').toString().toLowerCase();
  switch (status) {
    case 'queued':
    case 'pending':
    case 'waiting':
      return 'queued';
    case 'building':
    case 'in_progress':
    case 'running':
      return 'building';
    case 'success':
    case 'completed':
    case 'succeeded':
      return 'success';
    case 'failed':
    case 'failure':
    case 'cancelled':
      return 'failed';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
}

export function useBuildStatus(jobIdFromScreen?: number | null) {
  const [status, setStatus] = useState<BuildStatus>('idle');
  const [details, setDetails] = useState<BuildStatusDetails | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  // Refs für Cleanup / Race-Condition-Schutz
  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentJobIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const hasAlertedRef = useRef(false);

  // ✅ Cleanup-Funktion
  const cleanup = useCallback(() => {
    // Abort laufende Requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear Interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Clear Timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    hasAlertedRef.current = false;
  }, []);

  // ✅ Fetch mit AbortController & Timeout
  const fetchStatus = useCallback(
    async (jobId: number): Promise<BuildStatusDetails | null> => {
      // alten Request abbrechen
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutRef.current = setTimeout(() => {
            reject(new Error('Request timeout - Keine Antwort vom Server'));
          }, REQUEST_TIMEOUT_MS);
        });

        const fetchPromise = fetch(
          `${CONFIG.API.SUPABASE_EDGE_URL}/check-eas-build`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId }),
            signal: controller.signal,
          },
        );

        const response = (await Promise.race([
          fetchPromise,
          timeoutPromise,
        ])) as Response;

        // Timeout zurücksetzen
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();

        if (!json || json.ok === false) {
          throw new Error(json?.error || 'Invalid server response');
        }

        const mappedStatus = mapStatus(json.status);

        return {
          jobId,
          status: mappedStatus,
          urls: json.urls ?? undefined,
          raw: json,
        };
      } catch (error: any) {
        // Aborted ignorieren
        if (error?.name === 'AbortError') {
          return null;
        }

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        throw error;
      } finally {
        // Controller aufräumen, wenn dieser Request fertig ist
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [],
  );

  // ✅ Polling-Logik
  const pollStatus = useCallback(
    async (jobId: number) => {
      if (!isMountedRef.current || currentJobIdRef.current !== jobId) {
        return;
      }

      try {
        console.log(
          `[useBuildStatus] 🔄 Polling Job ${jobId}. (Fehler: ${errorCount}/${MAX_ERRORS})`,
        );

        const result = await fetchStatus(jobId);

        if (!isMountedRef.current || currentJobIdRef.current !== jobId) {
          return;
        }

        if (!result) {
          // Aborted oder kein Ergebnis
          return;
        }

        // ✅ Erfolg: Fehler-Counter zurücksetzen
        setErrorCount(0);
        setLastError(null);
        setStatus(result.status);
        setDetails(result);

        console.log('[useBuildStatus] ✅ Status:', result.status);

        // ✅ Polling bei finalen Status stoppen
        if (['success', 'failed', 'error'].includes(result.status)) {
          cleanup();

          if (!hasAlertedRef.current) {
            hasAlertedRef.current = true;

            if (result.status === 'success') {
              Alert.alert(
                '✅ Build erfolgreich!',
                result.urls?.artifacts
                  ? 'Dein Build wurde erfolgreich erstellt.\n\nKlicke auf den Build-Button für den Download.'
                  : 'Build wurde erfolgreich abgeschlossen.',
                [{ text: 'OK', style: 'default' }],
              );
            } else if (result.status === 'failed') {
              Alert.alert(
                '❌ Build fehlgeschlagen',
                'Der Build ist fehlgeschlagen. Prüfe die Logs in GitHub Actions.',
                [{ text: 'OK', style: 'default' }],
              );
            }
          }
        }
      } catch (error: any) {
        if (!isMountedRef.current || currentJobIdRef.current !== jobId) {
          return;
        }

        console.log('[useBuildStatus] ⚠️ Poll Error:', error?.message);
        const newErrorCount = errorCount + 1;
        setErrorCount(newErrorCount);
        setLastError(error?.message || 'Netzwerkfehler');

        if (newErrorCount >= MAX_ERRORS) {
          setStatus('error');
          cleanup();

          if (!hasAlertedRef.current) {
            hasAlertedRef.current = true;
            Alert.alert(
              '❌ Polling gestoppt',
              `Zu viele Netzwerkfehler (${MAX_ERRORS}x).\n\nLetzter Fehler: ${
                error?.message || 'Unbekannt'
              }\n\nBitte prüfe deine Internetverbindung und Supabase-Konfiguration.`,
              [{ text: 'OK', style: 'default' }],
            );
          }
        }
      }
    },
    [errorCount, fetchStatus, cleanup],
  );

  useEffect(() => {
    isMountedRef.current = true;
    currentJobIdRef.current = jobIdFromScreen ?? null;

    // Reset state, wenn keine jobId
    if (!jobIdFromScreen) {
      setStatus('idle');
      setDetails(null);
      setErrorCount(0);
      setLastError(null);
      cleanup();
      return;
    }

    // Start Polling
    const startPolling = () => {
      // Sofort einmal pollen
      pollStatus(jobIdFromScreen);

      // Dann Intervall starten
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(() => {
        if (
          isMountedRef.current &&
          currentJobIdRef.current === jobIdFromScreen
        ) {
          pollStatus(jobIdFromScreen);
        }
      }, POLL_INTERVAL_MS);
    };

    startPolling();

    // Cleanup bei Unmount / Job-ID-Wechsel
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [jobIdFromScreen, pollStatus, cleanup]);

  return {
    status,
    details,
    errorCount,
    lastError,
    isPolling: status === 'queued' || status === 'building',
  };
}
