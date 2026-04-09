import type { GitHubRepo } from "../../../hooks/useGitHubRepos";

const buildLinkedRepoFallback = (
  activeRepo: string,
  activeBranch: string | null | undefined,
  userLogin: string | null | undefined,
): GitHubRepo => ({
  id: `linked:${activeRepo}`,
  name: activeRepo.split("/").pop() || activeRepo,
  full_name: activeRepo,
  private: true,
  default_branch: activeBranch || undefined,
  owner: { login: activeRepo.split("/")[0] || userLogin || "unknown" },
  html_url: `https://github.com/${activeRepo}`,
} as unknown as GitHubRepo);

export const buildRepoListData = (params: {
  showRepoList?: boolean;
  filteredRepos: GitHubRepo[];
  activeRepo: string | null;
  activeBranch: string | null | undefined;
  userLogin: string | null | undefined;
}): GitHubRepo[] => {
  const { showRepoList, filteredRepos, activeRepo, activeBranch, userLogin } = params;
  if (!(showRepoList ?? true)) return [];
  if (filteredRepos.length > 0) return filteredRepos;
  if (!activeRepo) return [];
  return [buildLinkedRepoFallback(activeRepo, activeBranch, userLogin)];
};
