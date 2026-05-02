// infra/github/branchOps.ts
// Extracted from repos.ts: branch CRUD operations.

import { githubLimiter } from "./rateLimit";
import { githubApiUrl } from "../../shared/constants/github";
import { getGitHubToken } from "./tokenStore";
import { fetchGitHub } from "./utils";
import { readBooleanField, readGitHubMessage, readJsonArraySafe, readJsonRecordSafe, readNestedSha, readStringField } from "./githubResponseHelpers";

export interface GitHubBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}


export const createBranch = async (
  owner: string,
  repo: string,
  newBranch: string,
  fromBranch: string,
): Promise<boolean> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  const branchName = newBranch.trim();
  if (!branchName) throw new Error("Branch-Name ist leer.");

  await githubLimiter.checkLimit();

  const refResp = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(fromBranch)}`), {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `token ${token}`,
      },
    },
  );

  const refJson = await readJsonRecordSafe(refResp);
  if (!refResp.ok) {
    if (refResp.status === 401) throw new Error("GitHub Token ungültig.");
    if (refResp.status === 403)
      throw new Error("Keine Berechtigung. Token benötigt Repo-Write Rechte.");
    throw new Error(
      readGitHubMessage(refJson) || `Base-Branch nicht gefunden: ${fromBranch}`,
    );
  }

  const sha = readNestedSha(refJson, "object");
  if (!sha) throw new Error("Konnte SHA vom Base-Branch nicht ermitteln.");

  await githubLimiter.checkLimit();

  const createResp = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/git/refs`), {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
    },
  );

  const createJson = await readJsonRecordSafe(createResp);
  if (!createResp.ok) {
    if (createResp.status === 401) throw new Error("GitHub Token ungültig.");
    if (createResp.status === 403)
      throw new Error("Keine Berechtigung. Token benötigt Repo-Write Rechte.");
    throw new Error(
      readGitHubMessage(createJson) ||
        `Branch erstellen fehlgeschlagen (${createResp.status})`,
    );
  }

  return true;
};

export const deleteBranch = async (
  owner: string,
  repo: string,
  branch: string,
): Promise<boolean> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  const b = branch.trim();
  if (!b) throw new Error("Branch-Name ist leer.");

  await githubLimiter.checkLimit();

  const resp = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(b)}`), {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `token ${token}`,
      },
    },
  );

  if (resp.status === 204) return true;
  if (resp.status === 404) return false;

  const text = await resp.text();
  if (resp.status === 401) throw new Error("GitHub Token ungültig.");
  if (resp.status === 403)
    throw new Error(
      "Keine Berechtigung. Token benötigt Repo-Admin/Write Rechte.",
    );
  throw new Error(`Branch löschen fehlgeschlagen (${resp.status}): ${text}`);
};

export const renameBranch = async (
  owner: string,
  repo: string,
  oldBranch: string,
  newBranch: string,
): Promise<{ name: string }> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  const from = oldBranch.trim();
  const to = newBranch.trim();
  if (!from) throw new Error("Alter Branch-Name ist leer.");
  if (!to) throw new Error("Neuer Branch-Name ist leer.");

  await githubLimiter.checkLimit();

  const resp = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/branches/${encodeURIComponent(from)}/rename`), {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ new_name: to }),
    },
  );

  const json = await readJsonRecordSafe(resp);
  if (!resp.ok) {
    if (resp.status === 401) throw new Error("GitHub Token ungültig.");
    if (resp.status === 403)
      throw new Error(
        "Keine Berechtigung. Token benötigt Repo-Admin/Write Rechte.",
      );
    if (resp.status === 404)
      throw new Error("Branch oder Repo nicht gefunden.");
    throw new Error(
      readGitHubMessage(json) || `Branch umbenennen fehlgeschlagen (${resp.status})`,
    );
  }

  return { name: readStringField(json, "name") || to };
};

export const getBranches = async (
  owner: string,
  repo: string,
  explicitToken?: string | null,
): Promise<GitHubBranch[]> => {
  const token = explicitToken?.trim() || await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const url = githubApiUrl(`/repos/${owner}/${repo}/branches?per_page=100`);
  const resp = await fetchGitHub(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    const status = resp.status;
    if (status === 401) throw new Error("GitHub Token ungültig.");
    if (status === 403) throw new Error("Keine Berechtigung.");
    if (status === 404) throw new Error("Repository nicht gefunden.");
    const text = await resp.text();
    throw new Error(`Branches Fehler (${status}): ${text}`);
  }

  const branchRecords = await readJsonArraySafe(resp);
  return branchRecords
    .map((record): GitHubBranch | null => {
      const name = readStringField(record, "name");
      const sha = readNestedSha(record, "commit");
      if (!name || !sha) return null;
      return {
        name,
        commit: { sha },
        protected: readBooleanField(record, "protected"),
      };
    })
    .filter((branch): branch is GitHubBranch => branch !== null);
};

export const getDefaultBranch = async (
  owner: string,
  repo: string,
  explicitToken?: string | null,
): Promise<string> => {
  const token = explicitToken?.trim() || await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const url = githubApiUrl(`/repos/${owner}/${repo}`);
  const resp = await fetchGitHub(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    throw new Error(`Repo-Info Fehler (${resp.status})`);
  }

  const json = await readJsonRecordSafe(resp);
  const defaultBranch = readStringField(json, "default_branch");
  if (!defaultBranch) throw new Error("Repository default_branch is missing.");
  return defaultBranch;
};


export const getBranchHeadSha = async (
  owner: string,
  repo: string,
  branch: string,
): Promise<string> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  const b = branch.trim();
  if (!b) throw new Error("Branch-Name ist leer.");

  await githubLimiter.checkLimit();

  const resp = await fetchGitHub(
    githubApiUrl(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(b)}`), {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const json = await readJsonRecordSafe(resp);
  if (!resp.ok) {
    if (resp.status === 401) throw new Error("GitHub Token ungültig.");
    if (resp.status === 403) throw new Error("Keine Berechtigung.");
    if (resp.status === 404) throw new Error("Branch oder Repo nicht gefunden.");
    throw new Error(readGitHubMessage(json) || `Branch-HEAD Fehler (${resp.status})`);
  }

  const sha = readNestedSha(json, "object");
  if (!sha) throw new Error("Konnte Branch-HEAD-SHA nicht ermitteln.");
  return sha;
};
