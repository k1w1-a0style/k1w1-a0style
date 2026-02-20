// contexts/ProjectContext.tsx (V15 - ALL CRITICAL FIXES APPLIED)
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { materializeProjectData, sanitizeAndroidPackage, slugify } from "../lib/projectMaterializer";
import { Alert, AppState, AppStateStatus } from "react-native";
import { v4 as uuidv4 } from "uuid";
import { Mutex } from "async-mutex";

import { logger } from "../lib/logger";

import type { ChatMessage } from "../shared/types/chat";
import type { BuildHistoryEntry } from "../shared/types/build";
import type { ProjectData, ProjectFile, TemplateId } from "../shared/types/project";
import type { AutoFixRequest, LastPreviewMeta, ProjectContextProps } from "./types";

import {
  saveProjectToStorage,
  loadProjectFromStorage,
} from "../infra/storage/projectPersistence";

import {
  getGitHubToken,
  getWorkflowRuns,
} from "../infra/github/githubService";

import { loadTemplateFromFile } from "../project/services/templateLoader";
import { applyProjectFileUpdates, mergeProjectFiles } from "../project/domain/projectFileMutations";
import {
  exportProjectZip,
  exportTextFilesZip,
  importProjectZip,
} from "../project/services/projectArchiveService";
import { startBuildJob } from "../project/services/buildStartService";
import { useBuildStatus } from "../hooks/useBuildStatus";

// ✅ FIX: Einheitlicher Validator-Wrapper
import { validateFilePath, validateFileContent } from "../lib/validators";
import type { BuildStatus } from "../shared/types/build";
import {
  addBuildToHistory,
  updateBuildInHistory,
} from "../lib/buildHistoryStorage";
import { CONFIG } from "../config";
import { resolveEffectiveTemplateId } from "../lib/diagnostics/templates";

const SAVE_DEBOUNCE_MS = 500;

const ProjectContext = createContext<ProjectContextProps | undefined>(
  undefined,
);

type CurrentBuildState = NonNullable<ProjectContextProps["currentBuild"]>;

