/**
 * Shared GitHub REST API headers.
 * - `Accept: application/vnd.github+json` + `X-GitHub-Api-Version` are GitHub recommendations.
 * - Use `Authorization: Bearer <token>` (PAT, GitHub App, fine-grained PAT).
 */
export function githubHeaders(
  token: string,
  extra?: Record<string, string>,
): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "k1w1-supabase-edge",
  };

  if (extra) {
    for (const [k, v] of Object.entries(extra)) headers[k] = v;
  }

  return headers;
}
