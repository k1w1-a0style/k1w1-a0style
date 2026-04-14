import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "./storageKeys";

export function easProjectIdKeyForRepo(repoFullName?: string | null): string {
  const repo = String(repoFullName ?? "").trim().toLowerCase();
  if (!repo) return STORAGE_KEYS.EAS_PROJECT_ID;
  return `${STORAGE_KEYS.EAS_PROJECT_ID}::${encodeURIComponent(repo)}`;
}

export async function readScopedEasProjectId(repoFullName?: string | null): Promise<string> {
  const scoped = await AsyncStorage.getItem(easProjectIdKeyForRepo(repoFullName));
  const scopedTrimmed = String(scoped ?? "").trim();
  if (scopedTrimmed) return scopedTrimmed;
  const legacy = await AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID);
  return String(legacy ?? "").trim();
}

export async function persistScopedEasProjectId(params: {
  projectId: string;
  repoFullName?: string | null;
}): Promise<void> {
  const projectId = String(params.projectId ?? "").trim();
  const scopedKey = easProjectIdKeyForRepo(params.repoFullName);
  if (projectId) {
    await AsyncStorage.setItem(scopedKey, projectId);
    await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, projectId);
    return;
  }
  await AsyncStorage.removeItem(scopedKey);
  if (scopedKey === STORAGE_KEYS.EAS_PROJECT_ID) {
    await AsyncStorage.removeItem(STORAGE_KEYS.EAS_PROJECT_ID);
  }
}
