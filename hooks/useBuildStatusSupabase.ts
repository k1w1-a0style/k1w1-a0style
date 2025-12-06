// hooks/useBuildStatusSupabase.ts - OPTIMIZED VERSION
// ✅ Error-Counter stoppt Polling nach 5 Fehlern
// ✅ Timeout bei Netzwerkfehlern
// ✅ Automatischer Stop bei finalen Status (success/failed/error)
// ✅ Besseres Error-Handling mit useRef statt State für Counter

import { useEffect, useState, useRef, useCallback } from 'react';
import { ensureSupabaseClient } from '../lib/supabase';
import { BuildStatus, mapBuildStatus } from '../lib/buildStatusMapper';
import { BuildDetails } from '../lib/supabaseTypes';

const POLL_INTERVAL_MS = 5000;
const MAX_ERRORS = 5; // Nach 5 Fehlern stoppen
const REQUEST_TIMEOUT_MS = 10000; // 10 Sekunden Timeout pro Request

// ✅ Timeout-Helper für Supabase Function Calls
async function invokeWithTimeout<T>(
  invokeFn: () => Promise<{ data: T | null; error: any }>,
  timeoutMs: number
): Promise<{ data: T | null; error: any }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await Promise.race([
      invokeFn(),
      new Promise<{ data: null; error: any }>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error('Request timeout - Keine Antwort vom Server'));
        }, { once: true });
      }),
    ]);
    clearTimeout(timeoutId);
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.message?.includes('timeout')) {
      return { data: null, error: { message: 'Request timeout - Keine Antwort vom Server' } };
    }
    throw error;
  }
}

export const useBuildStatusSupabase = (jobId: number | null) => {
  const [status, setStatus] = useState<BuildStatus>('idle');
  const [details, setDetails] = useState<BuildDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  // Use refs for values that shouldn't trigger re-renders
  const errorCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRequestPendingRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    if (!jobId) return;
    if (isRequestPendingRef.current) return;
    isRequestPendingRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      const supabase = await ensureSupabaseClient();
      
      // ✅ Timeout für Function Call
      const { data, error: fnError } = await invokeWithTimeout(
        () => supabase.functions.invoke('check-eas-build', {
          body: { jobId },
        }),
        REQUEST_TIMEOUT_MS
      );

      if (!isMountedRef.current) return;

      if (fnError) {
        console.log('[useBuildStatusSupabase] Function-Error:', fnError);
        const errorMsg = fnError.message ?? 'Fehler beim Abrufen des Build-Status';
        errorCountRef.current += 1;
        setErrorCount(errorCountRef.current);
        setError(errorMsg);
        
        if (errorCountRef.current >= MAX_ERRORS) {
          setStatus('error');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
        return;
      }

      if (!data) {
        console.log('[useBuildStatusSupabase] Keine Daten zurückgegeben');
        errorCountRef.current += 1;
        setErrorCount(errorCountRef.current);
        setError('Keine Antwort vom Server');
        
        if (errorCountRef.current >= MAX_ERRORS) {
          setStatus('error');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
        return;
      }

      // ✅ Erfolg: Fehler-Counter zurücksetzen
      errorCountRef.current = 0;
      setErrorCount(0);
      setError(null);

      const normalizedStatus = mapBuildStatus((data as any).status);
      setStatus(normalizedStatus);
      setDetails(data as BuildDetails);

      // ✅ Polling bei finalen Status stoppen
      if (['success', 'failed', 'error'].includes(normalizedStatus)) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          console.log('[useBuildStatusSupabase] ⏸ Polling gestoppt (finaler Status)');
        }
      }
    } catch (e: any) {
      if (!isMountedRef.current) return;
      console.log('[useBuildStatusSupabase] Fehler:', e);
      const errorMsg = e?.message ?? 'Unbekannter Fehler beim Abrufen des Build-Status';
      errorCountRef.current += 1;
      setErrorCount(errorCountRef.current);
      setError(errorMsg);
      
      if (errorCountRef.current >= MAX_ERRORS) {
        setStatus('error');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } finally {
      isRequestPendingRef.current = false;
      if (!isMountedRef.current) return;
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!jobId) {
      setStatus('idle');
      setDetails(null);
      setError(null);
      errorCountRef.current = 0;
      setErrorCount(0);
      isRequestPendingRef.current = false;
      return;
    }

    // Reset error tracking for new job
    errorCountRef.current = 0;
    setErrorCount(0);
    isRequestPendingRef.current = false;

    // ✅ Sofort einmal pollen, dann Intervall
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('[useBuildStatusSupabase] 🛑 Hook unmounted, Polling gestoppt');
      }
    };
  }, [jobId, fetchStatus]);

  return { status, details, error, isLoading, errorCount };
};
