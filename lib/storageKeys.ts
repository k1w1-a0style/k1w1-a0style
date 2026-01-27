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
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
