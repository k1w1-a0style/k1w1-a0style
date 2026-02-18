// lib/storageKeys.ts
// Centralized AsyncStorage keys to avoid drift across screens/hooks/libs.

export const STORAGE_KEYS = {
  SUPABASE_RAW: "supabase_raw",
  SUPABASE_URL: "supabase_url",
  SUPABASE_KEY: "supabase_key",

  // NOTE: Service Role Key is migrated to SecureStore; this constant remains as legacy AsyncStorage key name.
  SUPABASE_SERVICE_ROLE_KEY: "supabase_service_role_key",
  SUPABASE_SERVICE_ROLE_KEY_LEGACY: "supabase_service_role_key",

  EAS_PROJECT_ID: "eas_project_id",

  // Persistent connection status (green lights)
  CONN_GITHUB_OK: "conn_github_ok",
  CONN_GITHUB_USER: "conn_github_user",
  CONN_SUPABASE_OK: "conn_supabase_ok",
  CONN_EAS_OK: "conn_eas_ok",

  // Persistent credential wizard status
  CRED_KEY_EXISTS_DEV: "cred_key_exists_dev",
  CRED_KEY_EXISTS_PREVIEW: "cred_key_exists_preview",
  CRED_KEY_EXISTS_PRODUCTION: "cred_key_exists_production",

  // Repo UX
  // JSON map: { "owner/repo": ["branch1","branch2", ...] }
  RECENT_BRANCHES_BY_REPO: "recent_branches_by_repo",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
