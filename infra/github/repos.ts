// infra/github/repos.ts
// REFACTORED: branch ops → branchOps.ts

import { githubLimiter } from "./rateLimit";
import { githubApiUrl } from "../../shared/constants/github";
import { getGitHubToken } from "./tokenStore";
import { logger } from "../../lib/logger";

export type { GitHubBranch } from "./branchOps";
export { createBranch, deleteBranch, renameBranch, getBranches, getDefaultBranch } from "./branchOps";


export const createRepo = async (repoName: string, isPrivate = true) => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt. Bitte in Einstellungen eintragen.");

  await githubLimiter.checkLimit();

  const resp = await fetch(githubApiUrl("/user/repos"), {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: repoName, private: isPrivate }),
  });

  let json: any;
  try {
    json = await resp.json();
  } catch {
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

    const alreadyExistsError = json.errors?.find((e: any) =>
      e.message?.includes("name already exists"),
    );

    if (status === 422 && alreadyExistsError) {
      logger.warn("Repo existiert bereits, verwende es", { repoName });
      await githubLimiter.checkLimit();
      const userResp = await fetch(githubApiUrl("/user"), {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
        },
      });
      const userData = await userResp.json();
      if (!userData.login) throw new Error("Konnte User-Login nicht abrufen.");

      return {
        owner: { login: userData.login },
        name: repoName,
        html_url: `https://github.com/${userData.login}/${repoName}`,
      };
    }

    const errorDetails = JSON.stringify(json, null, 2);
    logger.error("GitHub API Fehlerdetails", { errorDetails });
    throw new Error(
      `GitHub API Fehler (Status ${status}): ${json.message || errorDetails}`,
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

  const resp = await fetch(githubApiUrl(`/repos/${owner}/${repo}`), {
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

  const resp = await fetch(githubApiUrl(`/repos/${owner}/${repo}`), {
    method: "PATCH",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  const json: any = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    if (resp.status === 401) throw new Error("GitHub Token ungültig.");
    if (resp.status === 403)
      throw new Error("Keine Berechtigung. Token benötigt Repo-Admin Rechte.");
    if (resp.status === 404) throw new Error("Repository nicht gefunden.");
    throw new Error(
      json.message || `Repo umbenennen fehlgeschlagen (${resp.status})`,
    );
  }

  return {
    full_name: json.full_name,
    name: json.name,
    html_url: json.html_url,
  };
};

