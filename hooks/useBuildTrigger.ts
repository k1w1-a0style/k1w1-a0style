// hooks/useBuildTrigger.ts - Extracted build trigger logic from CustomHeader
import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { ensureSupabaseClient } from '../lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectFile } from '../contexts/types';

const POLLING_INTERVAL_MS = 15000;

interface UseBuildTriggerProps {
  projectFiles: ProjectFile[];
  getGitHubToken: () => Promise<string | null>;
  getExpoToken: () => Promise<string | null>;
  getGitHubRepo: () => Promise<string | null>;
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

      console.log('Poll Status:', data.status);
      switch (data.status) {
        case 'pending':
          setBuildStatus('Job erstellt...');
          break;
        case 'pushed':
          setBuildStatus('Code gepusht...');
          break;
        case 'building':
          setBuildStatus('Build läuft...');
          break;
        case 'success':
        case 'completed':
          setBuildStatus('Build erfolgreich!');
          setDownloadUrl(data.download_url || null);
          setIsPolling(false);
          setCurrentJobId(null);
          break;
        case 'error':
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

      if (!response.ok || responseData.success === false) {
        const errorMessage = responseData.error || 'Unbekannter Fehler';
        const errorStep = responseData.step || 'UNKNOWN';
        const errorHint = responseData.hint || '';

        let displayMessage = `Build-Fehler (${errorStep}):\n\n${errorMessage}`;
        if (errorHint) {
          displayMessage += `\n\n💡 Tipp:\n${errorHint}`;
        }

        console.error('❌ Build Fehler:', { errorMessage, errorStep, errorHint });

        Alert.alert('❌ Build fehlgeschlagen', displayMessage, [{ text: 'OK', style: 'default' }]);

        throw new Error(errorMessage);
      }

      console.log('✅ Build gestartet:', responseData);
      setCurrentJobId(responseData.job_id);
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
