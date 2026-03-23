import { fetchWithTimeout, type FetchWithTimeoutInit } from "../../lib/network/fetchWithTimeout";

const GITHUB_REQUEST_TIMEOUT_MS = 15_000;

export async function fetchGitHub(input: RequestInfo | URL, init: FetchWithTimeoutInit = {}) {
  const timeoutMs = init.timeoutMs ?? GITHUB_REQUEST_TIMEOUT_MS;
  return fetchWithTimeout(input, {
    ...init,
    timeoutMs,
    timeoutMessage:
      init.timeoutMessage ?? `GitHub request timed out after ${timeoutMs}ms. Bitte Anfrage erneut versuchen.`,
  });
}

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

export const normalizeRepoPath = (p: string) => {
  const normalized = String(p ?? "")
    .replace(/\\/g, "/")
    .replace(/^(\.\/)+/, "");

  if (!normalized) return "";

  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "..")) {
    return "";
  }

  return normalized;
};

export const MANAGED_WORKFLOWS = new Set([
  ".github/workflows/deploy-supabase-functions.yml",
  ".github/workflows/eas-build.yml",
  ".github/workflows/eas-link.yml",
  ".github/workflows/k1w1-diagnostics.yml",
  ".github/workflows/k1w1-triggered-build.yml",
  ".github/workflows/release-build.yml",
  ".github/workflows/k1w1-ci-lite.yml",
  ".github/workflows/k1w1-ci-lite-autofix.yml",
]);
