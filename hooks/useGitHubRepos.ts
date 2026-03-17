// hooks/useGitHubRepos.ts
// REFACTORED: types → gitHubReposTypes.ts

// hooks/useGitHubRepos.ts - Custom hook for GitHub repository management
import { useState, useCallback } from "react";
import { Buffer } from "buffer";

import { fetchWithBackoff } from "../lib/retryWithBackoff";
import { githubApiUrl } from "../shared/constants/github";
import type { ProjectFile } from "../shared/types/project";
import { logger } from "../lib/logger";
import {
  getBranches as apiBranches,
  getAllWorkflowRuns as apiWorkflowRuns,
  getDefaultBranch as apiDefaultBranch,
  GitHubBranch,
  WorkflowRun,
} from "../infra/github/githubService";

import { encodePathSegments } from "./gitHubReposTypes";
import type { GitHubRepo, UseGitHubReposCallbacks } from "./gitHubReposTypes";
export type { GitHubRepo, UseGitHubReposCallbacks } from "./gitHubReposTypes";
export type { GitHubBranch, WorkflowRun };

type RepoTreeEntry = {
  type?: string;
  path?: string;
  sha?: string;
};

const getErrorMessage = (e: unknown, fallback: string): string =>
  e instanceof Error && e.message ? e.message : fallback;


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

      const res = await fetchWithBackoff(
        githubApiUrl("/user/repos?per_page=100&sort=updated"),
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `token ${token}`,
          },
        },
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub-API Fehler (${res.status}): ${text}`);
      }

      const json = (await res.json()) as GitHubRepo[];
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
        const res = await fetchWithBackoff(
          githubApiUrl(`/repos/${repo.full_name}`),
          {
            method: "DELETE",
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `token ${token}`,
            },
          },
        );

        if (res.status === 403) {
          callbacks?.onDeleteNoPermission?.(repo);
          return false;
        }

        if (res.status !== 204) {
          throw new Error(`Status ${res.status}`);
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
        const res = await fetchWithBackoff(
          githubApiUrl(`/repos/${currentFullName}`),
          {
            method: "PATCH",
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `token ${token}`,
            },
            body: JSON.stringify({ name: newName }),
          },
        );

        if (!res.ok) {
          throw new Error(`Status ${res.status}`);
        }

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
    ): Promise<ProjectFile[] | null> => {
      if (!token) return null;

      try {
        const headers = {
          Accept: "application/vnd.github+json",
          Authorization: `token ${token}`,
        };

        onProgress?.("Lade Repo-Info...");

        const infoRes = await fetchWithBackoff(
          githubApiUrl(`/repos/${owner}/${repo}`),
          { headers },
        );

        if (!infoRes.ok) {
          throw new Error(`Repo nicht gefunden (${infoRes.status})`);
        }

        const infoJson = await infoRes.json();
        const branch =
          (typeof branchOverride === "string" && branchOverride.trim())
            ? branchOverride.trim()
            : (infoJson.default_branch || "main");

        onProgress?.(`Lade Dateibaum (Branch: ${branch})...`);

        const treeRes = await fetchWithBackoff(
          githubApiUrl(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`),
          { headers },
        );

        if (!treeRes.ok) {
          throw new Error(`Tree-Abruf fehlgeschlagen (${treeRes.status})`);
        }

        const treeJson = await treeRes.json();

        if (!treeJson?.tree || !Array.isArray(treeJson.tree)) {
          throw new Error("Ungültige Baum-Struktur");
        }

        const textExtensions = [
          ".ts",
          ".tsx",
          ".js",
          ".jsx",
          ".css",
          ".html",
          ".svg",
          ".json",
          ".md",
          ".txt",
          ".yml",
          ".yaml",
          ".config.js",
        ];

        // Some "dotfiles" are plain text but don't match the extension allowlist
        // (e.g. ".gitignore" → ext is ".gitignore"). We explicitly allow the ones
        // that are important for repo sync.
        const textBasenames = new Set<string>([
          ".gitignore",
          ".easignore",
          ".npmrc",
          ".prettierrc",
          ".prettierignore",
          ".editorconfig",
        ]);
        const files: ProjectFile[] = [];
        const blobContentCache = new Map<string, Promise<string | null>>();

        const treeEntries = treeJson.tree.filter(
          (entry: RepoTreeEntry) => entry.type === "blob",
        );

        if (!treeEntries.length) {
          callbacks?.onPullNoFiles?.();
          return [];
        }

        onProgress?.(`Lade Dateien (${treeEntries.length})...`);

        const BATCH_SIZE = 10;
        for (let i = 0; i < treeEntries.length; i += BATCH_SIZE) {
          const batch = treeEntries.slice(i, i + BATCH_SIZE);
          onProgress?.(
            `Lade Dateien ${i + 1}-${Math.min(i + BATCH_SIZE, treeEntries.length)} von ${treeEntries.length}...`,
          );

          const results = await Promise.allSettled(
            batch.map(async (entry: RepoTreeEntry) => {
              const path = String(entry.path || "");
              if (!path) return null;
              const ext = path.match(/\.[^.]+$/)?.[0]?.toLowerCase() || "";
              const base = String(path).split("/").pop() || "";

              if (!textExtensions.includes(ext) && !textBasenames.has(base)) {
                if (__DEV__) logger.debug(`[useGitHubRepos] Skip binary: ${path}`);
                return null;
              }

              try {
                const blobSha = String(entry.sha || "").trim();
                const encodedPath = encodePathSegments(path);
                const fetchContent = async (): Promise<string | null> => {
                  const url = blobSha
                    ? githubApiUrl(`/repos/${owner}/${repo}/git/blobs/${blobSha}`)
                    : githubApiUrl(`/repos/${owner}/${repo}/contents/${encodedPath}`);
                  const res = await fetchWithBackoff(url, { headers });

                  if (!res.ok) return null;

                  const json = await res.json();
                  return json.encoding === "base64"
                    ? Buffer.from(
                        String(json.content || "").replace(/\n/g, ""),
                        "base64",
                      ).toString("utf8")
                    : json.content || "";
                };

                const content = blobSha
                  ? await ((): Promise<string | null> => {
                      const cached = blobContentCache.get(blobSha);
                      if (cached) return cached;
                      const pending = fetchContent();
                      blobContentCache.set(blobSha, pending);
                      return pending;
                    })()
                  : await fetchContent();

                if (content == null) return null;

                return { path, content };
              } catch {
                return null;
              }
            }),
          );

          results.forEach((result) => {
            if (result.status === "fulfilled" && result.value) {
              files.push(result.value);
            }
          });
        }

        if (files.length === 0) {
          callbacks?.onPullNoFiles?.();
          return [];
        }

        return files;
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
      if (!token) return "main";
      try {
        return await apiDefaultBranch(owner, repo);
      } catch {
        return "main";
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
