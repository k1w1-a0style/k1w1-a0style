import { ProjectFile } from "../../../shared/types/project";
import { githubApiUrl } from "../../../shared/constants/github";
import { logger } from "../../../lib/logger";
import { githubLimiter } from "../rateLimit";
import { MANAGED_WORKFLOWS, encodeGitHubPath, normalizeRepoPath } from "../utils";
import { normalizeFilesForRepoPush, normalizePatchDeletes, normalizePatchUpserts } from "./filePathCollections";
import { encodeGitHubFileContent } from "../crypto";
import { getGitHubToken } from "../tokenStore";
import { fetchGitHub } from "../utils";
import { encodeGitBlobContentSha } from "./hash";
import { getErrorMessage, readJsonSafe, resolveTargetBranch } from "./shared";
import type { GitHubBranchPayload, GitHubCommitPayload, GitHubMessagePayload, GitHubTreePayload, RepoBlobEntry } from "./types";

const BASE64_PREFIX = "base64:";
const MAX_GIT_DATA_TREE_ENTRIES = 200;
type GitHubJson = GitHubCommitPayload & GitHubBranchPayload & GitHubMessagePayload & GitHubTreePayload;

const ensureGitTreeEntryLimit = (count: number, context: string) => {
  if (count > MAX_GIT_DATA_TREE_ENTRIES) {
    throw new Error(
      `Zu viele Repo-Operationen für ${context}: ${count} > ${MAX_GIT_DATA_TREE_ENTRIES}. Bitte in kleineren Batches synchronisieren.`,
    );
  }
};

const validateProjectBase64Content = (content: string, path: string) => {
  const payload = content.slice(BASE64_PREFIX.length).trim();
  if (!payload) {
    throw new Error(`Binärdatei ohne Base64-Daten: ${path}`);
  }
  if (payload.length % 4 !== 0 || !/^[A-Za-z0-9+/=]+$/.test(payload)) {
    throw new Error(`Ungültiges base64:-Format für Binärdatei: ${path}`);
  }
};

const createBlobFromProjectContent = async (
  owner: string,
  repo: string,
  path: string,
  content: string,
  headers: Record<string, string>,
): Promise<string> => {
  const raw = String(content ?? "");
  if (raw.startsWith(BASE64_PREFIX)) {
    validateProjectBase64Content(raw, path);
  }

  await githubLimiter.checkLimit();
  const blobResp = await fetchGitHub(githubApiUrl(`/repos/${owner}/${repo}/git/blobs`), {
    method: "POST",
    headers,
    body: JSON.stringify({
      content: encodeGitHubFileContent(raw),
      encoding: "base64",
    }),
  });
  const blobJson = (await readJsonSafe<GitHubCommitPayload & GitHubMessagePayload>(blobResp)) ?? {};
  if (!blobResp.ok) {
    throw new Error(blobJson.message || `Blob-Erstellung fehlgeschlagen (${blobResp.status})`);
  }
  const blobSha = String(blobJson.sha || "").trim();
  if (!blobSha) throw new Error(`Blob-Erstellung lieferte keine SHA (${path}).`);
  return blobSha;
};

const createGitHubJsonRequest = async (params: {
  url: string;
  headers: Record<string, string>;
  method?: "GET" | "POST" | "PATCH";
  body?: Record<string, unknown>;
  errorMessage: (status: number, message?: string) => string;
  onStatusError?: (status: number) => Error | null;
}): Promise<GitHubJson> => {
  await githubLimiter.checkLimit();
  const response = await fetchGitHub(params.url, {
    method: params.method,
    headers: params.headers,
    body: params.body ? JSON.stringify(params.body) : undefined,
  });
  const payload = ((await readJsonSafe<GitHubJson>(response)) ?? {}) as GitHubJson;
  if (!response.ok) {
    const statusError = params.onStatusError?.(response.status);
    if (statusError) throw statusError;
    throw new Error(params.errorMessage(response.status, payload.message));
  }
  return payload;
};

const createRepoApiContext = async (
  owner: string,
  repo: string,
  options?: {
    branch?: string;
  },
) => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const targetBranch = await resolveTargetBranch(owner, repo, options?.branch);

  return { token, headers, targetBranch };
};

