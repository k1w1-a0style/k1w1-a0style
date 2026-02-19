export const GITHUB_API_BASE = "https://api.github.com";

/**
 * Build a GitHub REST API URL from a path (e.g. "/repos/{owner}/{repo}").
 * Ensures a single, consistent base across the app.
 */
export function githubApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${GITHUB_API_BASE}${normalized}`;
}
