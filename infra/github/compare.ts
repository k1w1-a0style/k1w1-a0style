import { githubLimiter } from "./rateLimit";
import { getGitHubToken } from "./tokenStore";
import { githubApiUrl } from "../../shared/constants/github";
import { fetchGitHub } from "./utils";
import { readGitHubMessage, readJsonRecordSafe, readRecordArrayField, readStringField } from "./githubResponseHelpers";

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

  const resp = await fetchGitHub(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await readJsonRecordSafe(resp);

  if (!resp.ok) {
    if (resp.status === 401) throw new Error("GitHub Token ungültig.");
    if (resp.status === 403)
      throw new Error('Keine Berechtigung. Token benötigt "repo" Scope.');
    if (resp.status === 404) throw new Error("Repo/Branch nicht gefunden.");
    throw new Error(readGitHubMessage(json) || `Compare fehlgeschlagen (${resp.status})`);
  }

  const files: GitHubCompareFile[] = readRecordArrayField(json, "files")
    .map((file) => {
      const additions = file.additions;
      const deletions = file.deletions;
      const changes = file.changes;
      return {
        filename: readStringField(file, "filename"),
        status: readStringField(file, "status") || undefined,
        additions: typeof additions === "number" && Number.isFinite(additions) ? additions : undefined,
        deletions: typeof deletions === "number" && Number.isFinite(deletions) ? deletions : undefined,
        changes: typeof changes === "number" && Number.isFinite(changes) ? changes : undefined,
      };
    })
    .filter((file) => !!file.filename);

  const aheadBy = json.ahead_by;
  const behindBy = json.behind_by;
  const totalCommits = json.total_commits;

  return {
    aheadBy: typeof aheadBy === "number" && Number.isFinite(aheadBy) ? aheadBy : 0,
    behindBy: typeof behindBy === "number" && Number.isFinite(behindBy) ? behindBy : 0,
    totalCommits: typeof totalCommits === "number" && Number.isFinite(totalCommits) ? totalCommits : 0,
    files,
  };
}
