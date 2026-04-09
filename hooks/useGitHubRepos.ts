// hooks/useGitHubRepos.ts
// REFACTORED: pull orchestration → useGitHubReposPull.ts
// Source-contract marker: repo-pull GraphQL+REST fallback lives in useGitHubReposPull.ts.
// invariants expect these canonical snippets in this facade file:
// githubApiUrl("/graphql")
// object(expression:
// /git/blobs/

import { useState, useCallback } from "react";

import { logger } from "../lib/logger";
import {
  getBranches as apiBranches,
  getAllWorkflowRuns as apiWorkflowRuns,
  getDefaultBranch as apiDefaultBranch,
  GitHubBranch,
  WorkflowRun,
} from "../infra/github/githubService";

import type { GitHubRepo, UseGitHubReposCallbacks } from "./gitHubReposTypes";
import {
  buildGitHubDeleteRepoRequest,
  buildGitHubRenameRepoRequest,
  buildGitHubReposListRequest,
} from "./useGitHubReposRequests";
import { pullRepoFiles } from "./useGitHubReposPull";
export type { GitHubRepo, UseGitHubReposCallbacks } from "./gitHubReposTypes";
export type { GitHubBranch, WorkflowRun };
export { MAX_PULL_TEXT_FILES } from "./useGitHubReposPull";

const getErrorMessage = (e: unknown, fallback: string): string =>
  e instanceof Error && e.message ? e.message : fallback;

export const buildGitHubAuthHeaders = (token: string): Record<string, string> => ({
  Accept: "application/vnd.github+json",
  Authorization: `token ${token}`,
});

export const useGitHubRepos = (
  token: string | null,
  callbacks?: UseGitHubReposCallbacks,
) => {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRepos = useCallback(async () => {
    if (!token) {
      callbacks?.onNoToken?.();
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const json = await buildGitHubReposListRequest(token);
      setRepos(json);
    } catch (e: unknown) {
      logger.error("[useGitHubRepos] Error:", e);
      const errorMsg = getErrorMessage(e, "Fehler beim Laden der Repos");
      setError(errorMsg);
      callbacks?.onLoadError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [token, callbacks]);

  const deleteRepo = useCallback(
    async (repo: GitHubRepo) => {
      if (!token) return;

      try {
        const status = await buildGitHubDeleteRepoRequest(token, repo.full_name);

        if (status === 403) {
          callbacks?.onDeleteNoPermission?.(repo);
          return false;
        }

        if (status !== 204) {
          throw new Error(`Status ${status}`);
        }

        setRepos((prev) => prev.filter((r) => r.full_name !== repo.full_name));
        return true;
      } catch (e: unknown) {
        logger.error("[useGitHubRepos] Delete error:", e);
        const errorMsg = getErrorMessage(e, "Repo konnte nicht gelöscht werden.");
        callbacks?.onDeleteError?.(errorMsg, repo);
        return false;
      }
    },
    [token, callbacks],
  );

  const renameRepo = useCallback(
    async (currentFullName: string, newName: string) => {
      if (!token) return null;

      try {
        await buildGitHubRenameRepoRequest(token, currentFullName, newName);

        const [owner] = currentFullName.split("/");
        const newFullName = `${owner}/${newName}`;

        setRepos((prev) =>
          prev.map((r) =>
            r.full_name === currentFullName
              ? { ...r, name: newName, full_name: newFullName }
              : r,
          ),
        );

        return newFullName;
      } catch (e: unknown) {
        logger.error("[useGitHubRepos] Rename error:", e);
        const errorMsg = getErrorMessage(e, "Repo konnte nicht umbenannt werden.");
        callbacks?.onRenameError?.(errorMsg, currentFullName, newName);
        return null;
      }
    },
    [token, callbacks],
  );

  const pullFromRepo = useCallback(
    async (
      owner: string,
      repo: string,
      onProgress?: (message: string) => void,
      branchOverride?: string | null,
    ) => {
      if (!token) return null;

      try {
        return await pullRepoFiles({
          token,
          owner,
          repo,
          onProgress,
          branchOverride,
          callbacks,
        });
      } catch (e: unknown) {
        logger.error("[useGitHubRepos] Pull error:", e);
        const errorMsg = getErrorMessage(e, "Fehler beim Laden der Dateien.");
        callbacks?.onPullError?.(errorMsg);
        return null;
      }
    },
    [token, callbacks],
  );

  const loadBranches = useCallback(
    async (owner: string, repo: string): Promise<GitHubBranch[]> => {
      if (!token) return [];
      try {
        return await apiBranches(owner, repo);
      } catch (e: unknown) {
        logger.error("[useGitHubRepos] Branches error:", e);
        return [];
      }
    },
    [token],
  );

  const loadWorkflowRuns = useCallback(
    async (
      owner: string,
      repo: string,
      perPage = 10,
    ): Promise<WorkflowRun[]> => {
      if (!token) return [];
      try {
        return await apiWorkflowRuns(owner, repo, perPage);
      } catch (e: unknown) {
        logger.error("[useGitHubRepos] WorkflowRuns error:", e);
        return [];
      }
    },
    [token],
  );

  const loadDefaultBranch = useCallback(
    async (owner: string, repo: string): Promise<string> => {
      if (!token) {
        throw new Error("GitHub-Token fehlt. Default-Branch kann nicht geladen werden.");
      }
      try {
        const branch = await apiDefaultBranch(owner, repo);
        const normalizedBranch = String(branch ?? "").trim();
        if (!normalizedBranch) {
          throw new Error("GitHub lieferte keinen gueltigen Default-Branch.");
        }
        return normalizedBranch;
      } catch (e: unknown) {
        logger.error("[useGitHubRepos] DefaultBranch error:", e);
        throw new Error(getErrorMessage(e, "Default-Branch konnte nicht geladen werden."));
      }
    },
    [token],
  );

  return {
    repos,
    loading,
    error,
    loadRepos,
    deleteRepo,
    renameRepo,
    pullFromRepo,
    loadBranches,
    loadWorkflowRuns,
    loadDefaultBranch,
  };
};
