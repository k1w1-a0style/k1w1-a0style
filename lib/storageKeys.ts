// lib/storageKeys.ts
// Centralized AsyncStorage keys to avoid drift across screens/hooks/libs.

export const STORAGE_KEYS = {
  SUPABASE_RAW: "supabase_raw",
  SUPABASE_URL: "supabase_url",
  SUPABASE_KEY: "supabase_key",


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
  CONN_EAS_STATE: "conn_eas_state",
  CONN_EAS_LAST_VERIFIED_AT: "conn_eas_last_verified_at",

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
  CHAT_GUARD_AUDIT: "k1w1_chat_guard_audit_v1",

  // Build history
  BUILD_HISTORY: "k1w1_build_history",

  // CI Lite (GitHub Actions lint + typecheck) last known good state
  // Preferred source of truth: repo/branch-scoped snapshot via ciLiteSnapshotKeyForSelection(...).
  // The flat CI_LITE_LAST_* keys remain temporary legacy/migration fallback only.
  CI_LITE_SCOPED_SNAPSHOT: "ci_lite_snapshot",
  CI_LITE_LINT_OK: "ci_lite_lint_ok",
  CI_LITE_TYPECHECK_OK: "ci_lite_typecheck_ok",
  CI_LITE_LAST_RUN_AT: "ci_lite_last_run_at",
  CI_LITE_LAST_REPO: "ci_lite_last_repo",
  CI_LITE_LAST_BRANCH: "ci_lite_last_branch",
  CI_LITE_LAST_SHA: "ci_lite_last_sha",
  CI_LITE_LAST_WORKFLOW: "ci_lite_last_workflow",
  CI_LITE_LAST_JOB_ID: "ci_lite_last_job_id",
  CI_LITE_LAST_RUN_ID: "ci_lite_last_run_id",
  CI_LITE_LAST_CONCLUSION: "ci_lite_last_conclusion",

  // One-Click Deploy options
  ONE_CLICK_AUTO_SYNC_SECRETS: "one_click_auto_sync_secrets",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];


const LEGACY_SUPABASE_SERVICE_ROLE_STORAGE_KEY = "supabase_service_role_key";

/**
 * Historical cleanup-only key for accidental legacy AsyncStorage data.
 *
 * The client must not actively manage or back up the Supabase service-role key;
 * this helper exists only so import/export cleanup can delete stale remnants.
 */
export function legacyClientServiceRoleStorageKeys(): readonly string[] {
  return [LEGACY_SUPABASE_SERVICE_ROLE_STORAGE_KEY];
}

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

/**
 * Stable project scope for project-specific credential status persistence.
 *
 * Priority:
 * 1) projectId (most stable)
 * 2) linkedRepo (fallback for legacy project records)
 * 3) null (legacy global key)
 */
export function resolveProjectCredentialScope(params: {
  projectId?: string | null;
  linkedRepo?: string | null;
}): string | null {
  const projectId = String(params.projectId ?? "").trim();
  if (projectId) return `project:${projectId}`;

  const linkedRepo = String(params.linkedRepo ?? "").trim().toLowerCase();
  if (linkedRepo) return `repo:${linkedRepo}`;

  return null;
}

/**
 * Project-scoped signing-key status key.
 * Falls back to the legacy global key when no project scope is available.
 */
export function credKeyForProjectUiMode(params: {
  mode: "dev" | "preview" | "production";
  projectScope?: string | null;
}): string {
  const base = credKeyForUiMode(params.mode);
  const scope = String(params.projectScope ?? "").trim();
  if (!scope) return base;
  return `${base}::${encodeURIComponent(scope)}`;
}


type CredentialStatusMetaField = "state" | "detail";

function credStatusMetaBaseKeyForUiMode(
  mode: "dev" | "preview" | "production",
  field: CredentialStatusMetaField,
): string {
  const suffix = field === "state" ? "state" : "detail";
  return `${credKeyForUiMode(mode)}_${suffix}`;
}

/**
 * Project-scoped signing-key verification meta key (state/detail).
 * Falls back to the legacy global key when no project scope is available.
 */
export function credStatusMetaKeyForProjectUiMode(params: {
  mode: "dev" | "preview" | "production";
  field: CredentialStatusMetaField;
  projectScope?: string | null;
}): string {
  const base = credStatusMetaBaseKeyForUiMode(params.mode, params.field);
  const scope = String(params.projectScope ?? "").trim();
  if (!scope) return base;
  return `${base}::${encodeURIComponent(scope)}`;
}

/**
 * Diagnostic status key scoped to the selected repo/branch.
 * Falls back to the legacy global key when repo or branch are missing.
 */
export function diagnosticLastOkKeyForSelection(params: {
  linkedRepo?: string | null;
  linkedBranch?: string | null;
}): string {
  const repo = String(params.linkedRepo ?? "").trim().toLowerCase();
  const branch = String(params.linkedBranch ?? "").trim();
  if (!repo || !branch) return STORAGE_KEYS.DIAGNOSTIC_LAST_OK;
  return `${STORAGE_KEYS.DIAGNOSTIC_LAST_OK}::${encodeURIComponent(repo)}::${encodeURIComponent(branch)}`;
}

/**
 * Preferred CI-Lite source of truth: repo/branch-scoped snapshot key.
 * Falls back to the legacy global key namespace only when repo or branch are missing.
 */
export function ciLiteSnapshotKeyForSelection(params: {
  linkedRepo?: string | null;
  linkedBranch?: string | null;
}): string {
  const repo = String(params.linkedRepo ?? "").trim().toLowerCase();
  const branch = String(params.linkedBranch ?? "").trim();
  if (!repo || !branch) return STORAGE_KEYS.CI_LITE_SCOPED_SNAPSHOT;
  return `${STORAGE_KEYS.CI_LITE_SCOPED_SNAPSHOT}::${encodeURIComponent(repo)}::${encodeURIComponent(branch)}`;
}
