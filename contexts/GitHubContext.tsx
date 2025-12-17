import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type GitHubContextValue = {
  activeRepo: string | null;
  setActiveRepo: (repo: string | null) => void;
  recentRepos: string[];
  addRecentRepo: (repo: string) => void;
  clearRecentRepos: () => void;
};

const STORAGE_KEY = 'k1w1_github_recent_repos';

const GitHubContext = createContext<GitHubContextValue | undefined>(undefined);

export const GitHubProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeRepo, setActiveRepoState] = useState<string | null>(null);
  const [recentRepos, setRecentRepos] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setRecentRepos(parsed);
          }
        }
      } catch (e) {
        console.log(
          '[GitHubContext] Fehler beim Laden der Recent Repos',
          e
        );
      }
    };

    load();
  }, []);

  const persist = useCallback(async (repos: string[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(repos));
    } catch (e) {
      console.error(
        '[GitHubContext] Fehler beim Speichern der Recent Repos',
        e
      );
    }
  }, []);

  const setActiveRepo = useCallback((repo: string | null) => {
    setActiveRepoState(repo);
    if (repo) {
      setRecentRepos((prev) => {
        const filtered = prev.filter((r) => r !== repo);
        const next = [repo, ...filtered].slice(0, 10);
        // ✅ FIX: persist async aufrufen, aber nicht await (non-blocking)
        persist(next).catch(err => {
          console.error('[GitHubContext] Fehler beim Persistieren:', err);
        });
        return next;
      });
    }
  }, [persist]);

  const addRecentRepo = useCallback((repo: string) => {
    setRecentRepos((prev) => {
      const filtered = prev.filter((r) => r !== repo);
      const next = [repo, ...filtered].slice(0, 10);
      // ✅ FIX: persist async aufrufen, aber nicht await (non-blocking)
      persist(next).catch(err => {
        console.error('[GitHubContext] Fehler beim Persistieren:', err);
      });
      return next;
    });
  }, [persist]);

  const clearRecentRepos = useCallback(() => {
    setRecentRepos([]);
    // ✅ FIX: persist async aufrufen
    persist([]).catch(err => {
      console.error('[GitHubContext] Fehler beim Persistieren:', err);
    });
  }, [persist]);

  const value: GitHubContextValue = {
    activeRepo,
    setActiveRepo,
    recentRepos,
    addRecentRepo,
    clearRecentRepos,
  };

  return (
    <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>
  );
};

export const useGitHub = (): GitHubContextValue => {
  const ctx = useContext(GitHubContext);
  if (!ctx) {
    throw new Error(
      'useGitHub muss innerhalb eines GitHubProvider verwendet werden'
    );
  }
  return ctx;
};
