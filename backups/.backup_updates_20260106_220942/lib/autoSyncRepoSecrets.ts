
// lib/autoSyncRepoSecrets.ts
// One-click sync of required GitHub Actions secrets for the currently linked repo.
// Uses the same tokens/values the user enters in the Connections screen.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getExpoToken, syncRepoSecrets } from "../contexts/githubService";

type AutoSyncResult = {
  updated: string[];
  skipped: string[];
};

const STORAGE_KEYS = {
  SUPABASE_URL: "supabase_url",
  SUPABASE_SERVICE_ROLE_KEY: "supabase_service_role_key",
} as const;

// Minimal validation: accept https://<ref>.supabase.co
const normalizeSupabaseUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return "";
  // accept both with/without trailing slash
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

export const autoSyncRepoSecrets = async (
  repoFullName: string,
): Promise<AutoSyncResult> => {
  const updated: string[] = [];
  const skipped: string[] = [];

  // Values are entered by the user in the Connections screen
  const [rawSupabaseUrl, rawServiceRole] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL),
    AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY),
  ]);

  const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl ?? "");
  const supabaseServiceRole = (rawServiceRole ?? "").trim();

  const expoToken = (await getExpoToken())?.trim() ?? "";

  // Validate inputs (but keep a useful 'skipped' list instead of throwing)
  if (!expoToken) skipped.push("EXPO_TOKEN (missing)");
  if (!supabaseUrl) skipped.push("SUPABASE_URL (missing)");
  if (!supabaseServiceRole) skipped.push("SUPABASE_SERVICE_ROLE_KEY (missing)");

  // If nothing to sync, return early
  if (!expoToken && !supabaseUrl && !supabaseServiceRole) {
    return { updated, skipped };
  }

  // Perform sync
  const res = await syncRepoSecrets(repoFullName, {
    expoToken: expoToken || undefined,
    supabaseUrl: supabaseUrl || undefined,
    supabaseServiceRole: supabaseServiceRole || undefined,
  });

  updated.push(...res.updated);

  return { updated, skipped };
};
