import * as SecureStore from "expo-secure-store";
import { logger } from "../../lib/logger";

import { TOKEN_KEYS } from "../../shared/constants/tokens";

// Legacy keys (kept for one-time migration)
const LEGACY_GH_TOKEN_KEY = "github_pat_v1";
const LEGACY_EXPO_TOKEN_KEY = "expo_token_v1";

// These are intentionally versioned because they are optional / power-user inputs.
const EDGE_ADMIN_KEY = "edge_admin_key_v1";
const SIGNING_MASTER_KEY = "signing_master_key_v1";

const saveSecureToken = async (key: string, value: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    logger.error("[SecureStore] Speichern fehlgeschlagen", { key, err: error });
    throw new Error(
      `Token konnte nicht sicher gespeichert werden: ${error?.message ?? String(error)}`,
    );
  }
};

const getSecureToken = async (key: string): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    logger.error("[SecureStore] Laden fehlgeschlagen", { key, err: error });
    return null;
  }
};

const deleteSecureToken = async (key: string): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error: any) {
    // eslint-disable-next-line no-console
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
// Edge Admin Key (optional)
// ----------------------
export const getEdgeAdminKey = async (): Promise<string | null> => {
  return getSecureToken(EDGE_ADMIN_KEY);
};

export const saveEdgeAdminKey = async (key: string): Promise<void> => {
  const v = (key ?? "").trim();
  if (!v) {
    await deleteSecureToken(EDGE_ADMIN_KEY);
    return;
  }
  await saveSecureToken(EDGE_ADMIN_KEY, v);
};

export const deleteEdgeAdminKey = async (): Promise<void> => {
  await deleteSecureToken(EDGE_ADMIN_KEY);
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