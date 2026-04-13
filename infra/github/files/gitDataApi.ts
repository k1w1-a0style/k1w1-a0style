import { ProjectFile } from "../../../shared/types/project";
import { githubApiUrl } from "../../../shared/constants/github";
import { logger } from "../../../lib/logger";
import { githubLimiter } from "../rateLimit";
import { MANAGED_WORKFLOWS, encodeGitHubPath, normalizeRepoPath } from "../utils";
import { getGitHubToken } from "../tokenStore";
import { fetchGitHub } from "../utils";
import { encodeGitBlobContentSha } from "./hash";
import { getErrorMessage, readJsonSafe, resolveTargetBranch } from "./shared";
import type { GitHubBranchPayload, GitHubCommitPayload, GitHubMessagePayload, GitHubTreePayload, RepoBlobEntry } from "./types";

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
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const targetBranch = await resolveTargetBranch(owner, repo, options?.branch);
  const message = (options?.message || "").trim() || "chore: sync";

  const normalizedFiles = [...files]
    .map((f) => {
      const originalPath = String(f.path || "").trim();
      const path = normalizeRepoPath(originalPath);
      if (originalPath && !path) {
        throw new Error(`Ungültiger Repo-Pfad: ${originalPath}`);
      }
      return {
        path,
        originalPath,
        content: String(f.content ?? ""),
      };
    })
    .filter((f) => !!f.path)
    .filter((f) => {
      if (f.path.startsWith(".github/workflows/") && !MANAGED_WORKFLOWS.has(f.path)) {
        logger.debug(`[pushFilesToRepoAdvanced] Skip unmanaged workflow file: ${f.path}`);
        return false;
      }
      return true;
    })
    .map((f) => ({
      path: f.path,
      content: String(f.content ?? ""),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  if (!normalizedFiles.length) return;

  await githubLimiter.checkLimit();
  const branchResp = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/branches/${encodeURIComponent(targetBranch)}`),
    { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` } },
  );

  const branchJson = (await readJsonSafe<GitHubBranchPayload & GitHubMessagePayload>(branchResp)) ?? {};
  if (!branchResp.ok) {
    if (branchResp.status === 401) throw new Error("GitHub Token ungültig.");
    if (branchResp.status === 403) throw new Error('Keine Berechtigung. Token benötigt "repo" Scope.');
    if (branchResp.status === 404) throw new Error("Repo/Branch nicht gefunden.");
    throw new Error(branchJson.message || `Branch-Abruf fehlgeschlagen (${branchResp.status})`);
  }

  const baseCommitSha = String(branchJson.commit?.sha || "").trim();
  if (!baseCommitSha) throw new Error("Konnte Basis-Commit für Push nicht ermitteln.");

  await githubLimiter.checkLimit();
  const baseCommitResp = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/git/commits/${encodeURIComponent(baseCommitSha)}`),
    { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` } },
  );
  const baseCommitJson = (await readJsonSafe<GitHubCommitPayload & GitHubMessagePayload>(baseCommitResp)) ?? {};
  if (!baseCommitResp.ok) {
    throw new Error(baseCommitJson.message || `Commit-Abruf fehlgeschlagen (${baseCommitResp.status})`);
  }

  const baseTreeSha = String(baseCommitJson.tree?.sha || "").trim();
  if (!baseTreeSha) throw new Error("Konnte Basis-Tree für Push nicht ermitteln.");

  const treeEntries = normalizedFiles.map((f) => ({
    path: f.path,
    mode: "100644",
    type: "blob",
    content: f.content,
  }));

  await githubLimiter.checkLimit();
  const createTreeResp = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/git/trees`),
    {
      method: "POST",
      headers,
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
    },
  );
  const createTreeJson = (await readJsonSafe<GitHubCommitPayload & GitHubMessagePayload>(createTreeResp)) ?? {};
  if (!createTreeResp.ok) {
    throw new Error(createTreeJson.message || `Tree-Erstellung fehlgeschlagen (${createTreeResp.status})`);
  }

  const newTreeSha = String(createTreeJson.sha || "").trim();
  if (!newTreeSha) throw new Error("Tree-Erstellung lieferte keine SHA.");

  await githubLimiter.checkLimit();
  const createCommitResp = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/git/commits`),
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        message,
        tree: newTreeSha,
        parents: [baseCommitSha],
      }),
    },
  );
  const createCommitJson = (await readJsonSafe<GitHubCommitPayload & GitHubMessagePayload>(createCommitResp)) ?? {};
  if (!createCommitResp.ok) {
    throw new Error(createCommitJson.message || `Commit-Erstellung fehlgeschlagen (${createCommitResp.status})`);
  }

  const newCommitSha = String(createCommitJson.sha || "").trim();
  if (!newCommitSha) throw new Error("Commit-Erstellung lieferte keine SHA.");

  await githubLimiter.checkLimit();
  const updateRefResp = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/git/refs/heads/${encodeGitHubPath(targetBranch)}`),
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sha: newCommitSha, force: false }),
    },
  );
  const updateRefJson = (await readJsonSafe<GitHubMessagePayload>(updateRefResp)) ?? {};
  if (!updateRefResp.ok) {
    if (updateRefResp.status === 422) {
      throw new Error("Push abgebrochen: Branch wurde parallel geändert. Bitte erneut synchronisieren.");
    }
    throw new Error(updateRefJson.message || `Branch-Update fehlgeschlagen (${updateRefResp.status})`);
  }
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
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const targetBranch = await resolveTargetBranch(owner, repo, options?.branch);
  const message = (options?.message || "").trim() || "chore: sync patch";

  const upserts = [...(patch.upsert ?? [])]
    .map((f) => {
      const originalPath = String(f.path || "").trim();
      const path = normalizeRepoPath(originalPath);
      if (originalPath && !path) throw new Error(`Ungültiger Repo-Pfad: ${originalPath}`);
      return { path, content: String(f.content ?? "") };
    })
    .filter((f) => !!f.path)
    .filter((f) => !f.path.startsWith(".github/workflows/") || MANAGED_WORKFLOWS.has(f.path))
    .sort((a, b) => a.path.localeCompare(b.path));

  const deletes = [...(patch.delete ?? [])]
    .map((p) => normalizeRepoPath(String(p || "").trim()))
    .filter((p): p is string => !!p)
    .filter((p) => !p.startsWith(".github/workflows/") || MANAGED_WORKFLOWS.has(p))
    .sort((a, b) => a.localeCompare(b));

  const seen = new Set<string>();
  const treeEntries: Array<Record<string, unknown>> = [];
  for (const file of upserts) {
    if (seen.has(file.path)) continue;
    seen.add(file.path);
    treeEntries.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      content: file.content,
    });
  }
  for (const path of deletes) {
    if (seen.has(path)) continue;
    seen.add(path);
    treeEntries.push({ path, sha: null });
  }

  if (!treeEntries.length) return;

  await githubLimiter.checkLimit();
  const branchResp = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/branches/${encodeURIComponent(targetBranch)}`),
    { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` } },
  );
  const branchJson = (await readJsonSafe<GitHubBranchPayload & GitHubMessagePayload>(branchResp)) ?? {};
  if (!branchResp.ok) {
    throw new Error(branchJson.message || `Branch-Abruf fehlgeschlagen (${branchResp.status})`);
  }
  const baseCommitSha = String(branchJson.commit?.sha || "").trim();
  if (!baseCommitSha) throw new Error("Konnte Basis-Commit für Push nicht ermitteln.");

  await githubLimiter.checkLimit();
  const baseCommitResp = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/git/commits/${encodeURIComponent(baseCommitSha)}`),
    { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` } },
  );
  const baseCommitJson = (await readJsonSafe<GitHubCommitPayload & GitHubMessagePayload>(baseCommitResp)) ?? {};
  if (!baseCommitResp.ok) {
    throw new Error(baseCommitJson.message || `Commit-Abruf fehlgeschlagen (${baseCommitResp.status})`);
  }
  const baseTreeSha = String(baseCommitJson.tree?.sha || "").trim();
  if (!baseTreeSha) throw new Error("Konnte Basis-Tree für Push nicht ermitteln.");

  await githubLimiter.checkLimit();
  const createTreeResp = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/git/trees`),
    {
      method: "POST",
      headers,
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
    },
  );
  const createTreeJson = (await readJsonSafe<GitHubCommitPayload & GitHubMessagePayload>(createTreeResp)) ?? {};
  if (!createTreeResp.ok) {
    throw new Error(createTreeJson.message || `Tree-Erstellung fehlgeschlagen (${createTreeResp.status})`);
  }

  const newTreeSha = String(createTreeJson.sha || "").trim();
  if (!newTreeSha) throw new Error("Tree-Erstellung lieferte keine SHA.");

  await githubLimiter.checkLimit();
  const createCommitResp = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/git/commits`),
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        message,
        tree: newTreeSha,
        parents: [baseCommitSha],
      }),
    },
  );
  const createCommitJson = (await readJsonSafe<GitHubCommitPayload & GitHubMessagePayload>(createCommitResp)) ?? {};
  if (!createCommitResp.ok) {
    throw new Error(createCommitJson.message || `Commit-Erstellung fehlgeschlagen (${createCommitResp.status})`);
  }

  const newCommitSha = String(createCommitJson.sha || "").trim();
  if (!newCommitSha) throw new Error("Commit-Erstellung lieferte keine SHA.");

  await githubLimiter.checkLimit();
  const updateRefResp = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/git/refs/heads/${encodeGitHubPath(targetBranch)}`),
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sha: newCommitSha, force: false }),
    },
  );
  const updateRefJson = (await readJsonSafe<GitHubMessagePayload>(updateRefResp)) ?? {};
  if (!updateRefResp.ok) {
    if (updateRefResp.status === 422) {
      throw new Error("Push abgebrochen: Branch wurde parallel geändert. Bitte erneut synchronisieren.");
    }
    throw new Error(updateRefJson.message || `Branch-Update fehlgeschlagen (${updateRefResp.status})`);
  }
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
