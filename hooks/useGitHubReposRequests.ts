import { fetchWithBackoff } from "../lib/retryWithBackoff";
import { githubApiUrl } from "../shared/constants/github";
import type { GitHubRepo } from "./gitHubReposTypes";

export const buildGitHubReposListRequest = async (token: string): Promise<GitHubRepo[]> => {
  const res = await fetchWithBackoff(githubApiUrl("/user/repos?per_page=100&sort=updated"), {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub-API Fehler (${res.status}): ${text}`);
  }

  return (await res.json()) as GitHubRepo[];
};

export const buildGitHubDeleteRepoRequest = async (
  token: string,
  fullName: string,
): Promise<number> => {
  const res = await fetchWithBackoff(githubApiUrl(`/repos/${fullName}`), {
    method: "DELETE",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${token}`,
    },
  });

  return res.status;
};

export const buildGitHubRenameRepoRequest = async (
  token: string,
  currentFullName: string,
  newName: string,
): Promise<void> => {
  const res = await fetchWithBackoff(githubApiUrl(`/repos/${currentFullName}`), {
    method: "PATCH",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${token}`,
    },
    body: JSON.stringify({ name: newName }),
  });

  if (!res.ok) {
    throw new Error(`Status ${res.status}`);
  }
};