const readBaseCommitContext = async (params: {
  owner: string;
  repo: string;
  targetBranch: string;
  token: string;
  headers: Record<string, string>;
}) => {
  const branchJson = await createGitHubJsonRequest({
    url: githubApiUrl(`/repos/${params.owner}/${params.repo}/branches/${encodeURIComponent(params.targetBranch)}`),
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${params.token}` },
    errorMessage: (status, message) => message || `Branch-Abruf fehlgeschlagen (${status})`,
    onStatusError: (status) => {
      if (status === 401) return new Error("GitHub Token ungültig.");
      if (status === 403) return new Error('Keine Berechtigung. Token benötigt "repo" Scope.');
      if (status === 404) return new Error("Repo/Branch nicht gefunden.");
      return null;
    },
  });
  const baseCommitSha = String(branchJson.commit?.sha || "").trim();
  if (!baseCommitSha) throw new Error("Konnte Basis-Commit für Push nicht ermitteln.");

  const commitJson = await createGitHubJsonRequest({
    url: githubApiUrl(`/repos/${params.owner}/${params.repo}/git/commits/${encodeURIComponent(baseCommitSha)}`),
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${params.token}` },
    errorMessage: (status, message) => message || `Commit-Abruf fehlgeschlagen (${status})`,
  });
  const baseTreeSha = String(commitJson.tree?.sha || "").trim();
  if (!baseTreeSha) throw new Error("Konnte Basis-Tree für Push nicht ermitteln.");

  return { baseCommitSha, baseTreeSha };
};

const commitTreeAndUpdateRef = async (params: {
  owner: string;
  repo: string;
  targetBranch: string;
  headers: Record<string, string>;
  baseCommitSha: string;
  baseTreeSha: string;
  message: string;
  treeEntries: Array<Record<string, unknown>>;
}) => {
  const createTreeJson = await createGitHubJsonRequest({
    url: githubApiUrl(`/repos/${params.owner}/${params.repo}/git/trees`),
    method: "POST",
    headers: params.headers,
    body: { base_tree: params.baseTreeSha, tree: params.treeEntries },
    errorMessage: (status, message) => message || `Tree-Erstellung fehlgeschlagen (${status})`,
  });
  const newTreeSha = String(createTreeJson.sha || "").trim();
  if (!newTreeSha) throw new Error("Tree-Erstellung lieferte keine SHA.");

  const createCommitJson = await createGitHubJsonRequest({
    url: githubApiUrl(`/repos/${params.owner}/${params.repo}/git/commits`),
    method: "POST",
    headers: params.headers,
    body: { message: params.message, tree: newTreeSha, parents: [params.baseCommitSha] },
    errorMessage: (status, message) => message || `Commit-Erstellung fehlgeschlagen (${status})`,
  });
  const newCommitSha = String(createCommitJson.sha || "").trim();
  if (!newCommitSha) throw new Error("Commit-Erstellung lieferte keine SHA.");

  await createGitHubJsonRequest({
    url: githubApiUrl(`/repos/${params.owner}/${params.repo}/git/refs/heads/${encodeGitHubPath(params.targetBranch)}`),
    method: "PATCH",
    headers: params.headers,
    body: { sha: newCommitSha, force: false },
    errorMessage: (status, message) => message || `Branch-Update fehlgeschlagen (${status})`,
    onStatusError: (status) =>
      status === 422 ? new Error("Push abgebrochen: Branch wurde parallel geändert. Bitte erneut synchronisieren.") : null,
  });
};

export const pushFilesToRepo = async (
  owner: string,
  repo: string,
  files: ProjectFile[],
  branch?: string,
) => {
  await pushFilesToRepoAdvanced(owner, repo, files, {
    branch,
    message: "chore: sync",
  });
};

