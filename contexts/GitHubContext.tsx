import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type GitHubContextValue = {
  activeRepo: string | null;
  setActiveRepo: (repo: string | null) => void;
  activeBranch: string | null;
  setActiveBranch: (branch: string | null) => void;
  recentRepos: string[];
  addRecentRepo: (repo: string) => void;
  clearRecentRepos: () => void;
};

const RECENT_REPOS_KEY = "k1w1_github_recent_repos";
const ACTIVE_REPO_KEY = "k1w1_github_active_repo";
const ACTIVE_BRANCH_KEY = "k1w1_github_active_branch";

const GitHubContext = createContext<GitHubContextValue | undefined>(undefined);

export const GitHubProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeRepo, setActiveRepoState] = useState<string | null>(null);
  const [activeBranch, setActiveBranchState] = useState<string | null>(null);
  const [recentRepos, setRecentRepos] = useState<string[]>([]);

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
        console.error("[GitHubContext] Fehler beim Laden:", e);
      }
    };
    load();
  }, []);

  const persistRecent = useCallback(async (repos: string[]) => {
    await AsyncStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(repos));
  }, []);

  const setActiveRepo = useCallback(
    (repo: string | null) => {
      setActiveRepoState(repo);
      if (repo) {
        AsyncStorage.setItem(ACTIVE_REPO_KEY, repo).catch((e) => {
          console.error("[GitHubContext] ActiveRepo persist failed:", e);
        });
        setRecentRepos((prev) => {
          const filtered = prev.filter((r) => r !== repo);
          const next = [repo, ...filtered].slice(0, 10);
          persistRecent(next).catch((e) => {
            console.error("[GitHubContext] RecentRepos persist failed:", e);
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
    setActiveBranchState(branch);
    if (branch) {
      AsyncStorage.setItem(ACTIVE_BRANCH_KEY, branch).catch((e) => {
        console.error("[GitHubContext] ActiveBranch persist failed:", e);
      });
    } else {
      AsyncStorage.removeItem(ACTIVE_BRANCH_KEY).catch(() => {});
    }
  }, []);

  const addRecentRepo = useCallback(
    (repo: string) => {
      if (!repo) return;
      setRecentRepos((prev) => {
        const filtered = prev.filter((r) => r !== repo);
        const next = [repo, ...filtered].slice(0, 10);
        persistRecent(next).catch((e) => {
          console.error("[GitHubContext] RecentRepos persist failed:", e);
        });
        return next;
      });
    },
    [persistRecent],
  );

  const clearRecentRepos = useCallback(() => {
    setRecentRepos([]);
    persistRecent([]).catch((e) =>
      console.error("[GitHubContext] clear persist failed:", e),
    );
  }, [persistRecent]);

  return (
    <GitHubContext.Provider
      value={{
        activeRepo,
        setActiveRepo,
        activeBranch,
        setActiveBranch,
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
  if (!ctx) throw new Error("useGitHub must be used within GitHubProvider");
  return ctx;
};
