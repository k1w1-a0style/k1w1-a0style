import type { RepoFilterType } from "../types";
import type { GitHubRepo } from "../../../hooks/useGitHubRepos";

export function splitFullName(
  fullName: string,
): { owner: string; repo: string } | null {
  const parts = fullName.split("/");
  const owner = parts[0]?.trim();
  const repo = parts[1]?.trim();
  if (!owner || !repo) return null;
  return { owner, repo };
}

export function dedupeReposById(repos: GitHubRepo[]): GitHubRepo[] {
  const seen = new Set<number | string>();
  const result: GitHubRepo[] = [];

  for (const r of repos) {
    const id = (r as any)?.id;
    if (id === undefined || id === null) {
      result.push(r);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(r);
  }

  return result;
}

export function combineRepos(
  remoteRepos: GitHubRepo[],
  localRepos: GitHubRepo[],
): GitHubRepo[] {
  return dedupeReposById([...localRepos, ...remoteRepos]);
}

export function filterRepos(args: {
  repos: GitHubRepo[];
  searchTerm: string;
  filterType: RepoFilterType;
  activeRepo: string | null;
  recentRepos: string[];
}): GitHubRepo[] {
  const { repos, searchTerm, filterType, activeRepo, recentRepos } = args;
  const needle = searchTerm.toLowerCase();

  return repos.filter((repo) => {
    const name = (repo.name ?? "").toLowerCase();
    const full = (repo.full_name ?? "").toLowerCase();

    const matchesSearch =
      !needle || name.includes(needle) || full.includes(needle);
    if (!matchesSearch) return false;

    if (filterType === "activeOnly")
      return !!activeRepo && repo.full_name === activeRepo;
    if (filterType === "recentOnly")
      return recentRepos.includes(repo.full_name);
    return true;
  });
}

export function deriveRenameDefault(activeRepo: string | null): string {
  if (!activeRepo) return "";
  const parts = activeRepo.split("/");
  return parts[1] || activeRepo;
}
