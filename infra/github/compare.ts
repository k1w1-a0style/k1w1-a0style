import { githubLimiter } from "./rateLimit";
import { getGitHubToken } from "./tokenStore";
import { githubApiUrl } from "../../shared/constants/github";

export type GitHubCompareFile = {
  filename: string;
  status?: string;
  additions?: number;
  deletions?: number;
  changes?: number;
};

export async function compareBranches(params: {
  owner: string;
  repo: string;
  base: string;
  head: string;
  perPage?: number;
}): Promise<{
  aheadBy: number;
  behindBy: number;
  totalCommits: number;
  files: GitHubCompareFile[];
}> {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  const { owner, repo, base, head } = params;
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 100));

  await githubLimiter.checkLimit();

  const url = githubApiUrl(
    `/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(
      head,
    )}?per_page=${perPage}`,
  );

  const resp = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  const json: any = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    if (resp.status === 401) throw new Error("GitHub Token ungültig.");
    if (resp.status === 403)
      throw new Error('Keine Berechtigung. Token benötigt "repo" Scope.');
    if (resp.status === 404) throw new Error("Repo/Branch nicht gefunden.");
    throw new Error(json?.message || `Compare fehlgeschlagen (${resp.status})`);
  }

  const files: GitHubCompareFile[] = Array.isArray(json?.files)
    ? json.files
        .map((f: any) => ({
          filename: String(f?.filename || ""),
          status: f?.status ? String(f.status) : undefined,
          additions: Number.isFinite(f?.additions) ? Number(f.additions) : undefined,
          deletions: Number.isFinite(f?.deletions) ? Number(f.deletions) : undefined,
          changes: Number.isFinite(f?.changes) ? Number(f.changes) : undefined,
        }))
        .filter((f: GitHubCompareFile) => !!f.filename)
    : [];

  return {
    aheadBy: Number.isFinite(json?.ahead_by) ? Number(json.ahead_by) : 0,
    behindBy: Number.isFinite(json?.behind_by) ? Number(json.behind_by) : 0,
    totalCommits: Number.isFinite(json?.total_commits) ? Number(json.total_commits) : 0,
    files,
  };
}
