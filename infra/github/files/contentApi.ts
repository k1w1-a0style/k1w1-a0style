import { Buffer } from "buffer";
import { githubApiUrl } from "../../../shared/constants/github";
import { githubLimiter } from "../rateLimit";
import { encodeGitHubFileContent, ensureBuffer } from "../crypto";
import { encodeGitHubPath } from "../utils";
import { getGitHubToken } from "../tokenStore";
import { fetchGitHub } from "../utils";
import { pickGitHubMessage, readJsonOrThrowWithTextFallback, readJsonSafe } from "./shared";
import type { GitHubContentFilePayload, GitHubCreateFileBody } from "./types";

export const createOrUpdateFile = async (
  owner: string,
  repo: string,
  path: string,
  content: string,
  message = "Add file",
  branch?: string,
) => {
  const targetBranch = String(branch ?? "").trim();
  if (!targetBranch) throw new Error("Explicit branch/ref is required.");

  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const getUrl = githubApiUrl(`/repos/${owner}/${repo}/contents/${encodeGitHubPath(path)}?ref=${encodeURIComponent(targetBranch)}`);
  const getResp = await fetchGitHub(getUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  let sha: string | undefined = undefined;
  if (getResp.ok) {
    const existing = await readJsonSafe<GitHubContentFilePayload>(getResp);
    sha = typeof existing?.sha === "string" ? existing.sha : undefined;
  }

  const body: GitHubCreateFileBody = {
    message,
    content: encodeGitHubFileContent(content),
    branch: targetBranch,
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

  const json = await readJsonOrThrowWithTextFallback(
    putResp,
    `create/update file failed: ${path}`,
  );

  if (!putResp.ok) {
    const status = putResp.status;
    if (status === 401) throw new Error("GitHub Token ungültig.");
    if (status === 403) throw new Error("Keine Berechtigung für Datei-Upload.");
    if (status === 404) throw new Error("Repository nicht gefunden.");
    throw new Error(pickGitHubMessage(json) || `create/update file failed: ${path}`);
  }
  return json;
};

export const deleteRepoFile = async (
  owner: string,
  repo: string,
  path: string,
  message = "Delete file",
  branch?: string,
) => {
  const targetBranch = String(branch ?? "").trim();
  if (!targetBranch) throw new Error("Explicit branch/ref is required.");

  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const getUrl = githubApiUrl(`/repos/${owner}/${repo}/contents/${encodeGitHubPath(path)}?ref=${encodeURIComponent(targetBranch)}`);
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
    let responseText = "";
    try {
      responseText = await getResp.text();
    } catch {
      responseText = "[response body unreadable]";
    }
    throw new Error(`Delete get failed (${getResp.status}): ${responseText}`);
  }

  const existing = await readJsonSafe<GitHubContentFilePayload>(getResp);
  const sha: string | undefined = typeof existing?.sha === "string" ? existing.sha : undefined;
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
      body: JSON.stringify({ message, sha, branch: targetBranch }),
    },
  );

  if (delResp.ok) return { deleted: true } as const;

  const status = delResp.status;
  let j: unknown = null;
  try {
    j = await delResp.json();
  } catch {
    // ignore
  }
  if (status === 401) throw new Error("GitHub Token ungültig.");
  if (status === 403) throw new Error("Keine Berechtigung für Datei-Löschung.");
  if (status === 404) throw new Error("Repository oder Datei nicht gefunden.");
  throw new Error(pickGitHubMessage(j) || `Delete failed (${status}): ${path}`);
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

  const json = await readJsonSafe<GitHubContentFilePayload>(resp);
  if (!json?.content || json.encoding !== "base64") {
    throw new Error("Unsupported file response (not base64 content).");
  }

  ensureBuffer();
  return Buffer.from(json.content, "base64").toString("utf-8");
};
