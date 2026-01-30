// lib/autoSyncRepoSecrets.ts
// One-click sync of required GitHub Actions secrets for the currently linked repo.
// Uses the same tokens/values the user enters in the Connections screen.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./storageKeys";
import {
  getExpoToken,
  getEdgeAdminKey,
  getSupabaseServiceRoleKey,
  saveSupabaseServiceRoleKey,
  syncRepoSecrets,
} from "../contexts/githubService";

type AutoSyncResult = {
  updated: string[];
  skipped: string[];
};

export const autoSyncRepoSecrets = async (
  repoFullName: string,
): Promise<AutoSyncResult> => {
  const updated: string[] = [];
  const skipped: string[] = [];

  const [expoToken, supabaseUrl, easProjectId, edgeAdminKey] = await Promise.all([
    getExpoToken(),
    AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL),
    AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID),
    getEdgeAdminKey(),
  ]);

  // Service role: SecureStore first
  let supabaseServiceRole =
    (await getSupabaseServiceRoleKey().catch(() => null)) || "";

  // Legacy migration fallback
  if (!supabaseServiceRole) {
    const legacy = await AsyncStorage.getItem(
      STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY_LEGACY,
    ).catch(() => "");
    if (legacy) {
      supabaseServiceRole = legacy;
      await saveSupabaseServiceRoleKey(legacy);
      await AsyncStorage.removeItem(
        STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY_LEGACY,
      ).catch(() => {});
    }
  }

  // Validate inputs (but keep a useful 'skipped' list instead of throwing)
  if (!expoToken) skipped.push("EXPO_TOKEN (missing)");
  if (!supabaseUrl) skipped.push("SUPABASE_URL (missing)");
  if (!supabaseServiceRole) skipped.push("SUPABASE_SERVICE_ROLE_KEY (missing)");

  // Optional (do not mark missing as error)
  if (!easProjectId) skipped.push("EAS_PROJECT_ID (optional, empty)");
  if (!edgeAdminKey) skipped.push("K1W1_EDGE_ADMIN_KEY (optional, empty)");

  // If nothing to sync, return early
  if (!expoToken && !supabaseUrl && !supabaseServiceRole && !easProjectId && !edgeAdminKey) {
    return { updated, skipped };
  }

  const res = await syncRepoSecrets(repoFullName, {
    expoToken: expoToken || undefined,
    supabaseUrl: supabaseUrl || undefined,
    supabaseServiceRole: supabaseServiceRole || undefined,
    easProjectId: easProjectId || undefined,
    edgeAdminKey: edgeAdminKey || undefined,
  });

  updated.push(...res.updated);
  return { updated, skipped };
};
