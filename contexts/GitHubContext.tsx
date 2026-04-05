import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { logger } from "../lib/logger";
import { runCleanupTask } from "../lib/safeCleanup";

import { GITHUB_STORAGE_KEYS } from "../shared/constants/github";

import { useProject } from "./ProjectContext";
import {
  mergeRecentRepo,
  normalizeLinkedGitHubValue,
  normalizeStoredRecentRepos,
} from "./githubContextHelpers";

type GitHubContextValue = {
  activeRepo: string | null;
  setActiveRepo: (repo: string | null) => void;
  activeBranch: string | null;
  setActiveBranch: (branch: string | null) => void;
  recentRepos: string[];
  addRecentRepo: (repo: string) => void;
  clearRecentRepos: () => void;
};

const RECENT_REPOS_KEY = GITHUB_STORAGE_KEYS.RECENT_REPOS;
const ACTIVE_REPO_KEY = GITHUB_STORAGE_KEYS.ACTIVE_REPO;
const ACTIVE_BRANCH_KEY = GITHUB_STORAGE_KEYS.ACTIVE_BRANCH;

const GitHubContext = createContext<GitHubContextValue | undefined>(undefined);

export const GitHubProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { projectData, setLinkedRepo } = useProject();
  const [recentRepos, setRecentRepos] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [storedRecent] =
          await Promise.all([
            AsyncStorage.getItem(RECENT_REPOS_KEY),
          ]);

        if (storedRecent) {
          const parsed = JSON.parse(storedRecent) as unknown;
          setRecentRepos(normalizeStoredRecentRepos(parsed));
        }
        await Promise.all([
          runCleanupTask(
            () => AsyncStorage.removeItem(ACTIVE_REPO_KEY),
            "[GitHubContext] remove deprecated active repo failed",
          ),
          runCleanupTask(
            () => AsyncStorage.removeItem(ACTIVE_BRANCH_KEY),
            "[GitHubContext] remove deprecated active branch failed",
          ),
        ]);
      } catch (e) {
        logger.error("[GitHubContext] Fehler beim Laden", { err: e });
      } finally {
        setHydrated(true);
      }
    };
    load();
  }, []);

  const persistRecent = useCallback(async (repos: string[]) => {
    await AsyncStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(repos));
  }, []);

  const setActiveRepo = useCallback(
    (repo: string | null) => {
      const normalizedRepo = normalizeLinkedGitHubValue(repo);
      const currentRepo = normalizeLinkedGitHubValue(projectData?.linkedRepo);
      if (normalizedRepo === currentRepo) return;
      void setLinkedRepo(normalizedRepo, undefined).catch((e) => {
        logger.error("[GitHubContext] LinkedRepo update failed", { err: e });
      });
      if (repo) {
        setRecentRepos((prev) => {
          const next = mergeRecentRepo(prev, repo);
          persistRecent(next).catch((e) => {
            logger.error("[GitHubContext] RecentRepos persist failed", { err: e });
          });
          return next;
        });
      }
    },
    [persistRecent, projectData?.linkedRepo, setLinkedRepo],
  );

  const setActiveBranch = useCallback(
    (branch: string | null) => {
      const repo = normalizeLinkedGitHubValue(projectData?.linkedRepo);
      if (!repo) return;
      const normalizedBranch = normalizeLinkedGitHubValue(branch);
      const currentBranch = normalizeLinkedGitHubValue(projectData?.linkedBranch);
      if (normalizedBranch === currentBranch) return;
      void setLinkedRepo(repo, normalizedBranch).catch((e) => {
        logger.error("[GitHubContext] LinkedBranch update failed", { err: e });
      });
    },
    [projectData?.linkedRepo, projectData?.linkedBranch, setLinkedRepo],
  );

  const activeRepo = useMemo(
    () => (hydrated ? normalizeLinkedGitHubValue(projectData?.linkedRepo) : null),
    [hydrated, projectData?.linkedRepo],
  );
  const activeBranch = useMemo(
    () => (hydrated ? normalizeLinkedGitHubValue(projectData?.linkedBranch) : null),
    [hydrated, projectData?.linkedBranch],
  );

  const addRecentRepo = useCallback(
    (repo: string) => {
      if (!repo) return;
      setRecentRepos((prev) => {
        const next = mergeRecentRepo(prev, repo);
        persistRecent(next).catch((e) => {
          logger.error("[GitHubContext] RecentRepos persist failed", { err: e });
        });
        return next;
      });
    },
    [persistRecent],
  );

  const clearRecentRepos = useCallback(() => {
    setRecentRepos([]);
    persistRecent([]).catch((e) =>
      logger.error("[GitHubContext] clear persist failed", { err: e }),
    );
  }, [persistRecent]);

  const value: GitHubContextValue = useMemo(
    () => ({
      activeRepo,
      setActiveRepo,
      activeBranch,
      setActiveBranch,
      recentRepos,
      addRecentRepo,
      clearRecentRepos,
    }),
    [activeRepo, setActiveRepo, activeBranch, setActiveBranch, recentRepos, addRecentRepo, clearRecentRepos],
  );

  return <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>;
};

export const useGitHub = (): GitHubContextValue => {
  const ctx = useContext(GitHubContext);
  if (!ctx) throw new Error("useGitHub must be used within GitHubProvider");
  return ctx;
};
