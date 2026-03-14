// Centralized Supabase Edge Function names.
// Keep these as a single source of truth to avoid endpoint drift across the app.

export const SUPABASE_EDGE_FUNCTIONS = {
  GITHUB_WORKFLOW_RUNS: "github-workflow-runs",
  GITHUB_WORKFLOW_LOGS: "github-workflow-logs",
  GITHUB_WORKFLOW_DISPATCH: "github-workflow-dispatch",
  GITHUB_RUN_ARTIFACT_JSON: "github-run-artifact-json",
  TRIGGER_EAS_BUILD: "trigger-eas-build",
  CHECK_EAS_BUILD: "check-eas-build",
  SAVE_PREVIEW: "save_preview",
  PREVIEW_PAGE: "preview_page",
  ANDROID_KEYSTORE_STATUS: "android-keystore-status",
  ANDROID_KEYSTORE_GENERATE: "android-keystore-generate",
  ANDROID_KEYSTORE_EXPORT: "android-keystore-export",
  K1W1_HANDLER: "k1w1-handler",
} as const;

export type SupabaseEdgeFunctionName =
  (typeof SUPABASE_EDGE_FUNCTIONS)[keyof typeof SUPABASE_EDGE_FUNCTIONS];
