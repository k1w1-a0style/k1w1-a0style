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

import type { GitHubRepo, UseGitHubReposCallbacks } from "./gitHubReposTypes";
export type { GitHubRepo, UseGitHubReposCallbacks } from "./gitHubReposTypes";
export type { GitHubBranch, WorkflowRun };

type RepoTreeEntry = {
  type?: string;
  path?: string;
  sha?: string;
};

type RepoBlobCandidate = {
  path: string;
  sha: string;
};

const getErrorMessage = (e: unknown, fallback: string): string =>
  e instanceof Error && e.message ? e.message : fallback;

export const buildGitHubAuthHeaders = (token: string): Record<string, string> => ({
  Accept: "application/vnd.github+json",
  Authorization: `token ${token}`,
});

const TEXT_EXTENSIONS = new Set([
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
]);

const TEXT_BASENAMES = new Set([
  ".gitignore",
  ".easignore",
  ".npmrc",
  ".prettierrc",
  ".prettierignore",
  ".editorconfig",
]);

const GRAPHQL_BLOB_BATCH_SIZE = 30;
export const MAX_PULL_TEXT_FILES = 200;

const isAllowedTextPath = (repoPath: string): boolean => {
  const ext = repoPath.match(/\.[^.]+$/)?.[0]?.toLowerCase() || "";
  const base = String(repoPath).split("/").pop() || "";
  return TEXT_EXTENSIONS.has(ext) || TEXT_BASENAMES.has(base);
};

const decodeBase64 = (content: unknown): string =>
  Buffer.from(String(content || "").replace(/\n/g, ""), "base64").toString("utf8");

const fetchBlobContentBySha = async (params: {
  owner: string;
  repo: string;
  sha: string;
  headers: Record<string, string>;
}): Promise<string | null> => {
  const res = await fetchWithBackoff(
    githubApiUrl(`/repos/${params.owner}/${params.repo}/git/blobs/${params.sha}`),
    { headers: params.headers },
  );
  if (!res.ok) return null;

  const json = await res.json();
  return json.encoding === "base64" ? decodeBase64(json.content) : String(json.content || "");
};

