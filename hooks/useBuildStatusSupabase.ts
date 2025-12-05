import { useEffect, useState } from 'react';
import { ensureSupabaseClient } from '../lib/supabase';
import { mapBuildStatus, type BuildStatus } from '../lib/buildStatusMapper';
import {
  type BuildDetails,
  type CheckEASBuildResponse,
  isCheckEASBuildResponse,
  validateSupabaseResponse,
} from '../lib/supabaseTypes';

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

        // ✅ TYPENSICHERHEIT: Validiere Response
        try {
          const validatedData = validateSupabaseResponse(
            data,
            isCheckEASBuildResponse,
            'Invalid check-eas-build response'
          );

          const normalizedStatus = mapBuildStatus(validatedData.status);
          setStatus(normalizedStatus);
          
          // Map zu BuildDetails
          const buildDetails: BuildDetails = {
            id: validatedData.jobId,
            github_repo: '',
            status: validatedData.status,
            artifact_url: validatedData.download_url || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          setDetails(buildDetails);
        } catch (validationError: any) {
          console.error('[useBuildStatusSupabase] Validation error:', validationError);
          setError(validationError.message);
          setStatus('error');
        }
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
