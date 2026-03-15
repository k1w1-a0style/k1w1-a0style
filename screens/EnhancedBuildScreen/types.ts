import type { BuildStatus } from "../../shared/types/build";
import type { WorkflowRun } from "../../shared/types/workflowRun";

export type { WorkflowRun } from "../../shared/types/workflowRun";

export type BuildProfile = "development" | "preview" | "production";

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
