import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "./storageKeys";

export function easProjectIdKeyForRepo(repoFullName?: string | null): string {
  const repo = String(repoFullName ?? "").trim().toLowerCase();
  if (!repo) return STORAGE_KEYS.EAS_PROJECT_ID;
  return `${STORAGE_KEYS.EAS_PROJECT_ID}::${encodeURIComponent(repo)}`;
}

export async function readScopedEasProjectId(repoFullName?: string | null): Promise<string> {
  const repo = String(repoFullName ?? "").trim();
  if (!repo) return "";
  const scoped = await AsyncStorage.getItem(easProjectIdKeyForRepo(repo));
  return String(scoped ?? "").trim();
}

export async function persistScopedEasProjectId(params: {
  projectId: string;
  repoFullName?: string | null;
}): Promise<void> {
  const projectId = String(params.projectId ?? "").trim();
  const repo = String(params.repoFullName ?? "").trim();
  if (!repo) return;
  const scopedKey = easProjectIdKeyForRepo(repo);
  if (projectId) {
    await AsyncStorage.setItem(scopedKey, projectId);
    return;
  }
  await AsyncStorage.removeItem(scopedKey);
}
