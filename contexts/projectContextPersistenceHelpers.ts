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

type SaveTimeout = ReturnType<typeof setTimeout>;

export const scheduleDebouncedProjectSave = (params: {
  saveTimeout: SaveTimeout | null;
  clearTimeoutFn: (timeout: SaveTimeout) => void;
  setTimeoutFn: typeof setTimeout;
  debounceMs: number;
  project: ProjectData;
  saveProjectToStorage: (project: ProjectData) => Promise<void>;
  onSaveError: (error: unknown) => void;
}): SaveTimeout => {
  if (params.saveTimeout) {
    params.clearTimeoutFn(params.saveTimeout);
  }

  return params.setTimeoutFn(() => {
    params.saveProjectToStorage(params.project).catch(params.onSaveError);
  }, params.debounceMs);
};

export const clearPendingProjectSaveTimeout = (params: {
  saveTimeout: SaveTimeout | null;
  clearTimeoutFn: (timeout: SaveTimeout) => void;
}): SaveTimeout | null => {
  if (!params.saveTimeout) {
    return null;
  }

  params.clearTimeoutFn(params.saveTimeout);
  return null;
};

export const flushPendingProjectSave = async (params: {
  saveTimeout: SaveTimeout | null;
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

export const flushProjectSaveForAppState = async (params: {
  nextState: AppStateStatus;
  saveTimeout: SaveTimeout | null;
  clearPendingSave: () => void;
  projectData: ProjectData | null;
  saveProjectToStorage: (project: ProjectData) => Promise<void>;
}): Promise<boolean> => {
  if (!shouldFlushProjectSaveOnAppState(params.nextState)) {
    return false;
  }

  return flushPendingProjectSave({
    saveTimeout: params.saveTimeout,
    clearPendingSave: params.clearPendingSave,
    projectData: params.projectData,
    saveProjectToStorage: params.saveProjectToStorage,
  });
};
