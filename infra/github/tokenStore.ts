import * as SecureStore from "expo-secure-store";
import { logger } from "../../lib/logger";

import { TOKEN_KEYS } from "../../shared/constants/tokens";

// Legacy keys (kept for one-time migration)
const LEGACY_GH_TOKEN_KEY = "github_pat_v1";
const LEGACY_EXPO_TOKEN_KEY = "expo_token_v1";

// These are intentionally versioned because they are optional / power-user inputs.
const LEGACY_EDGE_ADMIN_KEY = "edge_admin_key_v1";
const WORKFLOW_ADMIN_KEY = "workflow_admin_key_v1";
const ANDROID_KEYSTORE_EXPORT_ADMIN_KEY = "android_keystore_export_admin_key_v1";
const SIGNING_ADMIN_KEY = "signing_admin_key_v1";
const SIGNING_MASTER_KEY = "signing_master_key_v1";

const getSafeErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message.trim() ? error.message : String(error);

export class SecureTokenReadError extends Error {
  readonly code = "securestore_unreadable";
  readonly storageKey: string;

  constructor(storageKey: string, causeMessage: string) {
    super(`SecureStore-Lesen fehlgeschlagen (${storageKey}): ${causeMessage}`);
    this.name = "SecureTokenReadError";
    this.storageKey = storageKey;
  }
}

type SecureTokenReadResult = {
  value: string | null;
  unreadable: boolean;
  errorMessage?: string;
};

const saveSecureToken = async (key: string, value: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error: unknown) {
    logger.error("[SecureStore] Speichern fehlgeschlagen", { key, err: error });
    throw new Error(
      `Token konnte nicht sicher gespeichert werden: ${getSafeErrorMessage(error)}`,
    );
  }
};

const readSecureToken = async (key: string): Promise<SecureTokenReadResult> => {
  try {
    return {
      value: await SecureStore.getItemAsync(key),
      unreadable: false,
    };
  } catch (error: unknown) {
    logger.error("[SecureStore] Laden fehlgeschlagen", { key, err: error });
    return {
      value: null,
      unreadable: true,
      errorMessage: getSafeErrorMessage(error),
    };
  }
};

const getSecureToken = async (key: string): Promise<string | null> => {
  const read = await readSecureToken(key);
  if (read.unreadable) {
    throw new SecureTokenReadError(key, read.errorMessage ?? "unbekannter Fehler");
  }
  return read.value;
};

const deleteSecureToken = async (key: string): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error: unknown) {
    logger.error("[SecureStore] Löschen fehlgeschlagen", { key, err: error });
  }
};

async function migrateLegacyToken(legacyKey: string, newKey: string): Promise<void> {
  const legacy = await getSecureToken(legacyKey);
  if (!legacy) return;

  const current = await getSecureToken(newKey);
  if (!current) {
    await saveSecureToken(newKey, legacy);
  }

  // Always clear legacy after we successfully read it.
  await deleteSecureToken(legacyKey);
}

// ----------------------
// GitHub token
// ----------------------
export const saveGitHubToken = async (token: string): Promise<void> => {
  await saveSecureToken(TOKEN_KEYS.github, token);
};

export const getGitHubToken = async (): Promise<string | null> => {
  await migrateLegacyToken(LEGACY_GH_TOKEN_KEY, TOKEN_KEYS.github);
  return getSecureToken(TOKEN_KEYS.github);
};

export const deleteGitHubToken = async (): Promise<void> => {
  await deleteSecureToken(TOKEN_KEYS.github);
  await deleteSecureToken(LEGACY_GH_TOKEN_KEY);
};

export const hasValidGitHubToken = async (): Promise<boolean> => {
  const value = await getGitHubToken();
  return !!value;
};

// ----------------------
// Expo token
// ----------------------
export const saveExpoToken = async (token: string): Promise<void> => {
  await saveSecureToken(TOKEN_KEYS.expo, token);
};

export const getExpoToken = async (): Promise<string | null> => {
  await migrateLegacyToken(LEGACY_EXPO_TOKEN_KEY, TOKEN_KEYS.expo);
  return getSecureToken(TOKEN_KEYS.expo);
};

