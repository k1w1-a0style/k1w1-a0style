import type { MutableRefObject } from "react";

import type { ProjectData, ProjectFile } from "../../shared/types/project";

const DEFAULT_TIMESTAMP = "2026-03-30T00:00:00.000Z";

export function makeProjectFile(path: string, content = "{}"): ProjectFile {
  return { path, content };
}

export function makeProjectData(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    id: "p1",
    name: "test",
    files: [makeProjectFile("app.json", "{}")],
    chatHistory: [],
    createdAt: DEFAULT_TIMESTAMP,
    lastModified: DEFAULT_TIMESTAMP,
    linkedRepo: "owner/repo",
    linkedBranch: "main",
    ...overrides,
  };
}

export function createMountedRef(current = true): MutableRefObject<boolean> {
  return { current };
}


export function findProjectFile(files: ProjectFile[], path: string): ProjectFile | undefined {
  return files.find((file) => file.path === path);
}