export {
  getGitHubToken,
  saveGitHubToken,
  saveExpoToken,
  getExpoToken,
  syncRepoSecrets,
  getEdgeAdminKey,
  saveEdgeAdminKey,
  deleteEdgeAdminKey,
} from "../infra/github/githubService";

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentBuild, setCurrentBuild] = useState<CurrentBuildState | null>(
    null,
  );

  // Centralized polling (single source of truth)
  const activeJobId = currentBuild?.jobId ?? null;
  const buildPoll = useBuildStatus(activeJobId, {
    onMaxErrors: (lastError) => {
      setCurrentBuild((prev) => {
        const base: CurrentBuildState = prev ?? { status: "error" };
        return {
          ...base,
          status: "error",
          message: `🛑 Polling abgebrochen (zu viele Fehler). Letzter Fehler: ${lastError}`,
          lastUpdatedAt: new Date().toISOString(),
        };
      });
    },
  });

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutexRef = useRef(new Mutex());

  const [autoFixRequest, setAutoFixRequest] = useState<AutoFixRequest | null>(
    null,
  );

  const debouncedSave = useCallback((project: ProjectData) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      // ✅ FIX: error typed (noImplicitAny)
      saveProjectToStorage(project).catch((error: unknown) => {
        console.error("[ProjectContext] Save error:", error);
      });
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const updateProject = useCallback(
    async (updater: (prev: ProjectData) => ProjectData) => {
      const release = await mutexRef.current.acquire();
      try {
        setProjectData((prev) => {
          if (!prev) return prev;
          const updated = updater(prev);
          const finalProject = {
            ...updated,
            lastModified: new Date().toISOString(),
          };
          debouncedSave(finalProject);
          return finalProject;
        });
      } catch (error) {
        console.error("[ProjectContext] Update error:", error);
      } finally {
        release();
      }
    },
    [debouncedSave],
  );

  const updateProjectFiles = useCallback(
    async (files: ProjectFile[], newName?: string) => {
      await updateProject((prev) => {
        const mergedFiles = mergeProjectFiles(prev.files, files);
        logger.info(
          `📝 Dateien aktualisiert: ${files.length} geändert, ${mergedFiles.length} gesamt`,
        );
        return applyProjectFileUpdates(prev, files, newName);
      });
    },
    [updateProject],
  );

  const setProjectName = useCallback(
    async (newName: string) => {
      await updateProject((prev) => ({ ...prev, name: newName }));
    },
    [updateProject],
  );

  const addChatMessage = useCallback(
    async (message: ChatMessage) => {
      await updateProject((prev) => ({
        ...prev,
        chatHistory: [...(prev.chatHistory || []), message],
      }));
    },
    [updateProject],
  );

  const clearChatHistory = useCallback(async () => {
    await updateProject((prev) => ({
      ...prev,
      chatHistory: [],
    }));
  }, [updateProject]);

  const setLastPreview = useCallback(
    async (preview: LastPreviewMeta | null) => {
      await updateProject((prev) => ({
        ...prev,
        lastPreview: preview ?? null,
      }));
    },
    [updateProject],
  );

  const setPackageName = useCallback(
    async (packageName: string) => {
      await updateProject((prev) => ({ ...prev, packageName }));
    },
    [updateProject],
  );

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
              setIsLoading(true);
              const mode = (projectData?.templateId as TemplateId) || "auto";
              const { effective } = resolveEffectiveTemplateId(mode, projectData?.files || []);
              const templateFiles = await loadTemplateFromFile(effective);
              const newProject: ProjectData = {
                id: uuidv4(),
                name: "Neues Projekt",
                slug: "neues-projekt",
                templateId: mode,
                effectiveTemplateId: resolveEffectiveTemplateId(mode, projectData?.files || []).effective,
                files: templateFiles,
                chatHistory: [],
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                lastPreview: null,
              };

              const release = await mutexRef.current.acquire();
              try {
                setProjectData(newProject);
                await saveProjectToStorage(newProject);
              } finally {
                release();
              }

              Alert.alert("Erfolg", "Neues Projekt wurde erstellt!");
              logger.info("✅ Neues Projekt erstellt und gespeichert.");
            } catch (error: any) {
              Alert.alert(
                "Fehler",
                error.message || "Projekt konnte nicht erstellt werden",
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
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
    } catch (error: any) {
      console.error("Fehler beim ZIP-Export:", error);
      Alert.alert(
        "Export Fehlgeschlagen",
        error.message || "Ein unbekannter Fehler ist aufgetreten.",
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
    } catch (error: any) {
      console.error("Fehler beim Text-ZIP-Export:", error);
      Alert.alert(
        "Export Fehlgeschlagen",
        error.message || "Ein unbekannter Fehler ist aufgetreten.",
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
            setIsLoading(true);
            try {
              const result = await importProjectZip();
              
              const release = await mutexRef.current.acquire();
              try {
                setProjectData(result.project);
                await saveProjectToStorage(result.project);
              } finally {
                release();
              }

              Alert.alert(
                "Import erfolgreich",
                `Projekt "${result.project.name}" importiert (${result.fileCount} Dateien).`,
              );
            } catch (error: any) {
              Alert.alert(
                "Import fehlgeschlagen",
                error.message || "Fehler beim Importieren",
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  }, []);

  const createFile = useCallback(
    async (path: string, content: string) => {
      const pathValidation = validateFilePath(path);
      if (!pathValidation.valid) {
        Alert.alert("Ungültiger Dateipfad", pathValidation.errors.join("\n"));
        return;
      }

      const contentValidation = validateFileContent(content);
      if (!contentValidation.valid) {
        Alert.alert(
          "Ungültiger Dateiinhalt",
          contentValidation.error || "Datei ist zu groß",
        );
        return;
      }

      const validPath = pathValidation.normalized || path;

      await updateProject((prev) => {
        if (prev.files.some((f) => f.path === validPath)) {
          Alert.alert(
            "Fehler",
            "Eine Datei mit diesem Pfad existiert bereits.",
          );
          return prev;
        }
        return {
          ...prev,
          files: [...prev.files, { path: validPath, content }],
        };
      });
    },
    [updateProject],
  );

  const deleteFile = useCallback(
    async (path: string) => {
      await updateProject((prev) => ({
        ...prev,
        files: prev.files.filter((f) => f.path !== path),
      }));
    },
    [updateProject],
  );

  const renameFile = useCallback(
    async (oldPath: string, newPath: string) => {
      const pathValidation = validateFilePath(newPath);
      if (!pathValidation.valid) {
        Alert.alert("Ungültiger Dateipfad", pathValidation.errors.join("\n"));
        return;
      }

      const validNewPath = pathValidation.normalized || newPath;

      await updateProject((prev) => {
        if (prev.files.some((f) => f.path === validNewPath)) {
          Alert.alert(
            "Fehler",
            "Eine Datei mit dem neuen Pfad existiert bereits.",
          );
          return prev;
        }
        return {
          ...prev,
          files: prev.files.map((f) =>
            f.path === oldPath ? { ...f, path: validNewPath } : f,
          ),
        };
      });
    },
    [updateProject],
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

  const setLinkedRepo = useCallback(
    async (repo: string | null, branch?: string | null) => {
      await updateProject((prev) => ({
        ...prev,
        linkedRepo: repo,
        linkedBranch: branch ?? prev.linkedBranch ?? null,
      }));
      logger.info(
        `🔗 Projekt verknüpft mit: ${repo ?? "–"} (Branch: ${branch ?? "–"})`,
      );
    },
    [updateProject],
  );

  const setTemplateId = useCallback(
    async (templateId: TemplateId) => {
      if (!templateId) return;
      await updateProject((prev) => ({ ...prev, templateId }));
      logger.info(`🧩 Template gespeichert: ${templateId}`);
    },
    [updateProject],
  );

  const setAdvancedTemplatePickerEnabled = useCallback(async (enabled: boolean) => {
    await updateProject((prev) => ({
      ...prev,
      advancedTemplatePickerEnabled: enabled,
    }));
  }, [updateProject]);

const setPreferredBuildProfile = useCallback(
    async (profile: "development" | "preview" | "production") => {
      await updateProject((prev) => ({
        ...prev,
        preferredBuildProfile: profile,
      }));
      logger.info(`⚙️ Preferred Build-Profile gespeichert: ${profile}`);
    },
    [updateProject],
  );

  useEffect(() => {
    const initializeProject = async () => {
      try {
        logger.info("APP START (Context V15 - ALL CRITICAL FIXES APPLIED)");
        const savedProject = await loadProjectFromStorage();

        if (savedProject) {
          logger.info("📖 Projekt geladen:", savedProject.name);
          if (!savedProject.files) savedProject.files = [];
          if (!savedProject.chatHistory) savedProject.chatHistory = [];
          setProjectData(savedProject);
        } else {
          logger.info("Kein Projekt gefunden, lade neues Template...");
          const templateFiles = await loadTemplateFromFile();
          const newProject: ProjectData = {
            id: uuidv4(),
            name: "Neues Projekt",
            slug: "neues-projekt",
            files: templateFiles,
            chatHistory: [],
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
          };
          setProjectData(newProject);
          await saveProjectToStorage(newProject);
          logger.info("Neues Template-Projekt erstellt und gespeichert.");
        }
      } catch (error) {
        console.error("Fehler beim Laden:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeProject();
  }, []);

  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === "background" || nextState === "inactive") {
        logger.info("🔄 App geht in Background, flushe ausstehende Saves...");
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        if (projectData) {
          try {
            await saveProjectToStorage(projectData);
            logger.info("✅ Background-Save erfolgreich");
          } catch (error) {
            console.error("❌ Background-Save fehlgeschlagen:", error);
          }
        }
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [projectData]);

  const lastHistoryStatusRef = useRef<{ jobId: string; status: BuildStatus } | null>(null);

  // Keep ProjectContext.currentBuild in sync with centralized polling hook
  useEffect(() => {
    if (!activeJobId) return;

    const mapped = buildPoll.status;
    const urls = buildPoll.details?.urls;
    const nowIso = new Date().toISOString();

    const msg =
      mapped === "queued"
        ? "⏳ Build ist in der Warteschlange…"
        : mapped === "building"
          ? "🔨 Build läuft…"
          : mapped === "success"
            ? "✅ Build erfolgreich!"
            : mapped === "failed"
              ? "❌ Build fehlgeschlagen."
              : mapped === "error"
                ? `⚠️ Fehler beim Status-Abruf${buildPoll.lastError ? ": " + buildPoll.lastError : "."}`
                : "⏸️ Kein aktiver Build.";

    setCurrentBuild((prev) => {
      const base: CurrentBuildState = prev ?? { status: "idle" };
      return {
        ...base,
        status: mapped,
        jobId: activeJobId,
        runId: buildPoll.details?.runId ?? base.runId ?? null,
        urls: {
          html: urls?.html ?? base.urls?.html ?? null,
          artifacts: urls?.artifacts ?? base.urls?.artifacts ?? null,
          buildUrl: urls?.buildUrl ?? base.urls?.buildUrl ?? null,
        },
        message: msg,
        lastUpdatedAt: nowIso,
        completedAt: ["success", "failed", "error"].includes(mapped)
          ? nowIso
          : base.completedAt,
      };
    });
  }, [activeJobId, buildPoll.details, buildPoll.lastError, buildPoll.status]);

  // Update build history as statuses arrive (best-effort)
  useEffect(() => {
    if (!activeJobId) return;
    if (!buildPoll.details) return;

    const status = buildPoll.status;
    if (
      lastHistoryStatusRef.current?.jobId === activeJobId &&
      lastHistoryStatusRef.current?.status === status
    ) {
      return;
    }

    lastHistoryStatusRef.current = { jobId: activeJobId, status };

    updateBuildInHistory(activeJobId, {
      status,
      htmlUrl: buildPoll.details.urls?.html ?? null,
      artifactUrl: buildPoll.details.urls?.artifacts ?? null,
    }).catch((historyError) => {
      console.warn(
        "⚠️ Build-Historie konnte nicht aktualisiert werden:",
        historyError,
      );
    });
  }, [activeJobId, buildPoll.details, buildPoll.status]);

  const startBuild = useCallback(
    async (buildProfile?: string) => {
      try {
        const pd = projectData;
        if (!pd?.files || pd.files.length === 0) {
          throw new Error("Projekt ist leer. Es gibt keine Dateien zum Bauen.");
        }

        // Repo Quelle: Projekt-Link → Fallback Config
        const githubRepo = (
          pd.linkedRepo?.trim() || CONFIG.BUILD.GITHUB_REPO
        ).trim();

        // Build Profile: nur erlaubte Werte (Default: preview)
        const profile =
          buildProfile === "development" ||
          buildProfile === "preview" ||
          buildProfile === "production"
            ? buildProfile
            : "preview";

        const startedAt = new Date().toISOString();
        setCurrentBuild({
          status: "queued",
          message: "🚀 Build wird gestartet…",
          jobId: null,
          githubRepo,
          buildProfile: profile,
          startedAt,
          lastUpdatedAt: startedAt,
        });

        // Build runs on GitHub. Best-effort push local files to repo, then trigger build via Supabase.
        const started = await startBuildJob({
          project: pd,
          buildProfile: profile,
        });

        const jobId = started.jobId;
        const githubRepoResolved = started.githubRepo;

        setCurrentBuild((prev) => ({
          ...(prev ?? { status: "queued" }),
          status: "queued",
          message: "✅ Build gestartet. Warte auf GitHub Actions…",
          jobId,
          githubRepo: githubRepoResolved,
          buildProfile: profile,
          lastUpdatedAt: new Date().toISOString(),
        }));

        try {
          await addBuildToHistory({
            id: uuidv4(),
            jobId,
            repoName: githubRepoResolved,
            status: "queued",
            startedAt,
            buildProfile: profile,
          });
        } catch (historyError) {
          console.warn(
            "⚠️ Build-Historie konnte nicht gespeichert werden:",
            historyError,
          );
        }

      } catch (e: any) {
        setCurrentBuild({
          status: "error",
          message: e?.message || String(e),
          lastUpdatedAt: new Date().toISOString(),
        });
        throw e;
      }
    },
    [projectData],
  );

  const value: ProjectContextProps = {
    projectData,
    isLoading,
    startBuild,
    currentBuild,
    updateProjectFiles,
    addChatMessage,
    clearChatHistory,
    setLastPreview,
    getGitHubToken,
    getWorkflowRuns,
    createFile,
    deleteFile,
    renameFile,
    setPackageName,
    exportProjectAsZip,
    exportTextFilesAsZip,
    importProjectFromZip,
    createNewProject,
    setTemplateId,
    setProjectName,
    // Be tolerant: older persisted chat entries might miss `id` (migration will repair on load)
    messages:
      projectData?.chatHistory?.filter(
        (msg) => msg && (msg.id || msg.timestamp) && typeof msg.content === "string",
      ) || [],
    autoFixRequest,
    triggerAutoFix,
    clearAutoFixRequest,
    exportAndBuild: async () => {
      Alert.alert("Fehler", "exportAndBuild ist veraltet.");
      return null;
    },
    setLinkedRepo,
    setPreferredBuildProfile,
    setAdvancedTemplatePickerEnabled,
  };

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