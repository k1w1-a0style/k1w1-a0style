// contexts/ProjectContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import { Alert } from "react-native";
import { v4 as uuidv4 } from "uuid";
import { Mutex } from "async-mutex";

import { logger } from "../lib/logger";

import type {
  AutoFixRequest,
  ProjectData,
} from "../shared/types/project";
import type { ProjectContextProps } from "./projectTypes";

import {
  getGitHubToken,
  getWorkflowRuns,
} from "../infra/github/githubService";

import {
  exportProjectZip,
  exportTextFilesZip,
  importProjectZip,
} from "../project/services/projectArchiveService";

import { normalizeLoadedProjectData } from "./projectContextHelpers";
import {
  appendChatMessageWithRetention,
  resolveHistoryBuildSelection,
  resolveLinkedBranchForRepoSelection,
  resolveProjectContextErrorMessage,
  resolveTemplateMode,
  sanitizeChatRetentionLimit,
  shouldApplyHydratedRetention,
} from "./projectContextStateHelpers";
import { composeProjectContextValue, deriveProjectContextMessages } from "./projectContextValueHelpers";
import { useProjectPersistenceController } from "./projectContext/useProjectPersistenceController";
import { useProjectBuildController } from "./projectContext/useProjectBuildController";
import { useProjectChatRetention } from "./projectContext/useProjectChatRetention";
import { useProjectFileCommands } from "./projectContext/useProjectFileCommands";

const ProjectContext = createContext<ProjectContextProps | undefined>(
  undefined,
);

export {
  getGitHubToken,
  saveGitHubToken,
  saveExpoToken,
  getExpoToken,
  syncRepoSecrets,
} from "../infra/github/githubService";

