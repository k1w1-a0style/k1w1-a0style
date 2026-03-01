import type { ProjectFile } from "../../shared/types/project";
import type { PreflightPatch } from "./preflightTypes";
import { applyJsonMergePatchSafe } from "./smartPatch";

/**
 * Applies a PreflightPatch in deterministic order:
 * delete -> upsert -> jsonMerge.
 */
export async function applyPatch(
  files: ProjectFile[],
  patch: PreflightPatch,
): Promise<ProjectFile[]> {
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
