import { getRuntimeEnv } from "./auth.ts";
import { fetchWithTimeout } from "./fetchWithTimeout.ts";

export const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_FETCH_TIMEOUT_MS = 15_000;

async function readResponseTextOrSentinel(response: Response, context: string): Promise<string> {
  try {
    return await response.text();
  } catch {
    return `response_text_unavailable:${context}`;
  }
}

/**
 * Shared GitHub helpers for Supabase Edge Functions
 * - Uses GitHub recommended headers
 * - Fine-grained PATs use `Bearer`
 * - Provides a fetch wrapper with fail-closed auth behavior
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

function parseCsvEnv(name: string): string[] {
  const raw = (getRuntimeEnv(name) ?? "").trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseRepoFullName(repo: string): { owner: string; name: string; normalized: string } | null {
  const normalized = repo.trim().toLowerCase();
  const parts = normalized.split("/");
  if (parts.length !== 2) return null;
  const [owner, name] = parts;
  if (!owner || !name) return null;
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(owner)) return null;
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(name)) return null;
  return { owner, name, normalized };
}

function repoAllowEntryMatches(entry: string, repo: string): boolean {
  const target = parseRepoFullName(repo);
  if (!target) return false;

  const normalizedEntry = entry.trim().toLowerCase();
  if (!normalizedEntry) return false;

  // Exact optional policy entry: owner/repo
  if (normalizedEntry === target.normalized) return true;

  // Optional owner wildcard policy entry: owner/*
  if (normalizedEntry.endsWith("/*")) {
    const owner = normalizedEntry.slice(0, -2);
    if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(owner)) return false;
    return owner === target.owner;
  }

  return false;
}

export function isAllowedGithubRepo(repo: string): boolean {
  const target = parseRepoFullName(repo);
  if (!target) return false;

  // No env policy = the selected valid repo is the source of truth.
  // If K1W1_ALLOWED_GITHUB_REPOS is set, it acts as an optional self-hosting restriction.
  const allow = parseCsvEnv("K1W1_ALLOWED_GITHUB_REPOS");
  if (allow.length === 0) return true;
  return allow.some((entry) => repoAllowEntryMatches(entry, target.normalized));
}

export function isAllowedGitRef(ref: string | null | undefined): boolean {
  const r = (ref ?? "").trim();
  if (!r) return false;
  if (r.startsWith("refs/")) return false;
  if (/^[0-9a-f]{40}$/i.test(r)) return false;
  if (r.length > 200) return false;
  if (/[\u0000-\u001f\u007f\s]/.test(r)) return false;
  if (r.startsWith("-")) return false;
  if (r.includes("..") || r.includes("@{") || r.endsWith(".lock")) return false;
  if (r.endsWith("/") || r.includes("//")) return false;
  if (/[\\~^?*\[]/.test(r)) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(r)) return false;

  // No env policy = any syntactically safe branch/tag is allowed.
  // If K1W1_ALLOWED_REF_REGEX is set, it becomes an optional restriction.
  const regexStr = (getRuntimeEnv("K1W1_ALLOWED_REF_REGEX") ?? "").trim();
  if (!regexStr) return true;

  const wrapped = regexStr.match(/^\^\((.+)\)\$$/);
  if (!wrapped) return false;
  const tokens = wrapped[1].split("|").map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 32) return false;

  for (const token of tokens) {
    if (!/^[A-Za-z0-9._/-]+(?:\/\.\+)?$/.test(token)) {
      return false;
    }
    if (token.endsWith("/.+")) {
      const prefix = token.slice(0, -2);
      if (!prefix.endsWith("/")) return false;
      if (r.startsWith(prefix) && r.length > prefix.length) return true;
      continue;
    }
    if (r === token) return true;
  }

  return false;
}

export function isGitRefPolicyConfigured(): boolean {
  const regexStr = (getRuntimeEnv("K1W1_ALLOWED_REF_REGEX") ?? "").trim();
  if (!regexStr) return false;
  const wrapped = regexStr.match(/^\^\((.+)\)\$$/);
  if (!wrapped) return false;
  const tokens = wrapped[1].split("|").map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 32) return false;
  for (const token of tokens) {
    if (!/^[A-Za-z0-9._/-]+(?:\/\.\+)?$/.test(token)) {
      return false;
    }
    if (token.endsWith("/.+") && !token.slice(0, -2).endsWith("/")) {
      return false;
    }
  }
  return true;
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

  // Single attempt: Bearer
  const h1 = new Headers(init.headers);
  for (const [k, v] of Object.entries(githubHeaders(token, "Bearer"))) {
    h1.set(k, v);
  }

  return await fetchWithTimeout(url, {
    ...init,
    headers: h1,
    timeoutMs,
    timeoutMessage: githubTimeoutMessage(url, timeoutMs),
  });
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

  // Single attempt: Bearer
  const h1 = new Headers(init.headers);
  for (const [k, v] of Object.entries(githubHeaders(t, "Bearer"))) h1.set(k, v);
  return await fetchWithTimeout(url, {
    ...init,
    headers: h1,
    timeoutMs,
    timeoutMessage: githubTimeoutMessage(url, timeoutMs),
  });
}

export async function githubFetchJson<T>(
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await githubFetchRaw(url, token, init);
  if (!res.ok) {
    const body = await readResponseTextOrSentinel(res, "github_fetch_json");
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}
