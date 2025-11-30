// hooks/useBuildStatus.ts - MIT ALLEN FIXES (C)
// ✅ Timeout bei Netzwerkfehlern
// ✅ Error-Counter stoppt Polling nach 5 Fehlern
// ✅ Automatischer Stop bei finalen Status (success/failed)
// ✅ Besseres Status-Mapping
// ✅ Alert-Benachrichtigung bei Polling-Stop

import { useEffect, useState } from 'react';
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
  raw?: any;
  errorMessage?: string;
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
    let hasAlerted = false;

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

        // ✅ Response parsen (mit Fallback)
        let json: any = null;
        try {
          json = await res.json();
        } catch (e) {
          console.warn('[useBuildStatus] JSON Parse fehlgeschlagen:', e);
          setErrorCount((prev) => prev + 1);
          setLastError('Ungültige Server-Antwort');
          return;
        }

        // ✅ Fehlerfall
        if (!res.ok || !json || json.ok === false) {
          console.log('[useBuildStatus] ❌ Error Response:', json);
          setErrorCount((prev) => prev + 1);
          setLastError(json?.error || `HTTP ${res.status}`);

          if (errorCount + 1 >= MAX_ERRORS) {
            setStatus('error');
            if (interval) clearInterval(interval);
            if (!hasAlerted) {
              hasAlerted = true;
              Alert.alert(
                '❌ Polling gestoppt',
                `Zu viele Fehler beim Status-Abruf (${MAX_ERRORS}x).\n\nLetzter Fehler: ${
                  json?.error || 'Unbekannt'
                }\n\nBitte prüfe deine Supabase-Verbindung.`,
                [{ text: 'OK', style: 'default' }]
              );
            }
          }
          return;
        }

        // ✅ Erfolg: Fehler-Counter zurücksetzen
        setErrorCount(0);
        setLastError(null);

        const mapped = mapStatus(json.status);
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

          if (!hasAlerted) {
            hasAlerted = true;

            if (mapped === 'success') {
              Alert.alert(
                '✅ Build erfolgreich!',
                json.urls?.artifacts
                  ? 'Dein Build wurde erfolgreich erstellt.\n\nKlicke auf den Build-Button für den Download.'
                  : 'Build wurde erfolgreich abgeschlossen.',
                [{ text: 'OK', style: 'default' }]
              );
            } else if (mapped === 'failed') {
              Alert.alert(
                '❌ Build fehlgeschlagen',
                'Der Build ist fehlgeschlagen. Prüfe die Logs in GitHub Actions.',
                [{ text: 'OK', style: 'default' }]
              );
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

          if (!hasAlerted) {
            hasAlerted = true;
            Alert.alert(
              '❌ Polling gestoppt',
              `Zu viele Netzwerkfehler (${MAX_ERRORS}x).\n\nLetzter Fehler: ${
                e?.message || 'Unbekannt'
              }\n\nBitte prüfe deine Internetverbindung und Supabase-Konfiguration.`,
              [{ text: 'OK', style: 'default' }]
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
  }, [jobIdFromScreen, errorCount]);

  return {
    status,
    details,
    errorCount,
    lastError,
    isPolling: status === 'queued' || status === 'building',
  };
}