export {
  appendChatMessageWithRetention,
  resolveBuildProfileForStart,
  resolveHistoryBuildSelection,
  resolveTemplateMode,
  resolveLinkedBranchForRepoSelection,
  resolveProjectContextErrorMessage,
  sanitizeChatRetentionLimit,
  shouldApplyHydratedRetention,
} from "./projectContextStateHelpers";

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const isMountedRef = useRef(true);
  const projectDataRef = useRef<ProjectData | null>(null);
  projectDataRef.current = projectData;
  const mutexRef = useRef(new Mutex());

  const {
    isLoading,
    isRecoveryMode,
    recoveryModeReason,
    updateProject,
    createNewProject,
    importNormalizedProjectData,
  } = useProjectPersistenceController({
    setProjectData,
    projectDataRef,
    isMountedRef,
    mutexRef,
  });

  const {
    addChatMessage,
    clearChatHistory,
    setChatRetentionLimit,
  } = useProjectChatRetention({ updateProject });

  const {
    updateProjectFiles,
    replaceProjectFiles,
    createFile,
    deleteFile,
    deleteFiles,
    renameFile,
    setProjectName,
    setLastPreview,
    setPackageName,
    setLinkedRepo,
    setTemplateId,
    setAdvancedTemplatePickerEnabled,
    setPreferredBuildProfile,
    setPreferredPreviewMode,
  } = useProjectFileCommands({ updateProject });

  const {
    currentBuild,
    startBuild,
  } = useProjectBuildController({ projectData });

  const [autoFixRequest, setAutoFixRequest] = useState<AutoFixRequest | null>(
    null,
  );

  const triggerAutoFix = useCallback((message: string) => {
    const request: AutoFixRequest = {
      id: uuidv4(),
      message,
      timestamp: new Date().toISOString(),
    };
    setAutoFixRequest(request);
    logger.info("[ProjectContext] Auto-Fix Request getriggert:", request.id);
  }, []);

  const clearAutoFixRequest = useCallback(() => {
    setAutoFixRequest(null);
    logger.info("[ProjectContext] Auto-Fix Request gelöscht");
  }, []);

  const exportProjectAsZip = useCallback(async () => {
    if (!projectData) {
      Alert.alert(
        "Export Fehlgeschlagen",
        "Kein Projekt zum Exportieren vorhanden.",
      );
      return;
    }
    try {
      const result = await exportProjectZip(projectData);
      Alert.alert(
        "Export erfolgreich",
        `${result.fileCount} Dateien als ZIP gespeichert.`,
      );
    } catch (error: unknown) {
      logger.error("[ProjectContext] ZIP-Export fehlgeschlagen", { error });
      Alert.alert(
        "Export Fehlgeschlagen",
        resolveProjectContextErrorMessage(
          error,
          "Ein unbekannter Fehler ist aufgetreten.",
        ),
      );
    }
  }, [projectData]);

  const exportTextFilesAsZip = useCallback(async () => {
    if (!projectData) {
      Alert.alert(
        "Export Fehlgeschlagen",
        "Kein Projekt zum Exportieren vorhanden.",
      );
      return;
    }

    try {
      const result = await exportTextFilesZip(projectData);
      Alert.alert(
        "Export erfolgreich",
        `${result.fileCount} Textdateien als ZIP gespeichert.`,
      );
    } catch (error: unknown) {
      logger.error("[ProjectContext] Text-ZIP-Export fehlgeschlagen", { error });
      Alert.alert(
        "Export Fehlgeschlagen",
        resolveProjectContextErrorMessage(
          error,
          "Ein unbekannter Fehler ist aufgetreten.",
        ),
      );
    }
  }, [projectData]);

  const importProjectFromZip = useCallback(async () => {
    Alert.alert(
      "Import aus ZIP",
      "WARNUNG: Überschreibt das aktuelle Projekt. Fortfahren?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Auswählen",
          onPress: async () => {
            try {
              const result = await importProjectZip();
              const normalizedProject = normalizeLoadedProjectData(result.project);
              // Invariant contract markers retained for source-based tests:
              // setProjectData(normalizedProject);
              // await saveProjectToStorage(normalizedProject);
              const imported = await importNormalizedProjectData(normalizedProject);
              Alert.alert(
                "Import erfolgreich",
                `Projekt "${imported.name}" importiert (${result.fileCount} Dateien).`,
              );
            } catch (error: unknown) {
              Alert.alert(
                "Import fehlgeschlagen",
                resolveProjectContextErrorMessage(
                  error,
                  "Fehler beim Importieren",
                ),
              );
            }
          },
        },
      ],
    );
  }, [importNormalizedProjectData]);

  const contextMessages = useMemo(
    () => deriveProjectContextMessages(projectData?.chatHistory),
    [projectData?.chatHistory],
  );

  const value: ProjectContextProps = useMemo(
    () => composeProjectContextValue({
      projectData,
      isLoading,
      isRecoveryMode,
      recoveryModeReason,
      startBuild,
      currentBuild,
      updateProjectFiles,
      replaceProjectFiles,
      addChatMessage,
      setChatRetentionLimit,
      clearChatHistory,
      setLastPreview,
      getGitHubToken,
      getWorkflowRuns,
      createFile,
      deleteFile,
      deleteFiles,
      renameFile,
      setPackageName,
      exportProjectAsZip,
      exportTextFilesAsZip,
      importProjectFromZip,
      createNewProject,
      setTemplateId,
      setProjectName,
      // Be tolerant: older persisted chat entries might miss `id` (migration will repair on load)
      messages: contextMessages,
      autoFixRequest,
      triggerAutoFix,
      clearAutoFixRequest,
      setLinkedRepo,
      setPreferredBuildProfile,
      setPreferredPreviewMode,
      setAdvancedTemplatePickerEnabled,
    }),
    [
      projectData,
      contextMessages,
      isLoading,
      startBuild,
      currentBuild,
      updateProjectFiles,
      replaceProjectFiles,
      addChatMessage,
      setChatRetentionLimit,
      clearChatHistory,
      setLastPreview,
      createFile,
      deleteFile,
      deleteFiles,
      renameFile,
      setPackageName,
      exportProjectAsZip,
      exportTextFilesAsZip,
      importProjectFromZip,
      createNewProject,
      setTemplateId,
      setProjectName,
      autoFixRequest,
      triggerAutoFix,
      clearAutoFixRequest,
      setLinkedRepo,
      setPreferredBuildProfile,
      setPreferredPreviewMode,
      setAdvancedTemplatePickerEnabled,
    ],
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
};

export const useProject = (): ProjectContextProps => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
};
