import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { v4 as uuidv4 } from "uuid";

import { logger } from "../../lib/logger";
import { loadTemplateFromFile } from "../../project/services/templateLoader";
import type { ProjectData } from "../../shared/types/project";
import { loadProjectFromStorage, saveProjectToStorage } from "../../infra/storage/projectPersistence";
import { resolveEffectiveTemplateId } from "../../lib/diagnostics/templates";
import {
  createAppStateSaveHandler,
  createProjectSaveScheduler,
  runWithProjectLoading,
  initializeProjectData,
} from "../projectContextPersistenceHelpers";
import { resolveProjectContextErrorMessage, resolveTemplateMode } from "../projectContextStateHelpers";
import { buildProjectForCreation, normalizeLoadedProjectData } from "../projectContextHelpers";
import type {
  ProjectPersistenceControllerInput,
  ProjectLockRunner,
  ReplaceProjectDataFn,
  UpdateProjectFn,
} from "./projectContext.contracts";

const SAVE_DEBOUNCE_MS = 500;

export function useProjectPersistenceController({
  setProjectData,
  projectDataRef,
  isMountedRef,
  mutexRef,
}: ProjectPersistenceControllerInput) {
  const [isLoading, setIsLoading] = useState(true);
  const persistenceWriteBlockedRef = useRef(false);

  const persistProjectToStorage = useCallback(async (project: ProjectData, options?: { force?: boolean }) => {
    if (!options?.force && persistenceWriteBlockedRef.current) {
      logger.warn("[ProjectContext] Storage write blocked due to recovery mode; skipping save.");
      return;
    }
    await saveProjectToStorage(project);
  }, []);

  const persistenceSchedulerRef = useRef(
    createProjectSaveScheduler({
      clearTimeoutFn: clearTimeout,
      setTimeoutFn: setTimeout,
      debounceMs: SAVE_DEBOUNCE_MS,
      saveProjectToStorage: (project) => persistProjectToStorage(project),
      onSaveError: (error) => {
        logger.error("[ProjectContext] Save error", { error });
      },
      canPersist: () => !persistenceWriteBlockedRef.current,
    }),
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, [isMountedRef]);

  const setIsLoadingSafe = useCallback((nextValue: boolean) => {
    if (!isMountedRef.current) return;
    setIsLoading(nextValue);
  }, [isMountedRef]);

  const clearPendingSave = useCallback(() => {
    persistenceSchedulerRef.current.clearPendingSave();
  }, []);

  const debouncedSave = useCallback((project: ProjectData) => {
    persistenceSchedulerRef.current.queueSave(project);
  }, []);

  const updateProject: UpdateProjectFn = useCallback(
    async (updater) => {
      const release = await mutexRef.current.acquire();
      try {
        setProjectData((prev) => {
          if (!prev) return prev;
          const updated = updater(prev);
          const finalProject = {
            ...updated,
            lastModified: new Date().toISOString(),
          };
          if (!persistenceWriteBlockedRef.current) {
            debouncedSave(finalProject);
          } else {
            logger.warn("[ProjectContext] Recovery mode active: in-memory update without persistence.");
          }
          return finalProject;
        });
      } catch (error) {
        logger.error("[ProjectContext] Update error", { error });
      } finally {
        release();
      }
    },
    [debouncedSave, mutexRef, setProjectData],
  );

  const runWithProjectLock: ProjectLockRunner = useCallback(
    async (task) => {
      const release = await mutexRef.current.acquire();
      try {
        await task();
      } finally {
        release();
      }
    },
    [mutexRef],
  );

  const replaceProjectData: ReplaceProjectDataFn = useCallback(
    async (nextProject) => {
      await runWithProjectLock(async () => {
        persistenceSchedulerRef.current.invalidatePendingSnapshot();
        persistenceWriteBlockedRef.current = false;
        setProjectData(nextProject);
        await persistProjectToStorage(nextProject, { force: true });
      });
    },
    [persistProjectToStorage, runWithProjectLock, setProjectData],
  );

  useEffect(() => {
    const initializeProject = async () => {
      try {
        logger.info("APP START (ProjectContext)");
        const initialized = await initializeProjectData({
          loadProjectFromStorage,
          loadTemplateFromFile,
          saveProjectToStorage,
          createProjectId: () => uuidv4(),
        });
        if (isMountedRef.current) {
          setProjectData(initialized.project);
        }
        if (initialized.source === "storage") {
          persistenceWriteBlockedRef.current = false;
          logger.info("📖 Projekt geladen:", initialized.project.name);
        } else if (initialized.source === "recovery-template") {
          persistenceWriteBlockedRef.current = true;
          logger.error("[ProjectContext] Verschluesselten Storage-Stand nicht geladen; Recovery-Template aktiv.", {
            reason: initialized.recoveryError ?? "unknown",
          });
          Alert.alert(
            "Projekt-Wiederherstellung erforderlich",
            initialized.recoveryError ??
              "Gespeicherte verschluesselte Projektdaten konnten nicht geladen werden. Ein neues In-Memory-Template wurde geöffnet, ohne den vorhandenen Storage zu überschreiben.",
          );
        } else {
          persistenceWriteBlockedRef.current = false;
          logger.info("Kein Projekt gefunden, lade neues Template...");
          logger.info("Neues Template-Projekt erstellt und gespeichert.");
        }
      } catch (error) {
        logger.error("[ProjectContext] App-Start Ladefehler", { error });
      } finally {
        setIsLoadingSafe(false);
      }
    };

    void initializeProject();
  }, [isMountedRef, setIsLoadingSafe, setProjectData]);

  useEffect(() => {
    const handleAppStateChange = createAppStateSaveHandler({
      flushForAppState: persistenceSchedulerRef.current.flushForAppState,
      getProjectData: () => projectDataRef.current,
      onBeforeFlush: () => {
        logger.info("🔄 App geht in Background, flushe ausstehende Saves...");
      },
      onAfterFlush: (didSave) => {
        if (didSave) {
          logger.info("✅ Background-Save erfolgreich");
        }
      },
      onFlushError: (error) => {
        logger.error("[ProjectContext] Background-Save fehlgeschlagen", { error });
      },
    });

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [projectDataRef]);

  useEffect(() => () => clearPendingSave(), [clearPendingSave]);

  const createNewProject = useCallback(async () => {
    Alert.alert(
      "Neues Projekt",
      "Möchtest du ein neues Projekt erstellen? Der aktuelle Chat und alle Dateien werden zurückgesetzt.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Neu erstellen",
          style: "destructive",
          onPress: async () => {
            try {
              await runWithProjectLoading({
                setLoading: setIsLoadingSafe,
                task: async () => {
                  const currentProjectData = projectDataRef.current;
                  const mode = resolveTemplateMode(currentProjectData?.templateId);
                  const { effective } = resolveEffectiveTemplateId(
                    mode,
                    currentProjectData?.files || [],
                  );
                  const templateFiles = await loadTemplateFromFile(effective);
                  const newProject: ProjectData = {
                    ...buildProjectForCreation({
                      id: uuidv4(),
                      files: templateFiles,
                      templateId: mode,
                      effectiveTemplateId: effective,
                      preferredPreviewMode:
                        currentProjectData?.preferredPreviewMode ?? "supabase",
                    }),
                    lastPreview: null,
                  };

                  await replaceProjectData(newProject);

                  Alert.alert("Erfolg", "Neues Projekt wurde erstellt!");
                  logger.info("✅ Neues Projekt erstellt und gespeichert.");
                },
              });
            } catch (error: unknown) {
              Alert.alert(
                "Fehler",
                resolveProjectContextErrorMessage(
                  error,
                  "Projekt konnte nicht erstellt werden",
                ),
              );
            }
          },
        },
      ],
    );
  }, [projectDataRef, replaceProjectData, setIsLoadingSafe]);

  const importNormalizedProjectData = useCallback(async (project: ProjectData) => {
    const normalizedProject = normalizeLoadedProjectData(project);
    // Invariant contract markers retained for source-based tests:
    // setProjectData(normalizedProject);
    // await saveProjectToStorage(normalizedProject);
    await replaceProjectData(normalizedProject);
    return normalizedProject;
  }, [replaceProjectData]);

  return {
    isLoading,
    setIsLoadingSafe,
    updateProject,
    replaceProjectData,
    runWithProjectLock,
    clearPendingSave,
    debouncedSave,
    createNewProject,
    importNormalizedProjectData,
  };
}
