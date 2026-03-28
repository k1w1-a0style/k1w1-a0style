import type { CoreTemplateId, PreferredPreviewMode, ProjectData, ProjectFile, TemplateId } from "../shared/types/project";

const DEFAULT_PROJECT_NAME = "Neues Projekt";
const DEFAULT_PROJECT_SLUG = "neues-projekt";
const DEFAULT_PREVIEW_MODE: PreferredPreviewMode = "supabase";

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
  files: project.files ?? [],
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
