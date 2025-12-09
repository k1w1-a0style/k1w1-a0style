// hooks/useBuildHistory.ts
// React Hook für Build-Historie Management

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { BuildHistoryEntry } from '../contexts/types';
import {
  loadBuildHistory,
  addBuildToHistory,
  updateBuildInHistory,
  deleteBuildFromHistory,
  clearBuildHistory,
  getBuildStats,
} from '../lib/buildHistoryStorage';

export interface UseBuildHistoryResult {
  history: BuildHistoryEntry[];
  isLoading: boolean;
  stats: {
    total: number;
    success: number;
    failed: number;
    building: number;
  };
  // Actions
  startBuild: (jobId: number, repoName: string, buildProfile?: string) => Promise<void>;
  completeBuild: (
    jobId: number, 
    status: 'success' | 'failed' | 'error',
    details?: {
      artifactUrl?: string | null;
      htmlUrl?: string | null;
      errorMessage?: string;
    }
  ) => Promise<void>;
  deleteEntry: (jobId: number) => Promise<void>;
  clearHistory: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useBuildHistory(): UseBuildHistoryResult {
  const [history, setHistory] = useState<BuildHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    building: 0,
  });

  // Historie laden
  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const [loadedHistory, loadedStats] = await Promise.all([
        loadBuildHistory(),
        getBuildStats(),
      ]);
      setHistory(loadedHistory);
      setStats(loadedStats);
    } catch (error) {
      console.error('[useBuildHistory] Fehler beim Laden:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial laden
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Neuen Build starten
  const startBuild = useCallback(async (
    jobId: number, 
    repoName: string,
    buildProfile: string = 'preview'
  ) => {
    const entry: BuildHistoryEntry = {
      id: uuidv4(),
      jobId,
      repoName,
      status: 'queued',
      startedAt: new Date().toISOString(),
      buildProfile,
    };
    
    await addBuildToHistory(entry);
    await loadHistory();
  }, [loadHistory]);

  // Build abschließen
  const completeBuild = useCallback(async (
    jobId: number,
    status: 'success' | 'failed' | 'error',
    details?: {
      artifactUrl?: string | null;
      htmlUrl?: string | null;
      errorMessage?: string;
    }
  ) => {
    const entry = history.find(e => e.jobId === jobId);
    if (!entry) {
      console.warn(`[useBuildHistory] Build #${jobId} nicht gefunden`);
      return;
    }

    const completedAt = new Date().toISOString();
    const startedAt = new Date(entry.startedAt).getTime();
    const durationMs = Date.now() - startedAt;

    await updateBuildInHistory(jobId, {
      status,
      completedAt,
      durationMs,
      artifactUrl: details?.artifactUrl,
      htmlUrl: details?.htmlUrl,
      errorMessage: details?.errorMessage,
    });
    
    await loadHistory();
  }, [history, loadHistory]);

  // Eintrag löschen
  const deleteEntry = useCallback(async (jobId: number) => {
    await deleteBuildFromHistory(jobId);
    await loadHistory();
  }, [loadHistory]);

  // Historie leeren
  const clearHistoryAction = useCallback(async () => {
    await clearBuildHistory();
    await loadHistory();
  }, [loadHistory]);

  return {
    history,
    isLoading,
    stats,
    startBuild,
    completeBuild,
    deleteEntry,
    clearHistory: clearHistoryAction,
    refresh: loadHistory,
  };
}
