import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { githubFetch, GITHUB_API_BASE } from "../_shared/github.ts";
import { fetchReconciliationRunStateBestEffort } from "./helpers.ts";
import { handleCheckEasBuildRequest } from "./routeCore.ts";

Deno.serve((req) => handleCheckEasBuildRequest(req, {
  createSupabaseClient: (url, key) => createClient(url, key),
  fetchRunState: async ({ githubRepo, runId }) => {
    const [owner, repo] = githubRepo.split("/");
    return await fetchReconciliationRunStateBestEffort({
      enabled: true,
      fetchRun: async () => await githubFetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs/${runId}`,
        { method: "GET" },
      ),
    });
  },
}));

