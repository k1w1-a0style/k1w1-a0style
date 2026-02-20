// lib/storageKeys.ts
// Centralized AsyncStorage keys to avoid drift across screens/hooks/libs.

export const STORAGE_KEYS = {
  SUPABASE_RAW: "supabase_raw",
  SUPABASE_URL: "supabase_url",
  SUPABASE_KEY: "supabase_key",

  // NOTE: Service Role Key is migrated to SecureStore; this constant remains as legacy AsyncStorage key name.
  SUPABASE_SERVICE_ROLE_KEY: "supabase_service_role_key",

  EAS_PROJECT_ID: "eas_project_id",

  // Persistent connection status (green lights)
  CONN_GITHUB_OK: "conn_github_ok",
  CONN_GITHUB_USER: "conn_github_user",
  CONN_GITHUB_SCOPES: "conn_github_scopes",
  CONN_EXPO_OK: "conn_expo_ok",
  CONN_EXPO_USER: "conn_expo_user",
  CONN_SUPABASE_OK: "conn_supabase_ok",
  CONN_SUPABASE_REF: "conn_supabase_ref",
  CONN_EAS_OK: "conn_eas_ok",

  // Repo connection (explicit user action / UX)
  CONN_REPO_OK: "conn_repo_ok",
  CONN_REPO_SLUG: "conn_repo_slug",
  CONN_REPO_BRANCH: "conn_repo_branch",

  // Persistent credential wizard status (profile-specific signing key flags)
  CRED_KEY_EXISTS_DEV: "cred_key_exists_dev",
  CRED_KEY_EXISTS_PREVIEW: "cred_key_exists_preview",
  CRED_KEY_EXISTS_PRODUCTION: "cred_key_exists_production",

  // Repo UX
  // JSON map: { "owner/repo": ["branch1","branch2", ...] }
  RECENT_BRANCHES_BY_REPO: "recent_branches_by_repo",

  // Diagnostic run result (shared between DiagnosticScreen and BuildPreconditions)
  DIAGNOSTIC_LAST_OK: "diagnostic_last_ok",

  // Chat privacy/retention settings
  CHAT_PERSIST_HISTORY: "k1w1_chat_persist_history",
  CHAT_RETENTION_LIMIT: "k1w1_chat_retention_limit",

  // Build history
  BUILD_HISTORY: "k1w1_build_history",

  // CI Lite (GitHub Actions lint + typecheck) last known good state
  CI_LITE_LINT_OK: "ci_lite_lint_ok",
  CI_LITE_TYPECHECK_OK: "ci_lite_typecheck_ok",
  CI_LITE_LAST_RUN_AT: "ci_lite_last_run_at",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * Returns the AsyncStorage key for signing-key existence per build profile.
 * Use this instead of manually building `cred_key_exists_${profile}` strings.
 * Accepts "development" | "preview" | "production".
 */
export function credKeyForProfile(
  profile: "development" | "preview" | "production",
): string {
  const map: Record<string, string> = {
    development: STORAGE_KEYS.CRED_KEY_EXISTS_DEV,
    preview: STORAGE_KEYS.CRED_KEY_EXISTS_PREVIEW,
    production: STORAGE_KEYS.CRED_KEY_EXISTS_PRODUCTION,
  };
  return map[profile] ?? STORAGE_KEYS.CRED_KEY_EXISTS_PREVIEW;
}

/**
 * Same as credKeyForProfile but accepts UiModeId ("dev" | "preview" | "production").
 */
export function credKeyForUiMode(
  mode: "dev" | "preview" | "production",
): string {
  const map: Record<string, string> = {
    dev: STORAGE_KEYS.CRED_KEY_EXISTS_DEV,
    preview: STORAGE_KEYS.CRED_KEY_EXISTS_PREVIEW,
    production: STORAGE_KEYS.CRED_KEY_EXISTS_PRODUCTION,
  };
  return map[mode] ?? STORAGE_KEYS.CRED_KEY_EXISTS_PREVIEW;
}
