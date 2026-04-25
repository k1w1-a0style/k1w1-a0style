import { ProjectFile } from "../../../shared/types/project";
import { logger } from "../../../lib/logger";
import { MANAGED_WORKFLOWS, normalizeRepoPath } from "../utils";
import { normalizeFilesForRepoPush, normalizePatchDeletes, normalizePatchUpserts } from "./filePathCollections";
import { getGitHubToken } from "../tokenStore";
import { encodeGitBlobContentSha } from "./hash";
import { getErrorMessage, resolveTargetBranch } from "./shared";
import { commitTreeAndUpdateRef, createBlobFromProjectContent, fetchRepoBlobEntries, readBaseCommitContext } from "./gitObjectApiHelpers";
import type { RepoBlobEntry } from "./types";

// Architektur-Invariant: Git object flow remains based on /git/trees, /git/commits and /git/refs/heads/.
const MAX_GIT_DATA_TREE_ENTRIES = 200;

const ensureGitTreeEntryLimit = (count: number, context: string) => {
  if (count > MAX_GIT_DATA_TREE_ENTRIES) {
    throw new Error(
      `Zu viele Repo-Operationen für ${context}: ${count} > ${MAX_GIT_DATA_TREE_ENTRIES}. Bitte in kleineren Batches synchronisieren.`,
    );
  }
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

  return await fetchRepoBlobEntries({
    owner: params.owner,
    repo: params.repo,
    treeRef,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });
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
