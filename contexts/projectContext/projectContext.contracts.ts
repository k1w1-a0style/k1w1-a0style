import type { MutableRefObject } from "react";
import type { Mutex } from "async-mutex";

import type { BuildStatus } from "../../shared/types/build";
import type { ChatMessage } from "../../shared/types/chat";
import type {
  LastPreviewMeta,
  PreferredPreviewMode,
  ProjectData,
  ProjectFile,
  TemplateId,
} from "../../shared/types/project";
import type { CurrentBuildState } from "../projectContextStateHelpers";

export type ProjectDataUpdater = (prev: ProjectData) => ProjectData;

export type UpdateProjectFn = (updater: ProjectDataUpdater) => Promise<void>;

export type ReplaceProjectDataFn = (nextProject: ProjectData) => Promise<void>;

export type ProjectLockRunner = (task: () => Promise<void>) => Promise<void>;

export type ProjectPersistenceControllerInput = {
  setProjectData: (value: ProjectData | null | ((prev: ProjectData | null) => ProjectData | null)) => void;
  projectDataRef: MutableRefObject<ProjectData | null>;
  isMountedRef: MutableRefObject<boolean>;
  mutexRef: MutableRefObject<Mutex>;
};

export type ProjectFileCommandsInput = {
  updateProject: UpdateProjectFn;
};

export type ProjectChatRetentionInput = {
  updateProject: UpdateProjectFn;
};

export type ProjectBuildControllerInput = {
  projectData: ProjectData | null;
};

export type ProjectBuildSelectionSnapshot = {
  jobId: string | null;
  repoName: string;
  branch: string;
  buildProfile: string;
};

export type ProjectBuildState = {
  currentBuild: CurrentBuildState | null;
  startBuild: (buildProfile?: string) => Promise<void>;
};

export type FileCommandResultStatus = "success" | "noop" | "rejected" | "error";

export type FileCommandResult = {
  status: FileCommandResultStatus;
  changed: boolean;
  reason?: string;
};

export type ProjectFileCommandsState = {
  updateProjectFiles: (files: ProjectFile[], newName?: string) => Promise<void>;
  createFile: (path: string, content: string) => Promise<FileCommandResult>;
  deleteFile: (path: string) => Promise<FileCommandResult>;
  deleteFiles: (paths: string[]) => Promise<FileCommandResult>;
  renameFile: (oldPath: string, newPath: string) => Promise<FileCommandResult>;
  setProjectName: (name: string) => Promise<void>;
  setPackageName: (name: string) => Promise<void>;
  setTemplateId: (templateId: TemplateId) => Promise<void>;
  setLinkedRepo: (repo: string | null, branch?: string | null) => Promise<void>;
  setPreferredBuildProfile: (profile: "development" | "preview" | "production") => Promise<void>;
  setPreferredPreviewMode: (mode: PreferredPreviewMode) => Promise<void>;
  setAdvancedTemplatePickerEnabled: (enabled: boolean) => Promise<void>;
  setLastPreview: (preview: LastPreviewMeta | null) => Promise<void>;
};

export type ProjectChatRetentionState = {
  addChatMessage: (message: ChatMessage) => Promise<void>;
  clearChatHistory: () => Promise<void>;
  setChatRetentionLimit: (limit: number) => Promise<void>;
};

export type ProjectContextBuildStatus = BuildStatus;
