import type { CoreTemplateId, PreferredPreviewMode, ProjectData, ProjectFile, TemplateId } from "../shared/types/project";
import { normalizePath } from "../lib/validators";
import { getMaterializedProjectFiles } from "../lib/getMaterializedProjectFiles";

const DEFAULT_PROJECT_NAME = "Neues Projekt";
const DEFAULT_PROJECT_SLUG = "neues-projekt";
const DEFAULT_PREVIEW_MODE: PreferredPreviewMode = "supabase";

export const normalizeProjectSlug = (value: string | null | undefined): string => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || DEFAULT_PROJECT_SLUG;
};

type BuildProjectForCreationParams = {
  id: string;
  files: ProjectFile[];
  templateId?: TemplateId;
  effectiveTemplateId?: CoreTemplateId;
  preferredPreviewMode?: PreferredPreviewMode;
  name?: string;
  slug?: string;
};

export const normalizeLoadedProjectData = (project: ProjectData): ProjectData => ({
  ...project,
  slug: normalizeProjectSlug(project.slug ?? project.name),
  files: getMaterializedProjectFiles(project),
  chatHistory: project.chatHistory ?? [],
  preferredPreviewMode: project.preferredPreviewMode ?? DEFAULT_PREVIEW_MODE,
});

export const buildProjectForCreation = (
  params: BuildProjectForCreationParams,
): ProjectData => {
  const now = new Date().toISOString();

  return {
    id: params.id,
    name: params.name ?? DEFAULT_PROJECT_NAME,
    slug: params.slug ?? DEFAULT_PROJECT_SLUG,
    files: params.files,
    chatHistory: [],
    createdAt: now,
    lastModified: now,
    preferredPreviewMode: params.preferredPreviewMode ?? DEFAULT_PREVIEW_MODE,
    ...(params.templateId ? { templateId: params.templateId } : {}),
    ...(params.effectiveTemplateId
      ? { effectiveTemplateId: params.effectiveTemplateId }
      : {}),
  };
};

export const removeProjectFilesByPaths = (
  currentFiles: ProjectFile[],
  pathsToRemove: readonly string[],
): ProjectFile[] => {
  const toDelete = new Set(
    pathsToRemove
      .map((path) => (typeof path === "string" ? normalizePath(path) : ""))
      .filter((path): path is string => path.length > 0),
  );
  if (toDelete.size === 0) return currentFiles;
  return currentFiles.filter((file) => !toDelete.has(normalizePath(String(file.path ?? ""))));
};
