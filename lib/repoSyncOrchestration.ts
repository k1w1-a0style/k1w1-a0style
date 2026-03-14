import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ProjectFile } from "../shared/types/project";

export type RepoSyncState = "in_sync" | "out_of_sync" | "unknown";

function scopeKey(repo: string, branch: string): string {
  return `repo_sync_signature::${encodeURIComponent(repo.trim().toLowerCase())}::${encodeURIComponent(branch.trim())}`;
}

export function computeProjectFilesSignature(files: ProjectFile[]): string {
  const normalized = (Array.isArray(files) ? files : [])
    .map((f) => ({
      path: String(f?.path ?? "").trim(),
      content: String(f?.content ?? ""),
    }))
    .filter((f) => !!f.path)
    .sort((a, b) => a.path.localeCompare(b.path));

  let hash = 2166136261;
  for (const file of normalized) {
    const line = `${file.path}\n${file.content}\n`;
    for (let i = 0; i < line.length; i++) {
      hash ^= line.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `${normalized.length}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export async function markRepoSyncSignature(params: {
  linkedRepo?: string | null;
  linkedBranch?: string | null;
  files: ProjectFile[];
  storageSetItem?: (key: string, value: string) => Promise<void>;
}): Promise<void> {
  const repo = String(params.linkedRepo ?? "").trim();
  const branch = String(params.linkedBranch ?? "").trim();
  if (!repo || !branch) return;
  const setItem = params.storageSetItem ?? ((key: string, value: string) => AsyncStorage.setItem(key, value));
  const sig = computeProjectFilesSignature(params.files);
  await setItem(scopeKey(repo, branch), sig);
}

export async function getRepoSyncState(params: {
  linkedRepo?: string | null;
  linkedBranch?: string | null;
  files: ProjectFile[];
  storageGetItem?: (key: string) => Promise<string | null>;
}): Promise<RepoSyncState> {
  const repo = String(params.linkedRepo ?? "").trim();
  const branch = String(params.linkedBranch ?? "").trim();
  if (!repo || !branch) return "unknown";

  const getItem = params.storageGetItem ?? ((key: string) => AsyncStorage.getItem(key));
  const stored = (await getItem(scopeKey(repo, branch)).catch(() => null)) ?? "";
  if (!stored.trim()) return "unknown";

  const current = computeProjectFilesSignature(params.files);
  return stored === current ? "in_sync" : "out_of_sync";
}
