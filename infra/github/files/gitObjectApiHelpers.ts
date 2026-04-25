import { githubApiUrl } from "../../../shared/constants/github";
import { githubLimiter } from "../rateLimit";
import { encodeGitHubPath, normalizeRepoPath } from "../utils";
import { encodeGitHubFileContent } from "../crypto";
import { fetchGitHub } from "../utils";
import { readJsonSafe } from "./shared";
import type {
  GitHubBranchPayload,
  GitHubCommitPayload,
  GitHubMessagePayload,
  GitHubTreePayload,
  RepoBlobEntry,
} from "./types";

const BASE64_PREFIX = "base64:";
type GitHubJson = GitHubCommitPayload & GitHubBranchPayload & GitHubMessagePayload & GitHubTreePayload;

const validateProjectBase64Content = (content: string, path: string) => {
  const payload = content.slice(BASE64_PREFIX.length).trim();
  if (!payload) {
    throw new Error(`Binärdatei ohne Base64-Daten: ${path}`);
  }
  if (payload.length % 4 !== 0 || !/^[A-Za-z0-9+/=]+$/.test(payload)) {
    throw new Error(`Ungültiges base64:-Format für Binärdatei: ${path}`);
  }
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

export const createBlobFromProjectContent = async (
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

  const blobJson = await createGitHubJsonRequest({
    url: githubApiUrl(`/repos/${owner}/${repo}/git/blobs`),
    method: "POST",
    headers,
    body: {
      content: encodeGitHubFileContent(raw),
      encoding: "base64",
    },
    errorMessage: (status, message) => message || `Blob-Erstellung fehlgeschlagen (${status})`,
  });

  const blobSha = String(blobJson.sha || "").trim();
  if (!blobSha) throw new Error(`Blob-Erstellung lieferte keine SHA (${path}).`);
  return blobSha;
};

export const readBaseCommitContext = async (params: {
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

export const commitTreeAndUpdateRef = async (params: {
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

export const fetchRepoBlobEntries = async (params: {
  owner: string;
  repo: string;
  treeRef: string;
  headers: Record<string, string>;
}): Promise<RepoBlobEntry[]> => {
  const tryFetchTree = async (treeShaOrRef: string) => {
    await githubLimiter.checkLimit();
    const treeUrl = githubApiUrl(
      `/repos/${params.owner}/${params.repo}/git/trees/${encodeURIComponent(treeShaOrRef)}?recursive=1`,
    );
    const treeRes = await fetchGitHub(treeUrl, { headers: params.headers });
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
    return await tryFetchTree(params.treeRef);
  } catch (error: unknown) {
    await githubLimiter.checkLimit();
    const branchUrl = githubApiUrl(`/repos/${params.owner}/${params.repo}/branches/${encodeURIComponent(params.treeRef)}`);
    const bRes = await fetchGitHub(branchUrl, { headers: params.headers });
    if (!bRes.ok) throw error;
    const bJson = (await readJsonSafe<GitHubBranchPayload>(bRes)) ?? {};
    const commitSha = String(bJson.commit?.sha || "").trim();
    if (!commitSha) throw error;

    await githubLimiter.checkLimit();
    const commitUrl = githubApiUrl(`/repos/${params.owner}/${params.repo}/git/commits/${encodeURIComponent(commitSha)}`);
    const cRes = await fetchGitHub(commitUrl, { headers: params.headers });
    if (!cRes.ok) throw error;
    const cJson = (await readJsonSafe<GitHubCommitPayload>(cRes)) ?? {};
    const treeSha = String(cJson.tree?.sha || "").trim();
    if (!treeSha) throw error;
    return await tryFetchTree(treeSha);
  }
};
