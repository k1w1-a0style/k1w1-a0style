import { getRuntimeEnv } from "./auth.ts";
import { fetchWithTimeout } from "./fetchWithTimeout.ts";

export const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_FETCH_TIMEOUT_MS = 15_000;

/**
 * Shared GitHub helpers for Supabase Edge Functions
 * - Uses GitHub recommended headers
 * - Fine-grained PATs prefer `Bearer`
 * - Provides a fetch wrapper with a safe fallback
 */

export function getGithubToken(): string {
  const t = (
    getRuntimeEnv("GITHUB_TOKEN") ??
    getRuntimeEnv("GH_TOKEN") ??
    getRuntimeEnv("GITHUB_API_TOKEN") ??
    ""
  ).trim();

  return t;
}

export function githubHeaders(
  token?: string,
  scheme: "Bearer" | "token" = "Bearer",
): Record<string, string> {
  const t = (token ?? getGithubToken()).trim();

  // Don’t throw here — callers may want to handle missing token gracefully
  const auth = t ? `${scheme} ${t}` : "";

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "k1w1-a0style-supabase-edge",
  };

  if (auth) headers["Authorization"] = auth;
  return headers;
}

function githubTimeoutMessage(url: string, timeoutMs: number): string {
  return `GitHub upstream request timed out after ${timeoutMs}ms: ${url}`;
}

export async function githubFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getGithubToken();
  const timeoutMs = GITHUB_FETCH_TIMEOUT_MS;

  // Primary attempt: Bearer (best for fine-grained PAT)
  const h1 = new Headers(init.headers);
  for (const [k, v] of Object.entries(githubHeaders(token, "Bearer"))) {
    h1.set(k, v);
  }

  const r1 = await fetchWithTimeout(url, {
    ...init,
    headers: h1,
    timeoutMs,
    timeoutMessage: githubTimeoutMessage(url, timeoutMs),
  });

  // Fallback: classic `token` scheme (some setups still use it)
  if (r1.status === 401) {
    const h2 = new Headers(init.headers);
    for (const [k, v] of Object.entries(githubHeaders(token, "token"))) {
      h2.set(k, v);
    }
    return await fetchWithTimeout(url, {
      ...init,
      headers: h2,
      timeoutMs,
      timeoutMessage: githubTimeoutMessage(url, timeoutMs),
    });
  }

  return r1;
}

// --- New helpers for deterministic CI-Lite backchannel ---

/**
 * Like githubFetch, but allows the caller to supply a token explicitly.
 * Useful when the token is resolved in a different layer.
 */
export async function githubFetchRaw(
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  const t = (token ?? "").trim();
  const timeoutMs = GITHUB_FETCH_TIMEOUT_MS;

  // Primary attempt: Bearer
  const h1 = new Headers(init.headers);
  for (const [k, v] of Object.entries(githubHeaders(t, "Bearer"))) h1.set(k, v);
  const r1 = await fetchWithTimeout(url, {
    ...init,
    headers: h1,
    timeoutMs,
    timeoutMessage: githubTimeoutMessage(url, timeoutMs),
  });

  // Fallback: classic token
  if (r1.status === 401) {
    const h2 = new Headers(init.headers);
    for (const [k, v] of Object.entries(githubHeaders(t, "token"))) h2.set(k, v);
    return await fetchWithTimeout(url, {
      ...init,
      headers: h2,
      timeoutMs,
      timeoutMessage: githubTimeoutMessage(url, timeoutMs),
    });
  }

  return r1;
}

export async function githubFetchJson<T>(
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await githubFetchRaw(url, token, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}
