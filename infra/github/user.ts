import { githubLimiter } from "./rateLimit";
import { getGitHubToken } from "./tokenStore";
import { githubApiUrl } from "../../shared/constants/github";
import { fetchGitHub } from "./utils";
import { readGitHubMessage, readJsonRecordSafe, readStringField } from "./githubResponseHelpers";

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

  const resp = await fetchGitHub(githubApiUrl("/user"), {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await readJsonRecordSafe(resp);

  if (!resp.ok) {
    if (resp.status === 401) throw new Error("GitHub Token ungültig.");
    if (resp.status === 403)
      throw new Error('Keine Berechtigung. Token benötigt "read:user" Scope.');
    throw new Error(readGitHubMessage(json) || `User laden fehlgeschlagen (${resp.status})`);
  }

  const name = json.name;
  const avatarUrl = json.avatar_url;
  const htmlUrl = json.html_url;

  return {
    login: readStringField(json, "login"),
    name: typeof name === "string" ? name : null,
    avatar_url: typeof avatarUrl === "string" ? avatarUrl : null,
    html_url: typeof htmlUrl === "string" ? htmlUrl : null,
  };
}
