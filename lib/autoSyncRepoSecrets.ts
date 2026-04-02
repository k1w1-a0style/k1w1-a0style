// lib/autoSyncRepoSecrets.ts
// One-click sync of required GitHub Actions secrets for the currently linked repo.
// Uses the same tokens/values the user enters in the Connections screen.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./storageKeys";
import {
  getExpoToken,
  getWorkflowAdminKey,
  getAndroidKeystoreExportAdminKey,
  getSigningAdminKey,
  syncRepoSecrets,
} from "../infra/github/githubService";

type AutoSyncResult = {
  updated: string[];
  skipped: string[];
};

export const autoSyncRepoSecrets = async (
  repoFullName: string,
): Promise<AutoSyncResult> => {
  const updated: string[] = [];
  const skipped: string[] = [];

  const [
    expoToken,
    supabaseUrl,
    easProjectId,
    workflowAdminKey,
    androidKeystoreExportAdminKey,
    signingAdminKey,
  ] = await Promise.all([
    getExpoToken(),
    AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL),
    AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID),
    getWorkflowAdminKey(),
    getAndroidKeystoreExportAdminKey(),
    getSigningAdminKey(),
  ]);

  // Validate inputs (but keep a useful 'skipped' list instead of throwing)
  if (!expoToken) skipped.push("EXPO_TOKEN (missing)");
  if (!supabaseUrl) skipped.push("SUPABASE_URL (missing)");
  skipped.push("SUPABASE_SERVICE_ROLE_KEY (manual-only, not synced from app)");

  // Optional (do not mark missing as error)
  if (!easProjectId) skipped.push("EAS_PROJECT_ID (optional, empty)");
  if (!workflowAdminKey) skipped.push("K1W1_EDGE_WORKFLOW_ADMIN_KEY (optional, empty)");
  if (!androidKeystoreExportAdminKey) {
    skipped.push("K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY (optional, empty)");
  }
  if (!signingAdminKey) skipped.push("SIGNING_ADMIN_KEY (legacy optional, empty)");

  // If nothing to sync, return early
  if (
    !expoToken &&
    !supabaseUrl &&
    !easProjectId &&
    !workflowAdminKey &&
    !androidKeystoreExportAdminKey &&
    !signingAdminKey
  ) {
    return { updated, skipped };
  }

  const res = await syncRepoSecrets(repoFullName, {
    expoToken: expoToken || undefined,
    supabaseUrl: supabaseUrl || undefined,
    easProjectId: easProjectId || undefined,
    workflowAdminKey: workflowAdminKey || undefined,
    androidKeystoreExportAdminKey: androidKeystoreExportAdminKey || undefined,
    signingAdminKey: signingAdminKey || undefined,
  });

  updated.push(...res.updated);
  return { updated, skipped };
};
