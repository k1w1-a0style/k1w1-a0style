import type { BuildStatus } from "../../shared/types/build";

export type BuildProfile = "development" | "preview" | "production";

export interface WorkflowRun {
  id: number;
  name: string;
  display_title?: string;
  run_number?: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  head_branch?: string;
}

export interface WorkflowRunsResponse {
  total_count?: number;
  workflow_runs?: WorkflowRun[];
}

export interface CurrentBuildLike {
  jobId?: string | number | null;
  githubRepo?: string | null;
  branch?: string | null;
  buildProfile?: BuildProfile | string | null;
  runId?: number | null;
  sourceCommitSha?: string | null;
  status?: BuildStatus;
  message?: string;
  progress?: number;
  urls?: {
    html?: string;
    artifacts?: string;
    buildUrl?: string;
  };
}
