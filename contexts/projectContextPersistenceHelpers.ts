import type { AppStateStatus } from "react-native";

import type { ProjectData, ProjectFile } from "../shared/types/project";
import {
  buildProjectForCreation,
  normalizeLoadedProjectData,
} from "./projectContextHelpers";

export type InitializeProjectDataResult = {
  project: ProjectData;
  source: "storage" | "template";
};

export const initializeProjectData = async (params: {
  loadProjectFromStorage: () => Promise<ProjectData | null>;
  loadTemplateFromFile: () => Promise<ProjectFile[]>;
  saveProjectToStorage: (project: ProjectData) => Promise<void>;
  createProjectId: () => string;
}): Promise<InitializeProjectDataResult> => {
  const savedProject = await params.loadProjectFromStorage();

  if (savedProject) {
    return {
      project: normalizeLoadedProjectData(savedProject),
      source: "storage",
    };
  }

  const templateFiles = await params.loadTemplateFromFile();
  const newProject = buildProjectForCreation({
    id: params.createProjectId(),
    files: templateFiles,
  });
  await params.saveProjectToStorage(newProject);

  return {
    project: newProject,
    source: "template",
  };
};

export const shouldFlushProjectSaveOnAppState = (
  nextState: AppStateStatus,
): boolean => nextState === "background" || nextState === "inactive";

export const flushPendingProjectSave = async (params: {
  saveTimeout: ReturnType<typeof setTimeout> | null;
  clearPendingSave: () => void;
  projectData: ProjectData | null;
  saveProjectToStorage: (project: ProjectData) => Promise<void>;
}): Promise<boolean> => {
  if (params.saveTimeout) {
    params.clearPendingSave();
  }

  if (!params.projectData) {
    return false;
  }

  await params.saveProjectToStorage(params.projectData);
  return true;
};
