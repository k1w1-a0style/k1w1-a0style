import type { ProjectFile } from "../../../shared/types/project";
import { logger } from "../../../lib/logger";
import { MANAGED_WORKFLOWS, normalizeRepoPath } from "../utils";

export type NormalizedRepoFile = {
  path: string;
  content: string;
};

export const normalizeFilesForRepoPush = (files: ProjectFile[]): NormalizedRepoFile[] => {
  return [...files]
    .map((file) => {
      const originalPath = String(file.path || "").trim();
      const path = normalizeRepoPath(originalPath);
      if (originalPath && !path) {
        throw new Error(`Ungültiger Repo-Pfad: ${originalPath}`);
      }
      return {
        path,
        content: String(file.content ?? ""),
      };
    })
    .filter((file) => !!file.path)
    .filter((file) => {
      if (file.path.startsWith(".github/workflows/") && !MANAGED_WORKFLOWS.has(file.path)) {
        logger.debug(`[normalizeFilesForRepoPush] Skip unmanaged workflow file: ${file.path}`);
        return false;
      }
      return true;
    })
    .sort((a, b) => a.path.localeCompare(b.path));
};

export const normalizePatchUpserts = (upserts: ProjectFile[]): NormalizedRepoFile[] => {
  return [...upserts]
    .map((file) => {
      const originalPath = String(file.path || "").trim();
      const path = normalizeRepoPath(originalPath);
      if (originalPath && !path) throw new Error(`Ungültiger Repo-Pfad: ${originalPath}`);
      return { path, content: String(file.content ?? "") };
    })
    .filter((file) => !!file.path)
    .filter((file) => !file.path.startsWith(".github/workflows/") || MANAGED_WORKFLOWS.has(file.path))
    .sort((a, b) => a.path.localeCompare(b.path));
};

export const normalizePatchDeletes = (deletes: string[]): string[] => {
  return [...deletes]
    .map((path) => normalizeRepoPath(String(path || "").trim()))
    .filter((path): path is string => !!path)
    .filter((path) => !path.startsWith(".github/workflows/") || MANAGED_WORKFLOWS.has(path))
    .sort((a, b) => a.localeCompare(b));
};
