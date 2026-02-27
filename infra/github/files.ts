import { ProjectFile } from "../../shared/types/project";
import { githubApiUrl } from "../../shared/constants/github";
import { Buffer } from "buffer";
import { githubLimiter } from "./rateLimit";
import { encodeGitHubFileContent, ensureBuffer } from "./crypto";
import { encodeGitHubPath, MANAGED_WORKFLOWS, normalizeRepoPath } from "./utils";
import { getGitHubToken } from "./tokenStore";
import { getDefaultBranch } from "./repos";
import { logger } from "../../lib/logger";

export const createOrUpdateFile = async (
  owner: string,
  repo: string,
  path: string,
  content: string,
  message = "Add file",
  branch = "main",
) => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const getUrl = githubApiUrl(`/repos/${owner}/${repo}/contents/${encodeGitHubPath(path)}?ref=${encodeURIComponent(branch)}`);
  const getResp = await fetch(getUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  let sha: string | undefined = undefined;
  if (getResp.ok) {
    const existing = await getResp.json();
    sha = existing.sha;
  }

  const body: any = {
    message,
    content: encodeGitHubFileContent(content),
    branch,
  };
  if (sha) body.sha = sha;

  await githubLimiter.checkLimit();

  const putResp = await fetch(
    githubApiUrl(`/repos/${owner}/${repo}/contents/${encodeGitHubPath(path)}`), {
      method: "PUT",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  let json: any;
  try {
    json = await putResp.json();
  } catch {
    const text = await putResp.text();
    throw new Error(
      `create/update file failed (${putResp.status}): ${path} -> ${text}`,
    );
  }

  if (!putResp.ok) {
    const status = putResp.status;
    if (status === 401) throw new Error("GitHub Token ungültig.");
    if (status === 403) throw new Error("Keine Berechtigung für Datei-Upload.");
    if (status === 404) throw new Error("Repository nicht gefunden.");
    throw new Error(json.message || `create/update file failed: ${path}`);
  }
  return json;
};

/**
 * Deletes a file from a repo branch using the GitHub Contents API.
 * NOTE: Each deletion creates its own commit (GitHub API limitation).
 */
export const deleteRepoFile = async (
  owner: string,
  repo: string,
  path: string,
  message = "Delete file",
  branch = "main",
) => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const getUrl = githubApiUrl(`/repos/${owner}/${repo}/contents/${encodeGitHubPath(path)}?ref=${encodeURIComponent(branch)}`);
  const getResp = await fetch(getUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!getResp.ok) {
    if (getResp.status === 404)
      return { deleted: false, reason: "not_found" } as const;
    if (getResp.status === 401) throw new Error("GitHub Token ungültig.");
    if (getResp.status === 403)
      throw new Error("Keine Berechtigung für Datei-Löschung.");
    const t = await getResp.text().catch(() => "");
    throw new Error(`Delete get failed (${getResp.status}): ${t}`);
  }

  const existing: any = await getResp.json();
  const sha: string | undefined = existing?.sha;
  if (!sha) return { deleted: false, reason: "no_sha" } as const;

  await githubLimiter.checkLimit();

  const delResp = await fetch(
    githubApiUrl(`/repos/${owner}/${repo}/contents/${encodeGitHubPath(path)}`), {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, sha, branch }),
    },
  );

  if (delResp.ok) return { deleted: true } as const;

  const status = delResp.status;
  let j: any = null;
  try {
    j = await delResp.json();
  } catch {
    // ignore
  }
  if (status === 401) throw new Error("GitHub Token ungültig.");
  if (status === 403) throw new Error("Keine Berechtigung für Datei-Löschung.");
  if (status === 404) throw new Error("Repository oder Datei nicht gefunden.");
  throw new Error(j?.message || `Delete failed (${status}): ${path}`);
};

export const pushFilesToRepo = async (
  owner: string,
  repo: string,
  files: ProjectFile[],
  branch?: string,
) => {
  let targetBranch = typeof branch === "string" ? branch.trim() : "";

  if (!targetBranch) {
    try {
      targetBranch = (await getDefaultBranch(owner, repo)).trim();
    } catch (e) {
      logger.warn("⚠️ Default-Branch konnte nicht ermittelt werden, fallback auf 'main':", e);
      targetBranch = "main";
    }
  }
  if (!targetBranch) targetBranch = "main";

  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sortedFiles) {
    if (!f.path) continue;
    const p = normalizeRepoPath(f.path.trim());
    if (p.startsWith(".github/workflows/") && !MANAGED_WORKFLOWS.has(p)) {
      logger.debug(`[pushFilesToRepo] Skip unmanaged workflow file: ${p}`);
      continue;
    }

    logger.info(`Pushing ${p}... (branch: ${targetBranch})`);
    await createOrUpdateFile(owner, repo, p, f.content, `Add ${f.path}`, targetBranch);
  }
};

