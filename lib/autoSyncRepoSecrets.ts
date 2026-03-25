// lib/autoSyncRepoSecrets.ts
// One-click sync of required GitHub Actions secrets for the currently linked repo.
// Uses the same tokens/values the user enters in the Connections screen.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./storageKeys";
import { getExpoToken, getEdgeAdminKey, syncRepoSecrets } from "../infra/github/githubService";

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

  // Validate inputs (but keep a useful 'skipped' list instead of throwing)
  if (!expoToken) skipped.push("EXPO_TOKEN (missing)");
  if (!supabaseUrl) skipped.push("SUPABASE_URL (missing)");
  skipped.push("SUPABASE_SERVICE_ROLE_KEY (manual-only, not synced from app)");

  // Optional (do not mark missing as error)
  if (!easProjectId) skipped.push("EAS_PROJECT_ID (optional, empty)");
  if (!edgeAdminKey) {
    skipped.push("K1W1_EDGE_WORKFLOW_ADMIN_KEY (optional, empty)");
    skipped.push("K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY (optional, empty)");
    skipped.push("K1W1_EDGE_ADMIN_KEY (legacy optional, empty)");
  }
  skipped.push("K1W1_EDGE_WORKFLOW_CI_BEARER (manual-only, not synced from app)");

  // If nothing to sync, return early
  if (!expoToken && !supabaseUrl && !easProjectId && !edgeAdminKey) {
    return { updated, skipped };
  }

  const res = await syncRepoSecrets(repoFullName, {
    expoToken: expoToken || undefined,
    supabaseUrl: supabaseUrl || undefined,
    easProjectId: easProjectId || undefined,
    edgeAdminKey: edgeAdminKey || undefined,
    workflowAdminKey: edgeAdminKey || undefined,
    androidKeystoreExportAdminKey: edgeAdminKey || undefined,
  });

  updated.push(...res.updated);
  return { updated, skipped };
};
