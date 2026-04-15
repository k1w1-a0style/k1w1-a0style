import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../../lib/storageKeys";

export type SecretImportDerivedStatusSnapshot = {
  entries: Array<[string, string]>;
};

function resolveStaticStatusKeys(): string[] {
  return [
    STORAGE_KEYS.CONN_GITHUB_OK,
    STORAGE_KEYS.CONN_GITHUB_USER,
    STORAGE_KEYS.CONN_GITHUB_SCOPES,
    STORAGE_KEYS.CONN_EXPO_OK,
    STORAGE_KEYS.CONN_EXPO_USER,
    STORAGE_KEYS.CONN_SUPABASE_OK,
    STORAGE_KEYS.CONN_SUPABASE_REF,
    STORAGE_KEYS.CONN_EAS_OK,
    STORAGE_KEYS.CONN_EAS_STATE,
    STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT,
    STORAGE_KEYS.CONN_REPO_OK,
    STORAGE_KEYS.CONN_REPO_SLUG,
    STORAGE_KEYS.CONN_REPO_BRANCH,
    STORAGE_KEYS.DIAGNOSTIC_LAST_OK,
    STORAGE_KEYS.DIAGNOSTIC_READINESS_RECORD,
    STORAGE_KEYS.CI_LITE_LINT_OK,
    STORAGE_KEYS.CI_LITE_TYPECHECK_OK,
    STORAGE_KEYS.CI_LITE_LAST_RUN_AT,
    STORAGE_KEYS.CI_LITE_LAST_REPO,
    STORAGE_KEYS.CI_LITE_LAST_BRANCH,
    STORAGE_KEYS.CI_LITE_LAST_SHA,
    STORAGE_KEYS.CI_LITE_LAST_WORKFLOW,
    STORAGE_KEYS.CI_LITE_LAST_JOB_ID,
    STORAGE_KEYS.CI_LITE_LAST_RUN_ID,
    STORAGE_KEYS.CI_LITE_LAST_CONCLUSION,
  ];
}

function resolveDynamicStatusPrefixes(): string[] {
  return [
    `${STORAGE_KEYS.CRED_KEY_EXISTS_DEV}::`,
    `${STORAGE_KEYS.CRED_KEY_EXISTS_PREVIEW}::`,
    `${STORAGE_KEYS.CRED_KEY_EXISTS_PRODUCTION}::`,
    `${STORAGE_KEYS.CRED_KEY_EXISTS_DEV}_state::`,
    `${STORAGE_KEYS.CRED_KEY_EXISTS_PREVIEW}_state::`,
    `${STORAGE_KEYS.CRED_KEY_EXISTS_PRODUCTION}_state::`,
    `${STORAGE_KEYS.CRED_KEY_EXISTS_DEV}_detail::`,
    `${STORAGE_KEYS.CRED_KEY_EXISTS_PREVIEW}_detail::`,
    `${STORAGE_KEYS.CRED_KEY_EXISTS_PRODUCTION}_detail::`,
    `${STORAGE_KEYS.DIAGNOSTIC_LAST_OK}::`,
    `${STORAGE_KEYS.DIAGNOSTIC_READINESS_RECORD}::`,
    `${STORAGE_KEYS.CI_LITE_SCOPED_SNAPSHOT}::`,
  ];
}

async function resolveStatusKeysToReset(): Promise<string[]> {
  const allKeys = await AsyncStorage.getAllKeys();
  const dynamicPrefixes = resolveDynamicStatusPrefixes();
  const dynamicKeys = allKeys.filter((key) =>
    dynamicPrefixes.some((prefix) => key.startsWith(prefix)),
  );
  const scopedStatusKeys = [
    STORAGE_KEYS.CRED_KEY_EXISTS_DEV,
    STORAGE_KEYS.CRED_KEY_EXISTS_PREVIEW,
    STORAGE_KEYS.CRED_KEY_EXISTS_PRODUCTION,
    `${STORAGE_KEYS.CRED_KEY_EXISTS_DEV}_state`,
    `${STORAGE_KEYS.CRED_KEY_EXISTS_PREVIEW}_state`,
    `${STORAGE_KEYS.CRED_KEY_EXISTS_PRODUCTION}_state`,
    `${STORAGE_KEYS.CRED_KEY_EXISTS_DEV}_detail`,
    `${STORAGE_KEYS.CRED_KEY_EXISTS_PREVIEW}_detail`,
    `${STORAGE_KEYS.CRED_KEY_EXISTS_PRODUCTION}_detail`,
  ];
  return [...new Set([...resolveStaticStatusKeys(), ...scopedStatusKeys, ...dynamicKeys])];
}

export async function snapshotDerivedStatusBeforeSecretImport(): Promise<SecretImportDerivedStatusSnapshot> {
  const keys = await resolveStatusKeysToReset();
  const values = await AsyncStorage.multiGet(keys);
  return {
    entries: values.filter((entry): entry is [string, string] => entry[1] !== null),
  };
}

export async function restoreDerivedStatusAfterSecretImportRollback(
  snapshot: SecretImportDerivedStatusSnapshot,
): Promise<void> {
  const keysToReset = await resolveStatusKeysToReset();
  const restoredEntries = new Map(snapshot.entries);
  const keysToRemove = keysToReset.filter((key) => !restoredEntries.has(key));

  if (snapshot.entries.length > 0) {
    await AsyncStorage.multiSet(snapshot.entries);
  }
  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
  }
}

export async function resetDerivedStatusAfterSecretImport(): Promise<void> {
  const keysToReset = await resolveStatusKeysToReset();
  await AsyncStorage.multiRemove(keysToReset);
}
