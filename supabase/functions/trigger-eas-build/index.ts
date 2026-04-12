import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { githubFetch, GITHUB_API_BASE } from "../_shared/github.ts";
import { resolveCommitShaBestEffort } from "./helpers.ts";
import { handleTriggerEasBuildRequest } from "./routeCore.ts";

async function resolveCommitSha(githubRepo: string, branch: string): Promise<string | null> {
  const [owner, repo] = githubRepo.split("/");
  const commitResp = await githubFetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`,
    { method: "GET" },
  );
  if (!commitResp.ok) return null;
  const json = await commitResp.json().catch(() => null) as { sha?: unknown } | null;
  return typeof json?.sha === "string" && json.sha.trim() ? json.sha.trim() : null;
}

/**
 * Creates a build_jobs row and triggers the GitHub repository_dispatch event (trigger-eas-build).
 *
 * Contract:
 * - Input: { githubRepo, buildProfile, branch }
 * - Output: { ok: true, jobId, githubRepo, branch, buildProfile }
 */
Deno.serve((req) => handleTriggerEasBuildRequest(req, {
  createSupabaseClient: (url, key) => createClient(url, key),
  githubDispatch: async ({ githubRepo, payload }) => {
    const [owner, repo] = githubRepo.split("/");
    const r = await githubFetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/dispatches`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return {
      ok: r.ok,
      status: r.status,
      bodyText: await r.text().catch(() => ""),
    };
  },
  resolveCommitShaBestEffort: async (githubRepo, branch) =>
    await resolveCommitShaBestEffort({
      githubRepo,
      branch,
      fetchCommitSha: ({ githubRepo: r, branch: b }) => resolveCommitSha(r, b),
    }),
}));

