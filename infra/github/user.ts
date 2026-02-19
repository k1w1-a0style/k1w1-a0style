import { githubLimiter } from "./rateLimit";
import { getGitHubToken } from "./tokenStore";
import { githubApiUrl } from "../../shared/constants/github";

export type GitHubUser = {
  login: string;
  name?: string | null;
  avatar_url?: string | null;
  html_url?: string | null;
};

export async function getGitHubUser(): Promise<GitHubUser> {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const resp = await fetch(githubApiUrl("/user"), {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  const json: any = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    if (resp.status === 401) throw new Error("GitHub Token ungültig.");
    if (resp.status === 403)
      throw new Error('Keine Berechtigung. Token benötigt "read:user" Scope.');
    throw new Error(json?.message || `User laden fehlgeschlagen (${resp.status})`);
  }

  return {
    login: String(json?.login || ""),
    name: json?.name ?? null,
    avatar_url: json?.avatar_url ?? null,
    html_url: json?.html_url ?? null,
  };
}
