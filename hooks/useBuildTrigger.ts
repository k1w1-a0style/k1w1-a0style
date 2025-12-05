// hooks/useBuildTrigger.ts - REFACTORED WITH TYPE SAFETY
import { useState, useRef, useCallback, useEffect } from 'react';
import { ensureSupabaseClient } from '../lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectFile } from '../contexts/types';
import {
  type TriggerEASBuildResponse,
  type CheckEASBuildResponse,
  isTriggerEASBuildResponse,
  isCheckEASBuildResponse,
  validateSupabaseResponse,
} from '../lib/supabaseTypes';

const POLLING_INTERVAL_MS = 15000;

/**
 * Callbacks für Build-Trigger-Events
 */
export interface BuildTriggerCallbacks {
  onBuildError?: (error: string, hint?: string) => void;
  onBuildSuccess?: (downloadUrl: string | null) => void;
}

interface UseBuildTriggerProps {
  projectFiles: ProjectFile[];
  getGitHubToken: () => Promise<string | null>;
  getExpoToken: () => Promise<string | null>;
  getGitHubRepo: () => Promise<string | null>;
  callbacks?: BuildTriggerCallbacks;
}

interface BuildTriggerResult {
  isTriggeringBuild: boolean;
  isPolling: boolean;
  buildStatus: string | null;
  downloadUrl: string | null;
  triggerBuild: () => Promise<void>;
}

export function useBuildTrigger({
  projectFiles,
  getGitHubToken,
  getExpoToken,
  getGitHubRepo,
  callbacks,
}: UseBuildTriggerProps): BuildTriggerResult {
  const [isTriggeringBuild, setIsTriggeringBuild] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<number | null>(null);
  const [buildStatus, setBuildStatus] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const supabaseRef = useRef<SupabaseClient | null>(null);
  const easTokenRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Polling-Logik
  const pollSupabaseBuild = useCallback(async () => {
    if (!currentJobId) {
      setIsPolling(false);
      return;
    }

    if (!supabaseRef.current) {
      try {
        supabaseRef.current = await ensureSupabaseClient();
      } catch (e) {
        setBuildStatus('Supabase-Fehler');
        setIsPolling(false);
        return;
      }
    }

    if (!easTokenRef.current) {
      const token = await getExpoToken();
      if (!token) {
        setBuildStatus('Expo Token fehlt');
        setIsPolling(false);
        return;
      }
      easTokenRef.current = token;
    }

      try {
        const { data, error } = await supabaseRef.current.functions.invoke('check-eas-build', {
          body: { jobId: currentJobId, easToken: easTokenRef.current },
        });

        if (error) throw error;

        // ✅ TYPENSICHERHEIT: Validiere Response
        const validatedData = validateSupabaseResponse(
          data,
          isCheckEASBuildResponse,
          'Invalid check-eas-build response'
        );

        console.log('Poll Status:', validatedData.status);
        switch (validatedData.status.toLowerCase()) {
          case 'pending':
            setBuildStatus('Job erstellt...');
            break;
          case 'pushed':
            setBuildStatus('Code gepusht...');
            break;
          case 'building':
          case 'in_progress':
            setBuildStatus('Build läuft...');
            break;
          case 'success':
          case 'completed':
            setBuildStatus('Build erfolgreich!');
            setDownloadUrl(validatedData.download_url || null);
            setIsPolling(false);
            setCurrentJobId(null);
            break;
          case 'error':
          case 'failed':
            setBuildStatus('Build fehlgeschlagen!');
            setIsPolling(false);
            setCurrentJobId(null);
            break;
        }
      } catch (pollError: any) {
        console.error('Polling-Fehler:', pollError);
        setBuildStatus('Polling-Fehler');
        setIsPolling(false);
        setCurrentJobId(null);
      }
  }, [currentJobId, getExpoToken]);

  // Polling-Effect
  useEffect(() => {
    if (isPolling && currentJobId) {
      console.log(`POLLING GESTARTET (Supabase) für Job ${currentJobId}`);
      pollSupabaseBuild(); // Sofort pollen
      pollingIntervalRef.current = setInterval(pollSupabaseBuild, POLLING_INTERVAL_MS);
    } else if (!isPolling && pollingIntervalRef.current) {
      console.log('POLLING GESTOPPT.');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isPolling, currentJobId, pollSupabaseBuild]);

  // Build Trigger
  const triggerBuild = useCallback(async () => {
    console.log('EAS Build Button gedrückt (useBuildTrigger)');
    setIsTriggeringBuild(true);
    setBuildStatus('Code wird vorbereitet...');
    setDownloadUrl(null);

    try {
      if (!projectFiles || projectFiles.length === 0) {
        throw new Error('Projekt ist leer. Es gibt keine Dateien zum Bauen.');
      }

      const easToken = await getExpoToken();
      const GITHUB_TOKEN = await getGitHubToken();
      const GITHUB_REPO = await getGitHubRepo();

      easTokenRef.current = easToken;

      if (!easToken || !GITHUB_REPO || !GITHUB_TOKEN) {
        throw new Error("Credentials fehlen. Bitte 'Verbindungen' prüfen.");
      }

      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error('Supabase-Konfiguration fehlt.');
      }

      console.log(`Pushe ${projectFiles.length} Dateien & triggere Build für ${GITHUB_REPO}...`);

      const response = await fetch(`${SUPABASE_URL}/functions/v1/trigger-eas-build`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          githubRepo: GITHUB_REPO,
          githubToken: GITHUB_TOKEN,
          files: projectFiles,
        }),
      });

      const responseData = await response.json();
      console.log('📥 Build Response:', responseData);

      // ✅ TYPENSICHERHEIT: Validiere Response
      const validatedData = validateSupabaseResponse(
        responseData,
        isTriggerEASBuildResponse,
        'Invalid trigger-eas-build response'
      );

      if (!response.ok || validatedData.success === false) {
        const errorMessage = validatedData.error || 'Unbekannter Fehler';
        const errorStep = validatedData.step || 'UNKNOWN';
        const errorHint = validatedData.hint || '';

        console.error('❌ Build Fehler:', { errorMessage, errorStep, errorHint });

        callbacks?.onBuildError?.(errorMessage, errorHint);

        throw new Error(errorMessage);
      }

      if (!validatedData.job_id) {
        throw new Error('Keine Job-ID in Response');
      }

      console.log('✅ Build gestartet:', validatedData);
      setCurrentJobId(validatedData.job_id);
      setIsPolling(true);
      setBuildStatus('Code gepusht. Warte auf Build...');
    } catch (err: any) {
      console.error('Fehler in triggerBuild:', err);
      setBuildStatus(null);
    } finally {
      setIsTriggeringBuild(false);
    }
  }, [projectFiles, getExpoToken, getGitHubToken, getGitHubRepo]);

  return {
    isTriggeringBuild,
    isPolling,
    buildStatus,
    downloadUrl,
    triggerBuild,
  };
}
