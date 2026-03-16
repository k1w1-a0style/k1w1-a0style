import type { ProjectFile } from "../../../shared/types/project";

export function normalizeProjectFiles(files: unknown): ProjectFile[] {
  if (!Array.isArray(files)) return [];

  const out: ProjectFile[] = [];
  for (const file of files) {
    if (!file || typeof file !== "object") continue;

    const candidate = file as { path?: unknown; content?: unknown };
    const path = typeof candidate.path === "string" ? candidate.path.trim() : "";
    if (!path) continue;

    out.push({
      path,
      content:
        typeof candidate.content === "string"
          ? candidate.content
          : String(candidate.content ?? ""),
    });
  }

  return out;
}
