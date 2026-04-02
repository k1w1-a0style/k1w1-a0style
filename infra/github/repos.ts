// infra/github/repos.ts
// REFACTORED: branch ops → branchOps.ts

import { githubLimiter } from "./rateLimit";
import { githubApiUrl } from "../../shared/constants/github";
import { getGitHubToken } from "./tokenStore";
import { logger } from "../../lib/logger";
import { fetchGitHub } from "./utils";
import { hasGitHubErrorMessageContaining, readGitHubMessage, readJsonRecordSafe, readStringField } from "./githubResponseHelpers";

export type { GitHubBranch } from "./branchOps";
export { createBranch, deleteBranch, renameBranch, getBranches, getDefaultBranch, getBranchHeadSha } from "./branchOps";


export const createRepo = async (repoName: string, isPrivate = true) => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt. Bitte in Einstellungen eintragen.");

  await githubLimiter.checkLimit();

  const resp = await fetchGitHub(githubApiUrl("/user/repos"), {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: repoName, private: isPrivate }),
  });

  const json = await readJsonRecordSafe(resp);
  if (!Object.keys(json).length) {
    const textResponse = await resp.text();
    throw new Error(
      `GitHub API Fehler (Status ${resp.status}): Kein JSON empfangen. Antwort: ${textResponse}`,
    );
  }

  if (!resp.ok) {
    const status = resp.status;

    if (status === 401) {
      throw new Error(
        "GitHub Token ungültig. Bitte in Einstellungen neu eingeben.",
      );
    }
    if (status === 403) {
      throw new Error('Keine Berechtigung. Token benötigt "repo" Scope.');
    }

    const alreadyExistsError = hasGitHubErrorMessageContaining(json, "name already exists");

    if (status === 422 && alreadyExistsError) {
      logger.warn("Repo existiert bereits, verwende es", { repoName });
      await githubLimiter.checkLimit();
      const userResp = await fetchGitHub(githubApiUrl("/user"), {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
        },
      });
      const userData = await readJsonRecordSafe(userResp);
      const login = readStringField(userData, "login");
      if (!login) throw new Error("Konnte User-Login nicht abrufen.");

      return {
        owner: { login },
        name: repoName,
        html_url: `https://github.com/${login}/${repoName}`,
      };
    }

    const errorDetails = JSON.stringify(json, null, 2);
    logger.error("GitHub API Fehlerdetails", { errorDetails });
    throw new Error(
      `GitHub API Fehler (Status ${status}): ${readGitHubMessage(json) || errorDetails}`,
    );
  }

  return json;
};

export const deleteRepo = async (
  owner: string,
  repo: string,
): Promise<boolean> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const resp = await fetchGitHub(githubApiUrl(`/repos/${owner}/${repo}`), {
    method: "DELETE",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${token}`,
    },
  });

  if (resp.status === 204) return true;
  if (resp.status === 404) return false;

  const text = await resp.text();
  if (resp.status === 401) throw new Error("GitHub Token ungültig.");
  if (resp.status === 403)
    throw new Error("Keine Berechtigung. Token benötigt Repo-Admin Rechte.");
  throw new Error(`Repo löschen fehlgeschlagen (${resp.status}): ${text}`);
};

export const renameRepo = async (
  owner: string,
  repo: string,
  newName: string,
): Promise<{ full_name: string; name: string; html_url: string }> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  const name = newName.trim();
  if (!name) throw new Error("Neuer Repo-Name ist leer.");

  await githubLimiter.checkLimit();

  const resp = await fetchGitHub(githubApiUrl(`/repos/${owner}/${repo}`), {
    method: "PATCH",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  const json = await readJsonRecordSafe(resp);

  if (!resp.ok) {
    if (resp.status === 401) throw new Error("GitHub Token ungültig.");
    if (resp.status === 403)
      throw new Error("Keine Berechtigung. Token benötigt Repo-Admin Rechte.");
    if (resp.status === 404) throw new Error("Repository nicht gefunden.");
    throw new Error(
      readGitHubMessage(json) || `Repo umbenennen fehlgeschlagen (${resp.status})`,
    );
  }

  return {
    full_name: readStringField(json, "full_name"),
    name: readStringField(json, "name"),
    html_url: readStringField(json, "html_url"),
  };
};

