/**
 * Shared GitHub helpers for Supabase Edge Functions
 * - Uses GitHub recommended headers
 * - Fine-grained PATs prefer `Bearer`
 * - Provides a fetch wrapper with a safe fallback
 */

export function getGithubToken(): string {
  const t = (
    Deno.env.get("GITHUB_TOKEN") ??
    Deno.env.get("GH_TOKEN") ??
    Deno.env.get("GITHUB_API_TOKEN") ??
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

export async function githubFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getGithubToken();

  // Primary attempt: Bearer (best for fine-grained PAT)
  const h1 = new Headers(init.headers);
  for (const [k, v] of Object.entries(githubHeaders(token, "Bearer")))
    h1.set(k, v);

  const r1 = await fetch(url, { ...init, headers: h1 });

  // Fallback: classic `token` scheme (some setups still use it)
  if (r1.status === 401) {
    const h2 = new Headers(init.headers);
    for (const [k, v] of Object.entries(githubHeaders(token, "token")))
      h2.set(k, v);
    return await fetch(url, { ...init, headers: h2 });
  }

  return r1;
}
