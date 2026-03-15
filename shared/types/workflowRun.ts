export type WorkflowRunStatus = "queued" | "in_progress" | "completed";

export type WorkflowRunConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "neutral"
  | "action_required"
  | "startup_failure"
  | "stale"
  | null
  | undefined;

export interface WorkflowRun {
  id: number;
  name?: string;
  display_title?: string;
  event?: string;
  run_number: number;
  status: WorkflowRunStatus;
  conclusion?: WorkflowRunConclusion;
  created_at: string;
  updated_at: string;
  html_url: string;
  head_branch?: string;
}
