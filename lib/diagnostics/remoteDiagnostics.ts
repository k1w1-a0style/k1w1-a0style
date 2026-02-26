// lib/diagnostics/remoteDiagnostics.ts
// Extracted from buildPipelineDiagnostics.ts: remote diagnostics functions.

import {
  getEdgeAdminKey,
  getExpoToken,
  getGitHubToken,
  getRepoFileText,
  listRepoSecretNames,
  triggerWorkflow,
} from "../../infra/github/githubService";
import { ensureSupabaseClient } from "../supabase";
import type { PreflightPatch } from "./preflightTypes";
import { safeTrim } from "./diagnosticTypes";


export const triggerRemoteDiagnostics = async (params: {
  owner: string;
  repo: string;
  branch?: string | null;
}) => {
  const ref = safeTrim(params.branch) || "main";
  await triggerWorkflow(
    params.owner,
    params.repo,
    "k1w1-diagnostics.yml",
    ref,
    {
      branch: ref,
    },
  );
  return { ref };
};

export type RemoteDiagnosticsReport = {
  id: number;
  github_repo: string;
  branch: string | null;
  status: "pass" | "fail";
  project_id: string | null;
  workflow_run_id: string | null;
  commit_sha: string | null;
  errors: Array<{ code: string; message: string }>;
  created_at: string;
};

export const fetchLatestRemoteDiagnosticsReport = async (params: {
  githubRepo: string; // "owner/repo"
  branch?: string | null;
}) => {
  const ref = safeTrim(params.branch) || "main";
  const supabase = await ensureSupabaseClient();

  const { data, error } = await supabase
    .from("diagnostics_reports")
    .select(
      "id,github_repo,branch,status,project_id,workflow_run_id,commit_sha,errors,created_at",
    )
    .eq("github_repo", params.githubRepo)
    .eq("branch", ref)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as RemoteDiagnosticsReport | null;

}

