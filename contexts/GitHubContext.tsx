import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { logger } from "../lib/logger";

import { GITHUB_STORAGE_KEYS } from "../shared/constants/github";

import { useProject } from "./ProjectContext";

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
  const { projectData } = useProject();
  const [activeRepo, setActiveRepoState] = useState<string | null>(null);
  const [activeBranch, setActiveBranchState] = useState<string | null>(null);
  const [recentRepos, setRecentRepos] = useState<string[]>([]);

  const [hydrated, setHydrated] = useState(false);
  const activeRepoRef = useRef<string | null>(null);
  const activeBranchRef = useRef<string | null>(null);

  useEffect(() => {
    activeRepoRef.current = activeRepo;
  }, [activeRepo]);

  useEffect(() => {
    activeBranchRef.current = activeBranch;
  }, [activeBranch]);


  useEffect(() => {
    const load = async () => {
      try {
        const [storedRecent, storedActiveRepo, storedBranch] =
          await Promise.all([
            AsyncStorage.getItem(RECENT_REPOS_KEY),
            AsyncStorage.getItem(ACTIVE_REPO_KEY),
            AsyncStorage.getItem(ACTIVE_BRANCH_KEY),
          ]);

        if (storedRecent) {
          const parsed = JSON.parse(storedRecent);
          if (Array.isArray(parsed)) setRecentRepos(parsed.filter(Boolean));
        }

        if (storedActiveRepo) setActiveRepoState(storedActiveRepo);
        if (storedBranch) setActiveBranchState(storedBranch);
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
      if (activeRepoRef.current === repo) return;

      setActiveRepoState(repo);
      if (repo) {
        AsyncStorage.setItem(ACTIVE_REPO_KEY, repo).catch((e) => {
          logger.error("[GitHubContext] ActiveRepo persist failed", { err: e });
        });
        setRecentRepos((prev) => {
          const filtered = prev.filter((r) => r !== repo);
          const next = [repo, ...filtered].slice(0, 10);
          persistRecent(next).catch((e) => {
            logger.error("[GitHubContext] RecentRepos persist failed", { err: e });
          });
          return next;
        });
      } else {
        AsyncStorage.removeItem(ACTIVE_REPO_KEY).catch(() => {});
      }
    },
    [persistRecent],
  );

  const setActiveBranch = useCallback((branch: string | null) => {
    if (activeBranchRef.current === branch) return;

    setActiveBranchState(branch);
    if (branch) {
      AsyncStorage.setItem(ACTIVE_BRANCH_KEY, branch).catch((e) => {
        logger.error("[GitHubContext] ActiveBranch persist failed", { err: e });
      });
    } else {
      AsyncStorage.removeItem(ACTIVE_BRANCH_KEY).catch(() => {});
    }
  }, []);

  // Single source of truth: mirror the project's linked repo/branch into this context.
  // This guarantees that the selection is consistent across screens (Header, Diagnostics, Wizard, Build, etc.).
  useEffect(() => {
    if (!hydrated) return;

    const linkedRepo = (projectData?.linkedRepo ?? "").trim() || null;
    const linkedBranch = (projectData?.linkedBranch ?? "").trim() || null;

    // If project has a linked repo, prefer it over local storage.
    if (linkedRepo !== activeRepoRef.current) {
      setActiveRepo(linkedRepo);
    }

    // Branch should follow the linked branch (even to null).
    if (linkedBranch !== activeBranchRef.current) {
      setActiveBranch(linkedBranch);
    }
  }, [hydrated, projectData?.linkedRepo, projectData?.linkedBranch, setActiveRepo, setActiveBranch]);

  const addRecentRepo = useCallback(
    (repo: string) => {
      if (!repo) return;
      setRecentRepos((prev) => {
        const filtered = prev.filter((r) => r !== repo);
        const next = [repo, ...filtered].slice(0, 10);
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
