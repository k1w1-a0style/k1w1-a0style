import type { ProjectFile } from "../../../shared/types/project";
import type { PreflightPatch } from "../../../lib/diagnostics/preflightTypes";
import { validateFileContent, validateFilePath } from "../../../lib/validators";

import type { FixHistoryEntry } from "../types";

export const countPatchOperations = (patch: PreflightPatch): number =>
  (patch.upsert?.length ?? 0) + (patch.delete?.length ?? 0) + (patch.jsonMerge?.length ?? 0);

export const collectNormalizedTouchedPaths = (patch: PreflightPatch): string[] => {
  const touchedPaths = Array.from(
    new Set<string>([
      ...(patch.upsert ?? []).map((u) => u.path),
      ...(patch.delete ?? []).map((p) => p),
      ...(patch.jsonMerge ?? []).map((j) => j.path),
    ]),
  );

  return touchedPaths
    .map((p) => {
      const v = validateFilePath(p);
      if (!v.valid || !v.normalized)
        throw new Error(`Ungültiger Pfad im Patch: ${p} (${v.errors.join(", ") || "invalid"})`);
      return v.normalized;
    })
    .sort();
};

export const buildPatchApplyState = async (params: {
  patch: PreflightPatch;
  currentFiles: ProjectFile[];
  applyJsonMerge: (files: ProjectFile[], jsonMerge: NonNullable<PreflightPatch["jsonMerge"]>) => Promise<ProjectFile[]>;
}): Promise<{
  nextFiles: ProjectFile[];
  snapshot: ProjectFile[];
  createdPaths: string[];
  deletePaths: string[];
}> => {
  const normalizedTouched = collectNormalizedTouchedPaths(params.patch);
  const currentMap = new Map(params.currentFiles.map((f) => [f.path, f] as const));
  const snapshot: ProjectFile[] = [];
  const createdPaths: string[] = [];

  for (const p of normalizedTouched) {
    const prev = currentMap.get(p);
    if (prev) snapshot.push(prev);
    else createdPaths.push(p);
  }

  const nextMap = new Map(params.currentFiles.map((f) => [f.path, f.content] as const));
  for (const u of params.patch.upsert ?? []) {
    const pv = validateFilePath(u.path);
    if (!pv.valid || !pv.normalized)
      throw new Error(`Ungültiger Pfad im Patch: ${u.path} (${pv.errors.join(", ") || "invalid"})`);
    const cv = validateFileContent(u.content ?? "");
    if (!cv.valid) throw new Error(`Ungültiger File-Content für ${u.path}: ${cv.error ?? "unknown"}`);
    nextMap.set(pv.normalized, u.content ?? "");
  }

  for (const p of params.patch.delete ?? []) {
    const pv = validateFilePath(p);
    if (!pv.valid || !pv.normalized)
      throw new Error(`Ungültiger Pfad im Patch: ${p} (${pv.errors.join(", ") || "invalid"})`);
    nextMap.delete(pv.normalized);
  }

  if (params.patch.jsonMerge?.length) {
    const merged = await params.applyJsonMerge(
      Array.from(nextMap.entries()).map(([path, content]) => ({ path, content })),
      params.patch.jsonMerge,
    );
    nextMap.clear();
    for (const f of merged) nextMap.set(f.path, f.content);
  }

  const nextFiles: ProjectFile[] = Array.from(nextMap.entries()).map(([path, content]) => ({
    path,
    content,
  }));

  const deletePaths = (params.patch.delete ?? [])
    .map((p) => {
      const pv = validateFilePath(p);
      return pv.valid && pv.normalized ? pv.normalized : null;
    })
    .filter(Boolean) as string[];

  return { nextFiles, snapshot, createdPaths, deletePaths };
};

export const applyUndoHistoryEntry = async (params: {
  entry: FixHistoryEntry;
  deleteFile: (path: string) => Promise<void>;
  updateProjectFiles: (files: ProjectFile[]) => Promise<void>;
}) => {
  for (const p of params.entry.createdPaths ?? []) await params.deleteFile(p);
  if (params.entry.snapshot.length) await params.updateProjectFiles(params.entry.snapshot);
};
