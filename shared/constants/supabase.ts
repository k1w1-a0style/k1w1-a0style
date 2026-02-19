// Centralized Supabase Edge Function names.
// Keep these as a single source of truth to avoid endpoint drift across the app.

export const SUPABASE_EDGE_FUNCTIONS = {
  GITHUB_WORKFLOW_RUNS: "github-workflow-runs",
  GITHUB_WORKFLOW_LOGS: "github-workflow-logs",
  GITHUB_WORKFLOW_DISPATCH: "github-workflow-dispatch",
  TRIGGER_EAS_BUILD: "trigger-eas-build",
} as const;

export type SupabaseEdgeFunctionName =
  (typeof SUPABASE_EDGE_FUNCTIONS)[keyof typeof SUPABASE_EDGE_FUNCTIONS];
