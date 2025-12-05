import { useEffect, useState } from 'react';
import { ensureSupabaseClient } from '../lib/supabase';
import { BuildStatus, mapBuildStatus } from '../lib/buildStatusMapper';
import { BuildDetails } from '../lib/supabaseTypes';

const POLL_INTERVAL_MS = 5000;

export const useBuildStatusSupabase = (jobId: number | null) => {
  const [status, setStatus] = useState<BuildStatus>('pending');
  const [details, setDetails] = useState<BuildDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setStatus('pending');
      setDetails(null);
      setError(null);
      return;
    }

    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchStatus = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const supabase = await ensureSupabaseClient();
        const { data, error: fnError } = await supabase.functions.invoke(
          'check-eas-build',
          {
            body: { jobId },
          }
        );

        if (!isMounted) return;

        if (fnError) {
          console.log('[useBuildStatusSupabase] Function-Error:', fnError);
          setError(fnError.message ?? 'Fehler beim Abrufen des Build-Status');
          setStatus('error');
          return;
        }

        if (!data) {
          console.log('[useBuildStatusSupabase] Keine Daten zurückgegeben');
          setError('Keine Antwort vom Server');
          setStatus('error');
          return;
        }

        const normalizedStatus = mapBuildStatus((data as any).status);
        setStatus(normalizedStatus);
        setDetails(data as BuildDetails);
      } catch (e: any) {
        if (!isMounted) return;
        console.log('[useBuildStatusSupabase] Fehler:', e);
        setError(
          e?.message ?? 'Unbekannter Fehler beim Abrufen des Build-Status'
        );
        setStatus('error');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    // Initial
    fetchStatus();
    // Polling
    intervalId = setInterval(fetchStatus, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId]);

  return { status, details, error, isLoading };
};
