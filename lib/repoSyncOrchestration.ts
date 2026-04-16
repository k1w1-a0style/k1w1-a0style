import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizePath } from "./validators";

import type { ProjectFile } from "../shared/types/project";

export type RepoSyncState = "in_sync" | "out_of_sync" | "unknown";

type AsyncStorageLike = {
  getItem?: ((key: string) => Promise<string | null>) | undefined;
  setItem?: ((key: string, value: string) => Promise<void>) | undefined;
  default?: AsyncStorageLike | undefined;
};

function resolveAsyncStorageGetItem(): ((key: string) => Promise<string | null>) | null {
  const storage = AsyncStorage as AsyncStorageLike;
  return storage.getItem ?? storage.default?.getItem ?? storage.default?.default?.getItem ?? null;
}

function resolveAsyncStorageSetItem(): ((key: string, value: string) => Promise<void>) | null {
  const storage = AsyncStorage as AsyncStorageLike;
  return storage.setItem ?? storage.default?.setItem ?? storage.default?.default?.setItem ?? null;
}

function scopeKey(repo: string, branch: string): string {
  return `repo_sync_signature::${encodeURIComponent(repo.trim().toLowerCase())}::${encodeURIComponent(branch.trim())}`;
}

function canonicalizeFilesForSignature(files: ProjectFile[]): {
  normalized: Array<{ path: string; content: string }>;
  hasConflicts: boolean;
} {
  const byPath = new Map<string, string>();
  let hasConflicts = false;

  for (const file of Array.isArray(files) ? files : []) {
    const path = normalizePath(String(file?.path ?? ""));
    if (!path) continue;
    const content = String(file?.content ?? "");
    const previous = byPath.get(path);
    if (typeof previous === "string" && previous !== content) {
      hasConflicts = true;
      continue;
    }
    byPath.set(path, content);
  }

  return {
    normalized: Array.from(byPath.entries())
      .map(([path, content]) => ({ path, content }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    hasConflicts,
  };
}

export function computeProjectFilesSignature(files: ProjectFile[]): string {
  const { normalized } = canonicalizeFilesForSignature(files);

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
  const asyncStorageSetItem = resolveAsyncStorageSetItem();
  const setItem =
    params.storageSetItem ??
    (asyncStorageSetItem
      ? ((key: string, value: string) => asyncStorageSetItem(key, value))
      : null);
  if (!setItem) return;
  const { hasConflicts } = canonicalizeFilesForSignature(params.files);
  if (hasConflicts) return;
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

  const asyncStorageGetItem = resolveAsyncStorageGetItem();
  const getItem =
    params.storageGetItem ??
    (asyncStorageGetItem ? ((key: string) => asyncStorageGetItem(key)) : null);
  if (!getItem) return "unknown";
  const { hasConflicts } = canonicalizeFilesForSignature(params.files);
  if (hasConflicts) return "unknown";
  const stored = (await getItem(scopeKey(repo, branch)).catch(() => null)) ?? "";
  if (!stored.trim()) return "unknown";

  const current = computeProjectFilesSignature(params.files);
  return stored === current ? "in_sync" : "out_of_sync";
}
