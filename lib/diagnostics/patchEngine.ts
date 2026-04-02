import type { ProjectFile } from "../../shared/types/project";
import type { PreflightPatch } from "./preflightTypes";
import { applyJsonMergePatchSafe } from "./smartPatch";

const MAX_PATCH_OPERATIONS = 200;

function isUnsafePatchPath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed) return true;
  if (trimmed.includes("\0")) return true;
  if (trimmed.startsWith("/") || trimmed.startsWith("\\")) return true;
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) return true;

  const normalizedSeparators = trimmed.replace(/\\/g, "/");
  return normalizedSeparators.split("/").includes("..");
}

function assertPatchSafety(patch: PreflightPatch): void {
  const deletePaths = patch.delete ?? [];
  const upsertPaths = (patch.upsert ?? []).map((file) => file.path);
  const jsonMergePaths = (patch.jsonMerge ?? []).map((entry) => entry.path);
  const allPaths = [...deletePaths, ...upsertPaths, ...jsonMergePaths];

  if (allPaths.length > MAX_PATCH_OPERATIONS) {
    throw new Error(
      `Patch abgebrochen: ${allPaths.length} Operationen ueberschreiten das Limit ${MAX_PATCH_OPERATIONS}.`,
    );
  }

  for (const path of allPaths) {
    if (isUnsafePatchPath(path)) {
      throw new Error(`Patch abgebrochen: Unsicherer Dateipfad \"${path}\".`);
    }
  }
}

/**
 * Applies a PreflightPatch in deterministic order:
 * delete -> upsert -> jsonMerge.
 */
export async function applyPatch(
  files: ProjectFile[],
  patch: PreflightPatch,
): Promise<ProjectFile[]> {
  assertPatchSafety(patch);

  const nextMap = new Map(files.map((f) => [f.path, f.content] as const));

  for (const path of patch.delete ?? []) {
    nextMap.delete(path);
  }

  for (const file of patch.upsert ?? []) {
    nextMap.set(file.path, file.content ?? "");
  }

  let nextFiles: ProjectFile[] = Array.from(nextMap.entries()).map(([path, content]) => ({
    path,
    content,
  }));

  if (patch.jsonMerge?.length) {
    nextFiles = await applyJsonMergePatchSafe(nextFiles, patch.jsonMerge);
  }

  return nextFiles;
}


export const applyPreflightPatch = applyPatch;
