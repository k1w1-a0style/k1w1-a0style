import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProject } from './ProjectContext';

export interface GitHubContextValue {
  activeRepo: string | null;
  setActiveRepo: (repo: string | null) => Promise<void>;
  recentRepos: string[];
  addRecentRepo: (repo: string) => void;
  clearRecentRepos: () => void;
}

const STORAGE_KEY_RECENT = '@k1w1_recent_repos';

const GitHubContext = createContext<GitHubContextValue | undefined>(undefined);

export const GitHubProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { projectData } = useProject();
  const [activeRepo, setActiveRepoState] = useState<string | null>(null);
  const [recentRepos, setRecentReposState] = useState<string[]>([]);

  // 1. Lade Recent Repos (Global)
  useEffect(() => {
    const loadRecent = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY_RECENT);
        if (raw) setRecentReposState(JSON.parse(raw));
      } catch {
        // ignore
      }
    };
    loadRecent();
  }, []);

  // 2. Lade/Speichere Active Repo PRO PROJEKT ID
  useEffect(() => {
    let isMounted = true;
    const loadActiveForProject = async () => {
      if (!projectData?.id) {
        if (isMounted) setActiveRepoState(null);
        return;
      }
      const key = `active_repo_${projectData.id}`;
      try {
        const stored = await AsyncStorage.getItem(key);
        if (isMounted) setActiveRepoState(stored);
      } catch (e) {
        console.warn('Failed to load active repo', e);
      }
    };
    loadActiveForProject();
    return () => {
      isMounted = false;
    };
  }, [projectData?.id]);

  const setActiveRepo = useCallback(
    async (repo: string | null) => {
      setActiveRepoState(repo);
      if (projectData?.id) {
        const key = `active_repo_${projectData.id}`;
        try {
          if (repo) {
            await AsyncStorage.setItem(key, repo);
          } else {
            await AsyncStorage.removeItem(key);
          }
        } catch (e) {
          console.warn('Failed to save active repo', e);
        }
      }
    },
    [projectData?.id],
  );

  const addRecentRepo = useCallback((repo: string) => {
    setRecentReposState(prev => {
      const filtered = prev.filter(r => r !== repo);
      const next = [repo, ...filtered].slice(0, 10);
      AsyncStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(next)).catch(
        () => {},
      );
      return next;
    });
  }, []);

  const clearRecentRepos = useCallback(() => {
    setRecentReposState([]);
    AsyncStorage.removeItem(STORAGE_KEY_RECENT).catch(() => {});
  }, []);

  return (
    <GitHubContext.Provider
      value={{
        activeRepo,
        setActiveRepo,
        recentRepos,
        addRecentRepo,
        clearRecentRepos,
      }}
    >
      {children}
    </GitHubContext.Provider>
  );
};

export const useGitHub = (): GitHubContextValue => {
  const ctx = useContext(GitHubContext);
  if (!ctx) throw new Error('useGitHub must be used within GitHubProvider');
  return ctx;
};
