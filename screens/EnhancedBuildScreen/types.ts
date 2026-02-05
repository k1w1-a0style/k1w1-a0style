import type { BuildStatus } from "../../lib/buildStatusMapper";

export type BuildProfile = "development" | "preview" | "production";

export interface WorkflowRun {
  id: number;
  name: string;
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
  runId?: number | null;
  status?: BuildStatus;
  message?: string;
  progress?: number;
  urls?: {
    html?: string;
    artifacts?: string;
    buildUrl?: string;
  };
}
