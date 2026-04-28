// project/domain/projectFileMutations.ts
// Pure helpers for updating project files.
// Extracted from contexts/ProjectContext.tsx (PR-5) to keep the context slimmer.

import type { ProjectData, ProjectFile } from '../../shared/types/project';
import { validateFilePath } from '../../lib/validators';

const canKeepProjectFile = (file: ProjectFile): boolean => {
  const path = String(file?.path ?? '').trim();
  return !!path && validateFilePath(path).valid;
};

export const mergeProjectFiles = (
  existing: ProjectFile[],
  updates: ProjectFile[],
): ProjectFile[] => {
  const fileMap = new Map<string, ProjectFile>();

  for (const f of existing) {
    if (!canKeepProjectFile(f)) continue;
    fileMap.set(f.path, f);
  }

  for (const f of updates) {
    if (!canKeepProjectFile(f)) continue;
    fileMap.set(f.path, f);
  }

  return Array.from(fileMap.values());
};

export const applyProjectFileUpdates = (
  prev: ProjectData,
  files: ProjectFile[],
  newName?: string,
): ProjectData => {
  return {
    ...prev,
    files: mergeProjectFiles(prev.files, files),
    name: newName || prev.name,
  };
};