export const pushFilesToRepoAdvanced = async (
  owner: string,
  repo: string,
  files: ProjectFile[],
  options?: {
    branch?: string;
    message?: string;
  },
) => {
  const normalizedFiles = normalizeFilesForRepoPush(files);

  ensureGitTreeEntryLimit(normalizedFiles.length, "pushFilesToRepoAdvanced");

  if (!normalizedFiles.length) return;

  const { token, headers, targetBranch } = await createRepoApiContext(owner, repo, { branch: options?.branch });
  const message = (options?.message || "").trim() || "chore: sync";

  const { baseCommitSha, baseTreeSha } = await readBaseCommitContext({ owner, repo, targetBranch, token, headers });

  const treeEntries: Array<Record<string, string>> = [];
  for (const file of normalizedFiles) {
    const blobSha = await createBlobFromProjectContent(owner, repo, file.path, file.content, headers);
    treeEntries.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blobSha,
    });
  }

  await commitTreeAndUpdateRef({ owner, repo, targetBranch, headers, baseCommitSha, baseTreeSha, message, treeEntries });
};

export const applyRepoFilePatchAtomic = async (
  owner: string,
  repo: string,
  patch: {
    upsert?: ProjectFile[];
    delete?: string[];
  },
  options?: {
    branch?: string;
    message?: string;
  },
) => {
  const upserts = normalizePatchUpserts(patch.upsert ?? []);
  const deletes = normalizePatchDeletes(patch.delete ?? []);

  ensureGitTreeEntryLimit(upserts.length + deletes.length, "applyRepoFilePatchAtomic");

  const { token, headers, targetBranch } = await createRepoApiContext(owner, repo, { branch: options?.branch });
  const message = (options?.message || "").trim() || "chore: sync patch";

  const seen = new Set<string>();
  const treeEntries: Array<Record<string, unknown>> = [];
  for (const file of upserts) {
    if (seen.has(file.path)) continue;
    seen.add(file.path);
    const blobSha = await createBlobFromProjectContent(owner, repo, file.path, file.content, headers);
    treeEntries.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blobSha,
    });
  }
  for (const path of deletes) {
    if (seen.has(path)) continue;
    seen.add(path);
    treeEntries.push({ path, sha: null });
  }

  if (!treeEntries.length) return;

  const { baseCommitSha, baseTreeSha } = await readBaseCommitContext({ owner, repo, targetBranch, token, headers });
  await commitTreeAndUpdateRef({ owner, repo, targetBranch, headers, baseCommitSha, baseTreeSha, message, treeEntries });
};

export const listRepoBlobEntries = async (params: {
  owner: string;
  repo: string;
  ref?: string;
}): Promise<RepoBlobEntry[]> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  const ref = (params.ref || "").trim();
  const treeRef = ref || (await resolveTargetBranch(params.owner, params.repo, undefined)).trim();
  if (!treeRef) throw new Error("Explicit branch/ref is required.");

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
  };

  const tryFetchTree = async (treeShaOrRef: string) => {
    await githubLimiter.checkLimit();
    const treeUrl = githubApiUrl(
      `/repos/${params.owner}/${params.repo}/git/trees/${encodeURIComponent(treeShaOrRef)}?recursive=1`,
    );
    const treeRes = await fetchGitHub(treeUrl, { headers });
    if (!treeRes.ok) {
      let responseText = "";
      try {
        responseText = await treeRes.text();
      } catch {
        responseText = "[response body unreadable]";
      }
      throw new Error(`Tree-Abruf fehlgeschlagen (${treeRes.status}): ${responseText}`);
    }
    const treeJson = (await readJsonSafe<GitHubTreePayload>(treeRes)) ?? {};
    const tree = Array.isArray(treeJson.tree) ? treeJson.tree : [];
    return tree
      .filter((e) => e?.type === "blob" && typeof e?.path === "string")
      .map((e) => ({ path: normalizeRepoPath(String(e.path)), sha: String(e?.sha || "").trim() }))
      .filter((e: RepoBlobEntry) => !!e.path && !!e.sha);
  };

  try {
    return await tryFetchTree(treeRef);
  } catch (error: unknown) {
    await githubLimiter.checkLimit();
    const branchUrl = githubApiUrl(
      `/repos/${params.owner}/${params.repo}/branches/${encodeURIComponent(treeRef)}`,
    );
    const bRes = await fetchGitHub(branchUrl, { headers });
    if (!bRes.ok) throw error;
    const bJson = (await readJsonSafe<GitHubBranchPayload>(bRes)) ?? {};
    const commitSha = String(bJson.commit?.sha || "").trim();
    if (!commitSha) throw error;

    await githubLimiter.checkLimit();
    const commitUrl = githubApiUrl(
      `/repos/${params.owner}/${params.repo}/git/commits/${encodeURIComponent(commitSha)}`,
    );
    const cRes = await fetchGitHub(commitUrl, { headers });
    if (!cRes.ok) throw error;
    const cJson = (await readJsonSafe<GitHubCommitPayload>(cRes)) ?? {};
    const treeSha = String(cJson.tree?.sha || "").trim();
    if (!treeSha) throw error;
    return await tryFetchTree(treeSha);
  }
};

