// lib/diagnostics/remoteDiagnostics.ts
// Extracted from buildPipelineDiagnostics.ts: remote diagnostics functions.

import { triggerWorkflow } from "../../infra/github/githubService";
import { safeTrim } from "./diagnosticTypes";


export const triggerRemoteDiagnostics = async (params: {
  owner: string;
  repo: string;
  branch?: string | null;
}) => {
  const ref = safeTrim(params.branch);
  if (!ref) throw new Error("Kein Branch ausgewählt.");
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
  void params;
  throw new Error(
    "Remote diagnostics DB reads are disabled by contract. Use workflow artifacts/edge endpoints for operator-scoped retrieval.",
  );
};
