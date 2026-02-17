// Small helpers used across GitHub infra modules.

export const ensureGitHubRepoParts = (
  fullName: string,
): { owner: string; repo: string } => {
  const [owner, repo] = (fullName ?? "").split("/");
  if (!owner || !repo) {
    throw new Error(`Ungültiges Repo-Format: ${fullName}`);
  }
  return { owner, repo };
};

// GitHub Contents API expects slashes as path separators. Encode each segment, not the whole string.
export const encodeGitHubPath = (p: string): string => {
  return String(p ?? "")
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
};

export const normalizeRepoPath = (p: string) =>
  String(p ?? "").replace(/\\/g, "/").replace(/^\.?\//, "");

export const MANAGED_WORKFLOWS = new Set([
  ".github/workflows/deploy-supabase-functions.yml",
  ".github/workflows/eas-build.yml",
  ".github/workflows/eas-link.yml",
  ".github/workflows/k1w1-triggered-build.yml",
  ".github/workflows/release-build.yml",
  ".github/workflows/k1w1-ci-lite.yml",
  ".github/workflows/k1w1-ci-lite-autofix.yml",
]);
