import { useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { MutableRefObject } from "react";
import { STORAGE_KEYS } from "../../../lib/storageKeys";
import type { GitHubRepo } from "../../../hooks/useGitHubRepos";
import { splitFullName } from "../utils/repos";

type Deps = {
  activeRepo: string | null;
  addRecentRepo: (repo: string) => void;
  setLinkedRepo: (repo: string | null, branch: string | null) => void;
  loadDefaultBranch: (owner: string, repo: string) => Promise<string>;
  isMountedRef: MutableRefObject<boolean>;
  setShowRenameRepo: (next: boolean) => void;
  setShowNewRepo: (next: boolean) => void;
  setPullProgress: (next: string) => void;
};

export function useGitHubReposSelection(deps: Deps) {
  const {
    activeRepo,
    addRecentRepo,
    setLinkedRepo,
    loadDefaultBranch,
    isMountedRef,
    setShowRenameRepo,
    setShowNewRepo,
    setPullProgress,
  } = deps;

  const selectRepoGen = useRef(0);

  const rememberRecentBranch = useCallback(async (repoFullName: string, branch: string) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_BRANCHES_BY_REPO).catch(
        () => null,
      );
      const map = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
      const prev = Array.isArray(map[repoFullName]) ? map[repoFullName] : [];
      const next = [branch, ...prev.filter((b) => b !== branch)].slice(0, 6);
      map[repoFullName] = next;
      await AsyncStorage.setItem(
        STORAGE_KEYS.RECENT_BRANCHES_BY_REPO,
        JSON.stringify(map),
      ).catch(() => null);
    } catch {
      // best-effort
    }
  }, []);

  const handleSelectRepo = useCallback((repoOrString: GitHubRepo | string) => {
    const fullName =
      typeof repoOrString === "string" ? repoOrString : repoOrString.full_name;
    const selectionGen = ++selectRepoGen.current;

    // Prefer default branch from the repo list payload (fast), fallback to API if needed.
    const defaultBranch: string | null =
      typeof repoOrString === "string"
        ? null
        : String(repoOrString.default_branch || "").trim() || null;

    const commitSelection = (branch: string) => {
      const normalizedBranch = String(branch || "").trim();
      if (!normalizedBranch) return;
      addRecentRepo(fullName);
      setLinkedRepo(fullName, normalizedBranch);
      setShowRenameRepo(false);
      setShowNewRepo(false);
      setPullProgress("");
    };

    if (defaultBranch) {
      commitSelection(defaultBranch);
      return;
    }

    // If we don't have a default branch yet (e.g. recent repo string), fetch it async first.
    // This avoids exposing a misleading "repo active, branch missing" intermediate state globally.
    const parsed = splitFullName(fullName);
    if (!parsed) return;

    loadDefaultBranch(parsed.owner, parsed.repo)
      .then((b) => String(b || "").trim())
      .then((b) => {
        if (!b) return;
        if (!isMountedRef.current) return;
        if (selectionGen !== selectRepoGen.current) return;
        addRecentRepo(fullName);
        setLinkedRepo(fullName, b);
        setShowRenameRepo(false);
        setShowNewRepo(false);
        setPullProgress("");
      })
      .catch(() => {
        // non-fatal: keep previous selection stable instead of exposing an invalid partial selection
      });
  }, [addRecentRepo, setLinkedRepo, setShowRenameRepo, setShowNewRepo, setPullProgress, loadDefaultBranch, isMountedRef]);

  const handleSelectBranch = useCallback(
    (branch: string) => {
      if (activeRepo) {
        setLinkedRepo(activeRepo, branch);
        rememberRecentBranch(activeRepo, branch);
      }
    },
    [activeRepo, rememberRecentBranch, setLinkedRepo],
  );

  return {
    handleSelectRepo,
    handleSelectBranch,
  };
}