export const deleteExpoToken = async (): Promise<void> => {
  await deleteSecureToken(TOKEN_KEYS.expo);
  await deleteSecureToken(LEGACY_EXPO_TOKEN_KEY);
};

export const hasValidExpoToken = async (): Promise<boolean> => {
  const value = await getExpoToken();
  return !!value;
};

// ----------------------
// Scoped/legacy local admin keys
// ----------------------
const saveOptionalScopedKey = async (storageKey: string, key: string): Promise<void> => {
  const v = (key ?? "").trim();
  if (!v) {
    await deleteSecureToken(storageKey);
    return;
  }
  await saveSecureToken(storageKey, v);
};

export const getWorkflowAdminKey = async (): Promise<string | null> => {
  const workflowRead = await readSecureToken(WORKFLOW_ADMIN_KEY);
  if (workflowRead.unreadable) {
    throw new SecureTokenReadError(WORKFLOW_ADMIN_KEY, workflowRead.errorMessage ?? "unbekannter Fehler");
  }
  const workflowKey = workflowRead.value;
  if (workflowKey) {
    return workflowKey;
  }

  // Controlled one-time compat migration:
  // If only the legacy edge admin key exists, seed workflow scope once.
  const legacyRead = await readSecureToken(LEGACY_EDGE_ADMIN_KEY);
  if (legacyRead.unreadable) {
    throw new SecureTokenReadError(LEGACY_EDGE_ADMIN_KEY, legacyRead.errorMessage ?? "unbekannter Fehler");
  }
  const legacyEdgeKey = legacyRead.value;
  if (!legacyEdgeKey) {
    return null;
  }

  await saveSecureToken(WORKFLOW_ADMIN_KEY, legacyEdgeKey);
  return legacyEdgeKey;
};

export const saveWorkflowAdminKey = async (key: string): Promise<void> => {
  await saveOptionalScopedKey(WORKFLOW_ADMIN_KEY, key);
};

export const deleteWorkflowAdminKey = async (): Promise<void> => {
  await deleteSecureToken(WORKFLOW_ADMIN_KEY);
};

export const getAndroidKeystoreExportAdminKey = async (): Promise<string | null> => {
  return getSecureToken(ANDROID_KEYSTORE_EXPORT_ADMIN_KEY);
};

export const saveAndroidKeystoreExportAdminKey = async (key: string): Promise<void> => {
  await saveOptionalScopedKey(ANDROID_KEYSTORE_EXPORT_ADMIN_KEY, key);
};

export const deleteAndroidKeystoreExportAdminKey = async (): Promise<void> => {
  await deleteSecureToken(ANDROID_KEYSTORE_EXPORT_ADMIN_KEY);
};

export const getSigningAdminKey = async (): Promise<string | null> => {
  return getSecureToken(SIGNING_ADMIN_KEY);
};

export const saveSigningAdminKey = async (key: string): Promise<void> => {
  await saveOptionalScopedKey(SIGNING_ADMIN_KEY, key);
};

export const deleteSigningAdminKey = async (): Promise<void> => {
  await deleteSecureToken(SIGNING_ADMIN_KEY);
};

export const getLegacyEdgeAdminKey = async (): Promise<string | null> => {
  return getSecureToken(LEGACY_EDGE_ADMIN_KEY);
};

export const saveLegacyEdgeAdminKey = async (key: string): Promise<void> => {
  await saveOptionalScopedKey(LEGACY_EDGE_ADMIN_KEY, key);
};

export const deleteLegacyEdgeAdminKey = async (): Promise<void> => {
  await deleteSecureToken(LEGACY_EDGE_ADMIN_KEY);
};

// ----------------------
// Signing Master Key (optional)
// ----------------------
export const getSigningMasterKey = async (): Promise<string | null> => {
  return getSecureToken(SIGNING_MASTER_KEY);
};

export const saveSigningMasterKey = async (key: string): Promise<void> => {
  const v = (key ?? "").trim();
  if (!v) {
    await deleteSecureToken(SIGNING_MASTER_KEY);
    return;
  }
  await saveSecureToken(SIGNING_MASTER_KEY, v);
};

export const deleteSigningMasterKey = async (): Promise<void> => {
  await deleteSecureToken(SIGNING_MASTER_KEY);
};
