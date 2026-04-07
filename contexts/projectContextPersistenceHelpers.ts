import type { AppStateStatus } from "react-native";

import type { ProjectData, ProjectFile } from "../shared/types/project";
import {
  buildProjectForCreation,
  normalizeLoadedProjectData,
} from "./projectContextHelpers";
import { CHAT_HISTORY_RETENTION_FALLBACK } from "./projectContextStateHelpers";

export type InitializeProjectDataResult = {
  project: ProjectData;
  source: "storage" | "template" | "recovery-template";
  recoveryError?: string;
};

export const initializeProjectData = async (params: {
  loadProjectFromStorage: () => Promise<ProjectData | null>;
  loadTemplateFromFile: () => Promise<ProjectFile[]>;
  saveProjectToStorage: (project: ProjectData) => Promise<void>;
  createProjectId: () => string;
}): Promise<InitializeProjectDataResult> => {
  let savedProject: ProjectData | null = null;
  let storageLoadError: unknown = null;
  try {
    savedProject = await params.loadProjectFromStorage();
  } catch (error) {
    storageLoadError = error;
  }

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
  if (!storageLoadError) {
    await params.saveProjectToStorage(newProject);
  }

  return {
    project: newProject,
    source: storageLoadError ? "recovery-template" : "template",
    recoveryError: storageLoadError instanceof Error ? storageLoadError.message : undefined,
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

export const createAppStateSaveHandler = (params: {
  flushForAppState: (nextState: AppStateStatus, projectData: ProjectData | null) => Promise<boolean>;
  getProjectData: () => ProjectData | null;
  onBeforeFlush?: () => void;
  onAfterFlush?: (didSave: boolean) => void;
  onFlushError?: (error: unknown) => void;
}) => {
  return async (nextState: AppStateStatus) => {
    if (!shouldFlushProjectSaveOnAppState(nextState)) {
      return;
    }

    params.onBeforeFlush?.();
    try {
      const didSave = await params.flushForAppState(nextState, params.getProjectData());
      params.onAfterFlush?.(didSave);
    } catch (error) {
      params.onFlushError?.(error);
    }
  };
};

export type ProjectSaveScheduler = {
  queueSave: (project: ProjectData) => void;
  clearPendingSave: () => void;
  invalidatePendingSnapshot: () => void;
  flushForAppState: (nextState: AppStateStatus, projectData: ProjectData | null) => Promise<boolean>;
  getPendingTimeout: () => SaveTimeout | null;
};

export const createProjectSaveScheduler = (params: {
  clearTimeoutFn: (timeout: SaveTimeout) => void;
  setTimeoutFn: typeof setTimeout;
  debounceMs: number;
  saveProjectToStorage: (project: ProjectData) => Promise<void>;
  onSaveError: (error: unknown) => void;
}): ProjectSaveScheduler => {
  let saveTimeout: SaveTimeout | null = null;
  let saveGeneration = 0;

  const clearPendingSave = () => {
    saveGeneration += 1;
    saveTimeout = clearPendingProjectSaveTimeout({
      saveTimeout,
      clearTimeoutFn: params.clearTimeoutFn,
    });
  };

  return {
    queueSave(project) {
      const generation = ++saveGeneration;
      saveTimeout = scheduleDebouncedProjectSave({
        saveTimeout,
        clearTimeoutFn: params.clearTimeoutFn,
        setTimeoutFn: params.setTimeoutFn,
        debounceMs: params.debounceMs,
        project,
        saveProjectToStorage: async (queuedProject) => {
          if (generation !== saveGeneration) return;
          await params.saveProjectToStorage(queuedProject);
        },
        onSaveError: params.onSaveError,
      });
    },
    clearPendingSave,
    invalidatePendingSnapshot() {
      clearPendingSave();
    },
    flushForAppState(nextState, projectData) {
      return flushProjectSaveForAppState({
        nextState,
        saveTimeout,
        clearPendingSave,
        projectData,
        saveProjectToStorage: params.saveProjectToStorage,
      });
    },
    getPendingTimeout() {
      return saveTimeout;
    },
  };
};

export const hydrateChatRetentionLimit = async (params: {
  loadChatHistorySettings: () => Promise<{ retention: number }>;
  shouldApplyHydratedRetention: (didSetRuntimeRetention: boolean) => boolean;
  didSetRuntimeRetention: boolean;
  onHydrationError?: (error: unknown) => void;
}): Promise<number | null> => {
  if (!params.shouldApplyHydratedRetention(params.didSetRuntimeRetention)) {
    return null;
  }

  try {
    const { retention } = await params.loadChatHistorySettings();
    return retention;
  } catch (error) {
    params.onHydrationError?.(error);
    return CHAT_HISTORY_RETENTION_FALLBACK;
  }
};

export const runWithProjectLoading = async (params: {
  setLoading: (loading: boolean) => void;
  task: () => Promise<void>;
}): Promise<void> => {
  params.setLoading(true);
  try {
    await params.task();
  } finally {
    params.setLoading(false);
  }
};