export const listRepoBlobPaths = async (params: {
  owner: string;
  repo: string;
  ref?: string;
}): Promise<string[]> => {
  const entries = await listRepoBlobEntries(params);
  return entries.map((e) => e.path);
};

export const compareLocalFilesWithRepo = async (params: {
  owner: string;
  repo: string;
  branch?: string;
  localFiles: ProjectFile[];
  maxLocalFiles?: number;
}): Promise<{
  modified: number;
  localOnly: number;
  remoteOnly: number;
  skipped: number;
  error: number;
  checkedLocalFiles: number;
  totalLocalFiles: number;
  isPartial: boolean;
  countsAreLowerBounds: boolean;
}> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  const branch = await resolveTargetBranch(params.owner, params.repo, params.branch);
  const localLimit = Math.max(1, Math.min(200, Number(params.maxLocalFiles ?? 40)));

  const allRemoteEntries = await listRepoBlobEntries({
    owner: params.owner,
    repo: params.repo,
    ref: branch,
  });

  const remoteShaByPath = new Map<string, string>();
  for (const entry of allRemoteEntries) {
    const p = normalizeRepoPath(entry.path);
    if (!p) continue;
    if (p.startsWith(".github/workflows/") && !MANAGED_WORKFLOWS.has(p)) continue;
    remoteShaByPath.set(p, entry.sha);
  }

  const normalizedLocalFiles = [...params.localFiles]
    .map((f) => ({
      path: normalizeRepoPath(String(f.path || "").trim()),
      content: String(f.content ?? ""),
    }))
    .filter((f) => !!f.path);

  const totalLocalFiles = normalizedLocalFiles.length;
  const localFiles = normalizedLocalFiles.slice(0, localLimit);
  const checkedLocalFiles = localFiles.length;
  const localScanTruncated = checkedLocalFiles < totalLocalFiles;

  let modified = 0;
  let localOnly = 0;
  let skipped = 0;
  let errorCount = 0;

  for (const lf of localFiles) {
    if (lf.path.startsWith(".github/workflows/") && !MANAGED_WORKFLOWS.has(lf.path)) {
      skipped++;
      continue;
    }

    const remoteSha = remoteShaByPath.get(lf.path);
    if (!remoteSha) {
      localOnly++;
      continue;
    }

    try {
      const localSha = encodeGitBlobContentSha(lf.content);
      if (localSha !== remoteSha) modified++;
    } catch (error: unknown) {
      logger.debug("[compareLocalFilesWithRepo] Failed to hash local blob", {
        path: lf.path,
        reason: getErrorMessage(error, "unknown"),
      });
      errorCount++;
    }
  }

  const allLocalPaths = new Set(normalizedLocalFiles.map((file) => file.path));

  let remoteOnly = 0;
  for (const remotePath of remoteShaByPath.keys()) {
    if (!allLocalPaths.has(remotePath)) remoteOnly++;
  }

  const hasCountUncertainty = errorCount > 0;
  const isPartial = localScanTruncated || hasCountUncertainty;
  const countsAreLowerBounds = localScanTruncated || hasCountUncertainty;

  return {
    modified,
    localOnly,
    remoteOnly,
    skipped,
    error: errorCount,
    checkedLocalFiles,
    totalLocalFiles,
    isPartial,
    countsAreLowerBounds,
  };
};
