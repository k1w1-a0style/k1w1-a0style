import { Buffer } from "buffer";

import { fetchWithBackoff } from "../lib/retryWithBackoff";
import { githubApiUrl } from "../shared/constants/github";
import type { ProjectFile } from "../shared/types/project";
import { logger } from "../lib/logger";

import type { UseGitHubReposCallbacks } from "./gitHubReposTypes";

export type RepoTreeEntry = {
  type?: string;
  path?: string;
  sha?: string;
};

export type RepoBlobCandidate = {
  path: string;
  sha: string;
};

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

const dedupeFilesInDev = (files: ProjectFile[]): void => {
  if (!__DEV__) return;

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
};

export const pullRepoFiles = async (params: {
  token: string;
  owner: string;
  repo: string;
  branchOverride?: string | null;
  onProgress?: (message: string) => void;
  callbacks?: UseGitHubReposCallbacks;
}): Promise<ProjectFile[] | null> => {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `token ${params.token}`,
  };

  params.onProgress?.("Lade Repo-Info...");

  const infoRes = await fetchWithBackoff(
    githubApiUrl(`/repos/${params.owner}/${params.repo}`),
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
    (typeof params.branchOverride === "string" && params.branchOverride.trim())
      ? params.branchOverride.trim()
      : resolvedDefaultBranch;

  if (!branch) {
    throw new Error("Default-Branch konnte nicht eindeutig ermittelt werden.");
  }

  params.onProgress?.(`Lade Dateibaum (Branch: ${branch})...`);

  const treeRes = await fetchWithBackoff(
    githubApiUrl(`/repos/${params.owner}/${params.repo}/git/trees/${branch}?recursive=1`),
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
    params.callbacks?.onPullNoFiles?.();
    return [];
  }

  if (treeEntries.length > MAX_PULL_TEXT_FILES) {
    throw new Error(
      `Pull abgebrochen: ${treeEntries.length} unterstützte Textdateien gefunden, Limit ist ${MAX_PULL_TEXT_FILES}. Bitte Repo/Branch eingrenzen oder die Auswahl verkleinern.`,
    );
  }

  params.onProgress?.(`Lade Dateien (${treeEntries.length})...`);

  for (let i = 0; i < treeEntries.length; i += GRAPHQL_BLOB_BATCH_SIZE) {
    const batch = treeEntries.slice(i, i + GRAPHQL_BLOB_BATCH_SIZE);
    params.onProgress?.(
      `Lade Dateien ${i + 1}-${Math.min(i + GRAPHQL_BLOB_BATCH_SIZE, treeEntries.length)} von ${treeEntries.length}...`,
    );

    const { files: batchFiles, missingText } = await fetchBlobBatchViaGraphQL({
      owner: params.owner,
      repo: params.repo,
      ref: branch,
      entries: batch,
      headers,
    });
    files.push(...batchFiles);

    if (missingText.length > 0) {
      const fallbackResults = await Promise.allSettled(
        missingText.map(async (entry) => {
          const content = await fetchBlobContentBySha({
            owner: params.owner,
            repo: params.repo,
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

  dedupeFilesInDev(files);

  if (files.length === 0) {
    params.callbacks?.onPullNoFiles?.();
    return [];
  }

  return files;
};
