import type { ProjectFile } from "../../../shared/types/project";
import type { PreflightPatch } from "../../../lib/diagnostics/preflightTypes";
import { validateFilePath } from "../../../lib/validators";
import { parseOwnerRepo } from "../../../lib/diagnostics/ciAutoFix";

export const normalizeFilesForCompare = (files: ProjectFile[]) =>
  [...files]
    .map((file) => ({ path: file.path, content: file.content }))
    .sort((a, b) => a.path.localeCompare(b.path));

export const sameProjectFiles = (left: ProjectFile[], right: ProjectFile[]) => {
  const a = normalizeFilesForCompare(left);
  const b = normalizeFilesForCompare(right);
  if (a.length !== b.length) return false;
  return a.every((file, index) => file.path === b[index]?.path && file.content === b[index]?.content);
};

export const collectPatchTouchedPaths = (patch: PreflightPatch): string[] => {
  const raw = [
    ...(patch.upsert ?? []).map((u) => u.path),
    ...(patch.delete ?? []).map((p) => p),
    ...(patch.jsonMerge ?? []).map((j) => j.path),
  ];
  const out: string[] = [];
  for (const p of raw) {
    const v = validateFilePath(p);
    if (v.valid && v.normalized) out.push(v.normalized);
  }
  return Array.from(new Set(out)).sort();
};

export const shouldSyncPatchToGitHub = (params: {
  patch: PreflightPatch;
  syncFixesToGitHub: boolean;
  linkedRepo: string;
}): boolean => {
  const { patch, syncFixesToGitHub, linkedRepo } = params;
  if (!syncFixesToGitHub) return false;
  if (!parseOwnerRepo(linkedRepo)) return false;

  const touched = collectPatchTouchedPaths(patch);
  return touched.some(isSyncRelevantPath);
};

export const isSyncRelevantPath = (path: string): boolean => {
  if (path === "eas.json") return true;
  if (path === "eas-project.json") return true;
  if (path === "package.json") return true;
  if (path === "app.json" || path === "app.config.js" || path === "app.config.ts") return true;
  if (path.startsWith(".github/workflows/")) return true;
  return false;
};
