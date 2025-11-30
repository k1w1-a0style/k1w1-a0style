import { useEffect, useState } from 'react';
import { ensureSupabaseClient } from '../lib/supabase';

export type BuildStatus =
  | 'pending'
  | 'queued'
  | 'building'
  | 'completed'
  | 'error'
  | 'failed';

export interface BuildDetails {
  id: number;
  github_repo?: string;
  build_profile?: string;
  build_type?: string;
  status: string;
  eas_build_id?: string | null;
  github_run_id?: string | null;
  artifact_url?: string | null;
  created_at?: string;
  updated_at?: string;
  // Fallback für zusätzliche Felder aus der DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

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

    const mapStatus = (raw: string | undefined): BuildStatus => {
      const s = (raw ?? '').toLowerCase();

      switch (s) {
        case 'queued':
        case 'pending':
          return 'queued';
        case 'running':
        case 'building':
        case 'in_progress':
          return 'building';
        case 'completed':
        case 'success':
        case 'succeeded':
          return 'completed';
        case 'failed':
        case 'failure':
          return 'failed';
        default:
          return 'error';
      }
    };

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

        const normalizedStatus = mapStatus((data as any).status);
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
