export const GITHUB_API_BASE = "https://api.github.com";

// AsyncStorage keys related to GitHub selection and history.
// Keep these centralized to avoid drift across screens/contexts.
export const GITHUB_STORAGE_KEYS = {
  RECENT_REPOS: "k1w1_github_recent_repos",
  ACTIVE_REPO: "k1w1_github_active_repo",
  ACTIVE_BRANCH: "k1w1_github_active_branch",
} as const;

/**
 * Build a GitHub REST API URL from a path (e.g. "/repos/{owner}/{repo}").
 * Ensures a single, consistent base across the app.
 */
export function githubApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${GITHUB_API_BASE}${normalized}`;
}
