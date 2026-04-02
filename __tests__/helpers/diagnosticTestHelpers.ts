import type { ProjectFile } from "../../shared/types/project";

export function makeProjectFile(path: string, content: string): ProjectFile {
  return { path, content };
}

export function findCheckById<T extends { id: string }>(checks: T[], id: string): T | undefined {
  return checks.find((check) => check.id === id);
}

export function pluckIds<T extends { id: string }>(items: T[]): string[] {
  return items.map((item) => item.id);
}
