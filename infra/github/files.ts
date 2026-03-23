import { ProjectFile } from "../../shared/types/project";
import { githubApiUrl } from "../../shared/constants/github";
import { Buffer } from "buffer";
import { githubLimiter } from "./rateLimit";
import { encodeGitHubFileContent, ensureBuffer } from "./crypto";
import { encodeGitHubPath, MANAGED_WORKFLOWS, normalizeRepoPath } from "./utils";
import { getGitHubToken } from "./tokenStore";
import { getDefaultBranch } from "./repos";
import { logger } from "../../lib/logger";
import { fetchGitHub } from "./utils";

type RepoBlobEntry = {
  path: string;
  sha: string;
};

const resolveTargetBranch = async (owner: string, repo: string, branch?: string) => {
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
  return targetBranch;
};

const encodeGitBlobContentSha = (content: string): string => {
  ensureBuffer();
  const body = Buffer.from(String(content ?? ""), "utf8");
  const header = Buffer.from(`blob ${body.length}\0`, "utf8");
  return sha1Hex(Buffer.concat([header, body]));
};

const sha1Hex = (input: Buffer): string => {
  const bytes = new Uint8Array(input);
  const bitLength = bytes.length * 8;
  const totalLength = (((bytes.length + 9 + 63) >> 6) << 6);
  const padded = new Uint8Array(totalLength);
  padded.set(bytes, 0);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(totalLength - 4, bitLength >>> 0, false);
  view.setUint32(totalLength - 8, Math.floor(bitLength / 0x100000000), false);

  const words = new Uint32Array(80);
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      words[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 80; i++) {
      const n = words[i - 3] ^ words[i - 8] ^ words[i - 14] ^ words[i - 16];
      words[i] = ((n << 1) | (n >>> 31)) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let i = 0; i < 80; i++) {
      let f = 0;
      let k = 0;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = ((((a << 5) | (a >>> 27)) >>> 0) + f + e + k + words[i]) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  return [h0, h1, h2, h3, h4].map((n) => n.toString(16).padStart(8, "0")).join("");
};

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
  const getResp = await fetchGitHub(getUrl, {
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

  const putResp = await fetchGitHub(
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
  const getResp = await fetchGitHub(getUrl, {
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

  const delResp = await fetchGitHub(
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
  await pushFilesToRepoAdvanced(owner, repo, files, {
    branch,
    message: "chore: sync",
  });
};

/**
 * Advanced push: allows a custom commit message prefix and selective files.
 * Uses Git Data API (tree + commit + ref) for a consolidated multi-file commit.
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

  const branchJson: any = await branchResp.json().catch(() => ({}));
  if (!branchResp.ok) {
    if (branchResp.status === 401) throw new Error("GitHub Token ungültig.");
    if (branchResp.status === 403) throw new Error('Keine Berechtigung. Token benötigt "repo" Scope.');
    if (branchResp.status === 404) throw new Error("Repo/Branch nicht gefunden.");
    throw new Error(branchJson?.message || `Branch-Abruf fehlgeschlagen (${branchResp.status})`);
  }

  const baseCommitSha = String(branchJson?.commit?.sha || "").trim();
  if (!baseCommitSha) throw new Error("Konnte Basis-Commit für Push nicht ermitteln.");

  await githubLimiter.checkLimit();
  const baseCommitResp = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/git/commits/${encodeURIComponent(baseCommitSha)}`),
    { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` } },
  );
  const baseCommitJson: any = await baseCommitResp.json().catch(() => ({}));
  if (!baseCommitResp.ok) {
    throw new Error(baseCommitJson?.message || `Commit-Abruf fehlgeschlagen (${baseCommitResp.status})`);
  }

  const baseTreeSha = String(baseCommitJson?.tree?.sha || "").trim();
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
  const createTreeJson: any = await createTreeResp.json().catch(() => ({}));
  if (!createTreeResp.ok) {
    throw new Error(createTreeJson?.message || `Tree-Erstellung fehlgeschlagen (${createTreeResp.status})`);
  }

  const newTreeSha = String(createTreeJson?.sha || "").trim();
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
  const createCommitJson: any = await createCommitResp.json().catch(() => ({}));
  if (!createCommitResp.ok) {
    throw new Error(createCommitJson?.message || `Commit-Erstellung fehlgeschlagen (${createCommitResp.status})`);
  }

  const newCommitSha = String(createCommitJson?.sha || "").trim();
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
  const updateRefJson: any = await updateRefResp.json().catch(() => ({}));
  if (!updateRefResp.ok) {
    if (updateRefResp.status === 422) {
      throw new Error("Push abgebrochen: Branch wurde parallel geändert. Bitte erneut synchronisieren.");
    }
    throw new Error(updateRefJson?.message || `Branch-Update fehlgeschlagen (${updateRefResp.status})`);
  }
};

/**
 * Lists blob paths of a repo at a given ref (branch/tag/sha).
 * Uses the Git Trees API (recursive) and returns normalized repo paths.
 */
export const listRepoBlobEntries = async (params: {
  owner: string;
  repo: string;
  ref?: string;
}): Promise<RepoBlobEntry[]> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

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
    const treeRes = await fetchGitHub(treeUrl, { headers });
    if (!treeRes.ok) {
      const text = await treeRes.text().catch(() => "");
      throw new Error(`Tree-Abruf fehlgeschlagen (${treeRes.status}): ${text}`);
    }
    const treeJson: any = await treeRes.json().catch(() => ({}));
    const tree = Array.isArray(treeJson?.tree) ? treeJson.tree : [];
    return tree
      .filter((e: any) => e?.type === "blob" && typeof e?.path === "string")
      .map((e: any) => ({ path: normalizeRepoPath(String(e.path)), sha: String(e?.sha || "").trim() }))
      .filter((e: RepoBlobEntry) => !!e.path && !!e.sha);
  };

  try {
    return await tryFetchTree(treeRef);
  } catch (e) {
    await githubLimiter.checkLimit();
    const branchUrl = githubApiUrl(
      `/repos/${params.owner}/${params.repo}/branches/${encodeURIComponent(treeRef)}`,
    );
    const bRes = await fetchGitHub(branchUrl, { headers });
    if (!bRes.ok) throw e;
    const bJson: any = await bRes.json().catch(() => ({}));
    const commitSha = String(bJson?.commit?.sha || "").trim();
    if (!commitSha) throw e;

    await githubLimiter.checkLimit();
    const commitUrl = githubApiUrl(
      `/repos/${params.owner}/${params.repo}/git/commits/${encodeURIComponent(commitSha)}`,
    );
    const cRes = await fetchGitHub(commitUrl, { headers });
    if (!cRes.ok) throw e;
    const cJson: any = await cRes.json().catch(() => ({}));
    const treeSha = String(cJson?.tree?.sha || "").trim();
    if (!treeSha) throw e;
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

  const localFiles = [...params.localFiles]
    .map((f) => ({
      path: normalizeRepoPath(String(f.path || "").trim()),
      content: String(f.content ?? ""),
    }))
    .filter((f) => !!f.path)
    .slice(0, localLimit);

  let modified = 0;
  let localOnly = 0;
  let skipped = 0;
  let error = 0;

  const localPaths = new Set<string>();
  for (const lf of localFiles) {
    localPaths.add(lf.path);
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
    } catch {
      error++;
    }
  }

  let remoteOnly = 0;
  for (const remotePath of remoteShaByPath.keys()) {
    if (!localPaths.has(remotePath)) remoteOnly++;
  }

  return { modified, localOnly, remoteOnly, skipped, error };
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

  const resp = await fetchGitHub(url, {
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
