import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "./storageKeys";
import { validateGitHubRepo } from "./validators";

function normalizeRepoScope(repoFullName?: string | null): string {
  const raw = String(repoFullName ?? "").trim();
  if (!raw) return "";
  const parsed = validateGitHubRepo(raw);
  if (!parsed.valid || !parsed.owner || !parsed.name) return "";
  return `${parsed.owner}/${parsed.name}`.toLowerCase();
}

export function easProjectIdKeyForRepo(repoFullName?: string | null): string {
  const repo = normalizeRepoScope(repoFullName);
  if (!repo) return "";
  return `${STORAGE_KEYS.EAS_PROJECT_ID}::${encodeURIComponent(repo)}`;
}

export async function readScopedEasProjectId(repoFullName?: string | null): Promise<string> {
  const repo = normalizeRepoScope(repoFullName);
  if (!repo) return "";
  const scoped = await AsyncStorage.getItem(easProjectIdKeyForRepo(repo));
  return String(scoped ?? "").trim();
}

export async function persistScopedEasProjectId(params: {
  projectId: string;
  repoFullName?: string | null;
}): Promise<void> {
  const projectId = String(params.projectId ?? "").trim();
  const repo = normalizeRepoScope(params.repoFullName);
  if (!repo) return;
  const scopedKey = easProjectIdKeyForRepo(repo);
  if (!scopedKey) return;
  if (projectId) {
    await AsyncStorage.setItem(scopedKey, projectId);
    return;
  }
  await AsyncStorage.removeItem(scopedKey);
}