/**
 * Advanced push: allows a custom commit message prefix and selective files.
 * IMPORTANT: GitHub Contents API creates a commit per file.
 */
export const pushFilesToRepoAdvanced = async (
  owner: string,
  repo: string,
  files: ProjectFile[],
  options?: {
    branch?: string;
    message?: string;
  },
) => {
  const messageBase = (options?.message || "").trim();
  const branch = options?.branch;

  let targetBranch = typeof branch === "string" ? branch.trim() : "";

  if (!targetBranch) {
    try {
      targetBranch = (await getDefaultBranch(owner, repo)).trim();
    } catch (e) {
      logger.warn("⚠️ Default-Branch konnte nicht ermittelt werden, fallback auf 'main':", e);
      targetBranch = "main";
    }
  }
  if (!targetBranch) targetBranch = "main";

  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sortedFiles) {
    if (!f.path) continue;
    const p = normalizeRepoPath(f.path.trim());
    if (p.startsWith(".github/workflows/") && !MANAGED_WORKFLOWS.has(p)) {
      logger.debug(`[pushFilesToRepoAdvanced] Skip unmanaged workflow file: ${p}`);
      continue;
    }

    const msg = messageBase ? `${messageBase}: ${p}` : `Add ${p}`;
    logger.info(`Pushing ${p}... (branch: ${targetBranch})`);
    await createOrUpdateFile(owner, repo, p, f.content, msg, targetBranch);
  }
};

/**
 * Lists blob paths of a repo at a given ref (branch/tag/sha).
 * Uses the Git Trees API (recursive) and returns normalized repo paths.
 */
export const listRepoBlobPaths = async (params: {
  owner: string;
  repo: string;
  ref?: string;
}): Promise<string[]> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const ref = (params.ref || "").trim();
  const treeRef = ref || (await getDefaultBranch(params.owner, params.repo)).trim() || "main";

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
  };

  const tryFetchTree = async (treeShaOrRef: string) => {
    await githubLimiter.checkLimit();
    const treeUrl = githubApiUrl(
      `/repos/${params.owner}/${params.repo}/git/trees/${encodeURIComponent(treeShaOrRef)}?recursive=1`,
    );
    const treeRes = await fetch(treeUrl, { headers });
    if (!treeRes.ok) {
      const text = await treeRes.text().catch(() => "");
      throw new Error(`Tree-Abruf fehlgeschlagen (${treeRes.status}): ${text}`);
    }
    const treeJson: any = await treeRes.json().catch(() => ({}));
    const tree = Array.isArray(treeJson?.tree) ? treeJson.tree : [];
    return tree
      .filter((e: any) => e?.type === "blob" && typeof e?.path === "string")
      .map((e: any) => normalizeRepoPath(String(e.path)))
      .filter((p: string) => !!p);
  };

  try {
    return await tryFetchTree(treeRef);
  } catch (e) {
    // Resolve branch -> commit sha -> tree sha
    await githubLimiter.checkLimit();
    const branchUrl = githubApiUrl(
      `/repos/${params.owner}/${params.repo}/branches/${encodeURIComponent(treeRef)}`,
    );
    const bRes = await fetch(branchUrl, { headers });
    if (!bRes.ok) throw e;
    const bJson: any = await bRes.json().catch(() => ({}));
    const commitSha = String(bJson?.commit?.sha || "").trim();
    if (!commitSha) throw e;

    await githubLimiter.checkLimit();
    const commitUrl = githubApiUrl(
      `/repos/${params.owner}/${params.repo}/git/commits/${encodeURIComponent(commitSha)}`,
    );
    const cRes = await fetch(commitUrl, { headers });
    if (!cRes.ok) throw e;
    const cJson: any = await cRes.json().catch(() => ({}));
    const treeSha = String(cJson?.tree?.sha || "").trim();
    if (!treeSha) throw e;
    return await tryFetchTree(treeSha);
  }
};

export const getRepoFileText = async (params: {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}): Promise<string> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const ref = params.ref?.trim();
  const url = githubApiUrl(`/repos/${params.owner}/${params.repo}/contents/${encodeGitHubPath(params.path)}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`);

  const resp = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`File read Fehler (${resp.status}): ${text}`);
  }

  const json = await resp.json();
  if (!json?.content || json?.encoding !== "base64") {
    throw new Error("Unsupported file response (not base64 content).");
  }

  ensureBuffer();
  return Buffer.from(json.content, "base64").toString("utf-8");
};