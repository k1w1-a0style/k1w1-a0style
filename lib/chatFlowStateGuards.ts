import type { ApplyFilesResult } from "./fileWriter";
import { applyFilesToProject } from "./fileWriter";
import type { ProjectFile } from "../shared/types/project";

export type PendingChangeLike = {
  files: ProjectFile[];
  proposedFiles?: ProjectFile[];
  baseProjectDigest?: string;
};

export function buildProjectStateDigest(files: ProjectFile[]): string {
  const normalized = [...(files ?? [])]
    .map((f) => ({ path: String(f.path ?? ""), content: String(f.content ?? "") }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return normalized.map((f) => `${f.path}:${f.content.length}`).join("|");
}

export function rebasePendingChangeOnLatest(
  latestFiles: ProjectFile[],
  pending: PendingChangeLike,
): {
  applyResult: ApplyFilesResult;
  driftDetected: boolean;
} {
  const incoming = pending.proposedFiles?.length ? pending.proposedFiles : pending.files;
  const applyResult = applyFilesToProject(latestFiles, incoming);
  const latestDigest = buildProjectStateDigest(latestFiles);

  return {
    applyResult,
    driftDetected: Boolean(pending.baseProjectDigest && pending.baseProjectDigest !== latestDigest),
  };
}

