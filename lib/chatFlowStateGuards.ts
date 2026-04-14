// NOTE: This module runs inside the React Native app runtime (via useChatAIFlow).
// Keep it free of Node-only imports (e.g. `node:crypto` / `crypto`) to avoid Metro
// resolution failures on device bundles.
import type { ApplyFilesResult } from "./fileWriter";
import { applyFileOpsToProject } from "./fileWriter";
import type { ProjectFile } from "../shared/types/project";

export type PendingChangeLike = {
  files: ProjectFile[];
  proposedFiles?: ProjectFile[];
  proposedDeletePaths?: string[];
  proposedRenames?: Array<{ from: string; to: string }>;
  baseProjectDigest?: string;
};

function hashStringRuntimeSafe(value: string): string {
  let h1 = 0xdeadbeef ^ value.length;
  let h2 = 0x41c6ce57 ^ value.length;

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildProjectStateDigest(files: ProjectFile[]): string {
  const normalized = [...(files ?? [])]
    .map((f) => ({ path: String(f.path ?? ""), content: String(f.content ?? "") }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const material = normalized.map((f) => `${f.path}\n${f.content}`).join("\n---\n");
  return hashStringRuntimeSafe(material);
}

export function rebasePendingChangeOnLatest(
  latestFiles: ProjectFile[],
  pending: PendingChangeLike,
): {
  applyResult: ApplyFilesResult;
  driftDetected: boolean;
} {
  const incoming = pending.proposedFiles?.length ? pending.proposedFiles : pending.files;
  const applyResult = applyFileOpsToProject(latestFiles, incoming, {
    deletePaths: pending.proposedDeletePaths ?? [],
    renames: pending.proposedRenames ?? [],
  });
  const latestDigest = buildProjectStateDigest(latestFiles);

  return {
    applyResult,
    driftDetected: Boolean(pending.baseProjectDigest && pending.baseProjectDigest !== latestDigest),
  };
}