const fetchBlobBatchViaGraphQL = async (params: {
  owner: string;
  repo: string;
  ref: string;
  entries: RepoBlobCandidate[];
  headers: Record<string, string>;
}): Promise<{ files: ProjectFile[]; missingText: RepoBlobCandidate[] }> => {
  const aliases = params.entries.map((entry, index) => ({
    alias: `f${index}`,
    entry,
  }));

  const fields = aliases
    .map(({ alias, entry }) => {
      const expression = `${params.ref}:${entry.path}`;
      return `${alias}: object(expression: ${JSON.stringify(expression)}) { ... on Blob { isBinary text } }`;
    })
    .join("\n");

  const query = `query PullRepoBlobs($owner: String!, $repo: String!) {\nrepository(owner: $owner, name: $repo) {\n${fields}\n}\n}`;

  const res = await fetchWithBackoff(githubApiUrl("/graphql"), {
    method: "POST",
    headers: {
      ...params.headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: {
        owner: params.owner,
        repo: params.repo,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GraphQL Blob-Abruf fehlgeschlagen (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (Array.isArray(json?.errors) && json.errors.length > 0) {
    const firstMessage = String(json.errors[0]?.message || "GraphQL-Fehler");
    throw new Error(`GraphQL Blob-Abruf fehlgeschlagen: ${firstMessage}`);
  }

  const repoNode = json?.data?.repository;
  if (!repoNode) {
    throw new Error("GraphQL Blob-Abruf lieferte kein Repository-Objekt.");
  }

  const files: ProjectFile[] = [];
  const missingText: RepoBlobCandidate[] = [];

  for (const { alias, entry } of aliases) {
    const blobNode = repoNode?.[alias];
    if (!blobNode || blobNode.isBinary === true) continue;

    if (typeof blobNode.text === "string") {
      files.push({ path: entry.path, content: blobNode.text });
      continue;
    }

    missingText.push(entry);
  }

  return { files, missingText };
};

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
          headers: buildGitHubAuthHeaders(token),
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
            headers: buildGitHubAuthHeaders(token),
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
            headers: buildGitHubAuthHeaders(token),
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
        const headers = buildGitHubAuthHeaders(token);

        onProgress?.("Lade Repo-Info...");

        const infoRes = await fetchWithBackoff(
          githubApiUrl(`/repos/${owner}/${repo}`),
          { headers },
        );

        if (!infoRes.ok) {
          throw new Error(`Repo nicht gefunden (${infoRes.status})`);
        }

        const infoJson = await infoRes.json();
        const resolvedDefaultBranch =
          typeof infoJson?.default_branch === "string"
            ? infoJson.default_branch.trim()
            : "";
        const branch =
          (typeof branchOverride === "string" && branchOverride.trim())
            ? branchOverride.trim()
            : resolvedDefaultBranch;

        if (!branch) {
          throw new Error("Default-Branch konnte nicht eindeutig ermittelt werden.");
        }

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

        const files: ProjectFile[] = [];
        const treeEntries = treeJson.tree
          .filter((entry: RepoTreeEntry) => entry.type === "blob")
          .map((entry: RepoTreeEntry): RepoBlobCandidate | null => {
            const path = String(entry.path || "").trim();
            const sha = String(entry.sha || "").trim();
            if (!path || !sha) return null;
            if (!isAllowedTextPath(path)) {
              if (__DEV__) logger.debug(`[useGitHubRepos] Skip binary: ${path}`);
              return null;
            }
            return { path, sha };
          })
          .filter((entry: RepoBlobCandidate | null): entry is RepoBlobCandidate => !!entry);

        if (!treeEntries.length) {
          callbacks?.onPullNoFiles?.();
          return [];
        }

        if (treeEntries.length > MAX_PULL_TEXT_FILES) {
          throw new Error(
            `Pull abgebrochen: ${treeEntries.length} unterstützte Textdateien gefunden, Limit ist ${MAX_PULL_TEXT_FILES}. Bitte Repo/Branch eingrenzen oder die Auswahl verkleinern.`,
          );
        }

        onProgress?.(`Lade Dateien (${treeEntries.length})...`);

        for (let i = 0; i < treeEntries.length; i += GRAPHQL_BLOB_BATCH_SIZE) {
          const batch = treeEntries.slice(i, i + GRAPHQL_BLOB_BATCH_SIZE);
          onProgress?.(
            `Lade Dateien ${i + 1}-${Math.min(i + GRAPHQL_BLOB_BATCH_SIZE, treeEntries.length)} von ${treeEntries.length}...`,
          );

          const { files: batchFiles, missingText } = await fetchBlobBatchViaGraphQL({
            owner,
            repo,
            ref: branch,
            entries: batch,
            headers,
          });
          files.push(...batchFiles);

          if (missingText.length > 0) {
            const fallbackResults = await Promise.allSettled(
              missingText.map(async (entry) => {
                const content = await fetchBlobContentBySha({
                  owner,
                  repo,
                  sha: entry.sha,
                  headers,
                });
                return content == null ? null : { path: entry.path, content };
              }),
            );

            fallbackResults.forEach((result) => {
              if (result.status === "fulfilled" && result.value) {
                files.push(result.value);
              }
            });
          }
        }

        if (__DEV__) {
          const uniquePaths = new Set<string>();
          const deduped: ProjectFile[] = [];
          for (const file of files) {
            if (uniquePaths.has(file.path)) {
              logger.warn(`[useGitHubRepos] Duplicate path ignored: ${file.path}`);
              continue;
            }
            uniquePaths.add(file.path);
            deduped.push(file);
          }
          files.splice(0, files.length, ...deduped);
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
