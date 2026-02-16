import * as SecureStore from "expo-secure-store";

const GH_TOKEN_KEY = "github_pat_v1";
const EXPO_TOKEN_KEY = "expo_token_v1";
const EDGE_ADMIN_KEY = "edge_admin_key_v1";
const SUPABASE_SERVICE_ROLE_KEY = "supabase_service_role_key_v1";

// ✅ FIX: SecureStore Wrapper-Funktionen (verschlüsselt!)
const saveSecureToken = async (key: string, value: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error: any) {
    console.error(`[SecureStore] Fehler beim Speichern von ${key}:`, error);
    throw new Error(
      `Token konnte nicht sicher gespeichert werden: ${error.message}`,
    );
  }
};

const getSecureToken = async (key: string): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error: any) {
    console.error(`[SecureStore] Fehler beim Laden von ${key}:`, error);
    return null;
  }
};

const deleteSecureToken = async (key: string): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error: any) {
    console.error(`[SecureStore] Fehler beim Löschen von ${key}:`, error);
  }
};

// ----------------------
// GitHub token
// ----------------------
export const saveGitHubToken = async (token: string): Promise<void> => {
  await saveSecureToken(GH_TOKEN_KEY, token);
  console.log("✅ GitHub Token sicher gespeichert (SecureStore).");
};

export const getGitHubToken = async (): Promise<string | null> => {
  return getSecureToken(GH_TOKEN_KEY);
};

export const deleteGitHubToken = async (): Promise<void> => {
  await deleteSecureToken(GH_TOKEN_KEY);
};

export const hasValidGitHubToken = async (): Promise<boolean> => {
  const value = await getGitHubToken();
  return !!value;
};

// ----------------------
// Expo token
// ----------------------
export const saveExpoToken = async (token: string): Promise<void> => {
  await saveSecureToken(EXPO_TOKEN_KEY, token);
  console.log("✅ Expo Token sicher gespeichert (SecureStore).");
};

export const getExpoToken = async (): Promise<string | null> => {
  return getSecureToken(EXPO_TOKEN_KEY);
};

export const deleteExpoToken = async (): Promise<void> => {
  await deleteSecureToken(EXPO_TOKEN_KEY);
};

export const hasValidExpoToken = async (): Promise<boolean> => {
  const value = await getExpoToken();
  return !!value;
};

// ----------------------
// Edge Admin Key (optional)
// ----------------------
export const getEdgeAdminKey = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(EDGE_ADMIN_KEY);
};

export const saveEdgeAdminKey = async (key: string): Promise<void> => {
  const v = (key ?? "").trim();
  if (!v) {
    await SecureStore.deleteItemAsync(EDGE_ADMIN_KEY);
    return;
  }
  await SecureStore.setItemAsync(EDGE_ADMIN_KEY, v);
};

export const deleteEdgeAdminKey = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(EDGE_ADMIN_KEY);
};

// ----------------------
// Supabase Service Role Key (HIGHLY SENSITIVE) -> SecureStore
// ----------------------
export const getSupabaseServiceRoleKey = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(SUPABASE_SERVICE_ROLE_KEY);
};

export const saveSupabaseServiceRoleKey = async (key: string): Promise<void> => {
  const v = (key ?? "").trim();
  if (!v) {
    await SecureStore.deleteItemAsync(SUPABASE_SERVICE_ROLE_KEY);
    return;
  }
  await SecureStore.setItemAsync(SUPABASE_SERVICE_ROLE_KEY, v);
};

export const deleteSupabaseServiceRoleKey = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(SUPABASE_SERVICE_ROLE_KEY);
};
