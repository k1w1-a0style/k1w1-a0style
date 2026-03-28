export const MAX_RECENT_REPOS = 10;

export const mergeRecentRepo = (
  previousRepos: readonly string[],
  repo: string,
  limit = MAX_RECENT_REPOS,
): string[] => {
  if (!repo) {
    return [...previousRepos];
  }

  const filtered = previousRepos.filter((entry) => entry !== repo);
  return [repo, ...filtered].slice(0, limit);
};

export const normalizeLinkedGitHubValue = (value: string | null | undefined): string | null => {
  return (value ?? "").trim() || null;
};
