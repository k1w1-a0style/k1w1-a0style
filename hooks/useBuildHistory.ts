// hooks/useBuildHistory.ts
// React Hook für Build-Historie Management

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '../lib/logger';
import type { BuildHistoryEntry } from '../shared/types/build';
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
  startBuild: (jobId: string, repoName: string, buildProfile?: string) => Promise<void>;
  completeBuild: (
    jobId: string,
    status: 'success' | 'failed' | 'error',
    details?: {
      artifactUrl?: string | null;
      htmlUrl?: string | null;
      errorMessage?: string;
    }
  ) => Promise<void>;
  deleteEntry: (jobId: string) => Promise<void>;
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
    } catch (err) {
      logger.error('Fehler beim Laden der Build-Historie', { err });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const startBuild = useCallback(async (jobId: string, repoName: string, buildProfile?: string) => {
    const entry: BuildHistoryEntry = {
      id: uuidv4(),
      jobId,
      repoName,
      buildProfile: buildProfile ?? 'default',
      status: 'building',
      startedAt: new Date().toISOString(),
      artifactUrl: null,
      htmlUrl: null,
      // Optional fields (keep undefined instead of null to match BuildHistoryEntry)
      completedAt: undefined,
      errorMessage: undefined,
    };

    await addBuildToHistory(entry);
    await loadHistory();
  }, [loadHistory]);

  const completeBuild = useCallback(async (
    jobId: string,
    status: 'success' | 'failed' | 'error',
    details?: {
      artifactUrl?: string | null;
      htmlUrl?: string | null;
      errorMessage?: string;
    }
  ) => {
    await updateBuildInHistory(jobId, {
      status,
      completedAt: new Date().toISOString(),
      artifactUrl: details?.artifactUrl ?? null,
      htmlUrl: details?.htmlUrl ?? null,
      errorMessage: details?.errorMessage ?? undefined,
    });
    await loadHistory();
  }, [loadHistory]);

  const deleteEntry = useCallback(async (jobId: string) => {
    await deleteBuildFromHistory(jobId);
    await loadHistory();
  }, [loadHistory]);

  const clearHistory = useCallback(async () => {
    await clearBuildHistory();
    await loadHistory();
  }, [loadHistory]);

  const refresh = useCallback(async () => {
    await loadHistory();
  }, [loadHistory]);

  return {
    history,
    isLoading,
    stats,
    startBuild,
    completeBuild,
    deleteEntry,
    clearHistory,
    refresh,
  };
}
