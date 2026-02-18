
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
import { Alert, AppState, AppStateStatus } from "react-native";
import { v4 as uuidv4 } from "uuid";
import { Mutex } from "async-mutex";

import {
  ProjectData,
  ProjectFile,
  ChatMessage,
  ProjectContextProps,
  AutoFixRequest,
} from "./types";

import {
  saveProjectToStorage,
  loadProjectFromStorage,
  exportProjectAsZipFile,
  importProjectFromZipFile,
} from "./projectStorage";

import {
  getGitHubToken,
  getWorkflowRuns,
  pushFilesToRepo,
  getDefaultBranch,
} from "./githubService";

// ✅ FIX: Einheitlicher Validator-Wrapper
import { validateFilePath, validateFileContent } from "../lib/validators";
import { BuildStatus, mapBuildStatus } from "../lib/buildStatusMapper";
import { ensureSupabaseClient } from "../lib/supabase";
import {
  addBuildToHistory,
  updateBuildInHistory,
} from "../lib/buildHistoryStorage";
import { CONFIG } from "../config";

const loadTemplateFromFile = async (): Promise<ProjectFile[]> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const template = require("../templates/expo-sdk54-base.json");
    if (!Array.isArray(template) || template.length === 0) {
      throw new Error("Template ist ungültig");
    }
    return template.map((file: any) => ({
      ...file,
      content:
        typeof file.content === "string"
          ? file.content
          : JSON.stringify(file.content ?? "", null, 2),
    })) as ProjectFile[];
  } catch (error) {
    console.error("X Template Fehler:", error);
    return [{ path: "README.md", content: "# Template Fehler" }];
  }
};

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
} from "./githubService";

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentBuild, setCurrentBuild] = useState<CurrentBuildState | null>(
    null,
  );

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
        const fileMap = new Map(prev.files.map((f) => [f.path, f]));
        files.forEach((file) => {
          fileMap.set(file.path, file);
        });
        const mergedFiles = Array.from(fileMap.values());
        console.log(
          `📝 Dateien aktualisiert: ${files.length} geändert, ${mergedFiles.length} gesamt`,
        );
        return {
          ...prev,
          files: mergedFiles,
          name: newName || prev.name,
        };
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

              const release = await mutexRef.current.acquire();
              try {
                setProjectData(newProject);
                await saveProjectToStorage(newProject);
              } finally {
                release();
              }

              Alert.alert("Erfolg", "Neues Projekt wurde erstellt!");
              console.log("✅ Neues Projekt erstellt und gespeichert.");
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
      const result = await exportProjectAsZipFile(projectData);
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
              const result = await importProjectFromZipFile();
              result.project.chatHistory = [];

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
    console.log("[ProjectContext] Auto-Fix Request getriggert:", request.id);
  }, []);

  const clearAutoFixRequest = useCallback(() => {
    setAutoFixRequest(null);
    console.log("[ProjectContext] Auto-Fix Request gelöscht");
  }, []);

  const setLinkedRepo = useCallback(
    async (repo: string | null, branch?: string | null) => {
      await updateProject((prev) => ({
        ...prev,
        linkedRepo: repo,
        linkedBranch: branch ?? prev.linkedBranch ?? null,
      }));
      console.log(
        `🔗 Projekt verknüpft mit: ${repo ?? "–"} (Branch: ${branch ?? "–"})`,
      );
    },
    [updateProject],
  );

  useEffect(() => {
    const initializeProject = async () => {
      try {
        console.log("APP START (Context V15 - ALL CRITICAL FIXES APPLIED)");
        const savedProject = await loadProjectFromStorage();

        if (savedProject) {
          console.log("📖 Projekt geladen:", savedProject.name);
          if (!savedProject.files) savedProject.files = [];
          if (!savedProject.chatHistory) savedProject.chatHistory = [];
          setProjectData(savedProject);
        } else {
          console.log("Kein Projekt gefunden, lade neues Template...");
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
          console.log("Neues Template-Projekt erstellt und gespeichert.");
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
        console.log("🔄 App geht in Background, flushe ausstehende Saves...");
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        if (projectData) {
          try {
            await saveProjectToStorage(projectData);
            console.log("✅ Background-Save erfolgreich");
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

  const buildPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const buildPollErrorCountRef = useRef(0);
  const activeBuildJobIdRef = useRef<number | null>(null);

  const stopBuildPolling = useCallback(() => {
    if (buildPollIntervalRef.current) {
      clearInterval(buildPollIntervalRef.current);
      buildPollIntervalRef.current = null;
    }
    buildPollErrorCountRef.current = 0;
    activeBuildJobIdRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopBuildPolling();
    };
  }, [stopBuildPolling]);

  const pollBuildStatusOnce = useCallback(
    async (jobId: number) => {
      try {
        const supabase = await ensureSupabaseClient();

        const { data, error } = await supabase.functions.invoke(
          "check-eas-build",
          {
            body: { jobId },
          },
        );

        if (error) throw error;

        const mapped: BuildStatus = mapBuildStatus(data?.status);
        const nowIso = new Date().toISOString();

        setCurrentBuild((prev) => {
          const base: CurrentBuildState = prev ?? { status: "idle" };
          return {
            ...base,
            status: mapped,
            jobId,
            runId: data?.runId || data?.run_id || base.runId || null,
            urls: {
              html: data?.urls?.html ?? base.urls?.html ?? null,
              artifacts: data?.urls?.artifacts ?? base.urls?.artifacts ?? null,
              buildUrl:
                data?.build_url ??
                data?.download_url ??
                base.urls?.buildUrl ??
                null,
            },
            message:
              mapped === "queued"
                ? "⏳ Build ist in der Warteschlange…"
                : mapped === "building"
                  ? "🔨 Build läuft…"
                  : mapped === "success"
                    ? "✅ Build erfolgreich!"
                    : mapped === "failed"
                      ? "❌ Build fehlgeschlagen."
                      : mapped === "error"
                        ? "⚠️ Fehler beim Status-Abruf."
                        : "⏸️ Kein aktiver Build.",
            lastUpdatedAt: nowIso,
            completedAt: ["success", "failed", "error"].includes(mapped)
              ? nowIso
              : base.completedAt,
          };
        });

        try {
          await updateBuildInHistory(jobId, {
            status: mapped,
            htmlUrl: data?.urls?.html ?? null,
            artifactUrl: data?.urls?.artifacts ?? null,
          });
        } catch (historyError) {
          console.warn(
            "⚠️ Build-Historie konnte nicht aktualisiert werden:",
            historyError,
          );
        }

        if (["success", "failed", "error"].includes(mapped)) {
          stopBuildPolling();
        }

        buildPollErrorCountRef.current = 0;
      } catch (e: any) {
        buildPollErrorCountRef.current += 1;
        const msg = e?.message || String(e);
        console.warn(
          `⚠️ check-eas-build Polling Fehler (${buildPollErrorCountRef.current}):`,
          msg,
        );

        setCurrentBuild((prev) => {
          const base: CurrentBuildState = prev ?? { status: "idle" };
          return {
            ...base,
            status: base.status === "idle" ? "error" : base.status,
            message: `⚠️ Status konnte nicht aktualisiert werden: ${msg}`,
            lastUpdatedAt: new Date().toISOString(),
          };
        });

        if (buildPollErrorCountRef.current >= 5) {
          stopBuildPolling();
        }
      }
    },
    [stopBuildPolling],
  );

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

        stopBuildPolling();

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

        // ✅ Build läuft auf GitHub. Damit wirklich der aktuelle Stand gebaut wird,
        // pushen wir (best-effort) die lokalen Projektdateien ins Repo.
        // ✅ Branch: nutze Projekt-Branch, sonst Default-Branch des Repos (wichtig wenn Repo nicht 'main' nutzt)
        let buildBranch =
          typeof pd.linkedBranch === "string" ? pd.linkedBranch.trim() : "";

        try {
          const [owner, repo] = githubRepo.split("/");
          const localFiles = pd.files;

          if (owner && repo && localFiles?.length) {
            // ✅ Branch: linkedBranch → repo default branch → fallback main          if (!buildBranch) {
            try {
              buildBranch = (await getDefaultBranch(owner, repo)).trim();
            } catch (err) {
              console.warn(
                "⚠️ Default-Branch konnte nicht ermittelt werden, fallback auf 'main':",
                err,
              );
              buildBranch = "main";
            }
          }

          if (!buildBranch) buildBranch = "main";

            await pushFilesToRepo(owner, repo, localFiles as any, buildBranch);
          }
        } catch (e) {
          console.warn(
            "⚠️ Auto-Push nach GitHub fehlgeschlagen. Build nutzt evtl. alten Repo-Stand:",
            e,
          );
        }

        const supabase = await ensureSupabaseClient();
        const { data, error } = await supabase.functions.invoke(
          "trigger-eas-build",
          {
            body: { githubRepo, buildProfile: profile, branch: buildBranch || null },
          },
        );

        if (error) throw error;

        const jobId: number | null =
          typeof data?.jobId === "number"
            ? data.jobId
            : typeof data?.job_id === "number"
              ? data.job_id
              : typeof data?.job?.id === "number"
                ? data.job.id
                : null;

        if (!jobId) {
          throw new Error(
            "❌ trigger-eas-build lieferte keine gültige Job-ID zurück.",
          );
        }

        activeBuildJobIdRef.current = jobId;

        setCurrentBuild((prev) => ({
          ...(prev ?? { status: "queued" }),
          status: "queued",
          message: "✅ Build gestartet. Warte auf GitHub Actions…",
          jobId,
          githubRepo,
          buildProfile: profile,
          lastUpdatedAt: new Date().toISOString(),
        }));

        try {
          await addBuildToHistory({
            id: uuidv4(),
            jobId,
            repoName: githubRepo,
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

        await pollBuildStatusOnce(jobId);
        buildPollIntervalRef.current = setInterval(() => {
          const activeId = activeBuildJobIdRef.current;
          if (!activeId) return;
          pollBuildStatusOnce(activeId);
        }, 6000);
      } catch (e: any) {
        stopBuildPolling();
        setCurrentBuild({
          status: "error",
          message: e?.message || String(e),
          lastUpdatedAt: new Date().toISOString(),
        });
        throw e;
      }
    },
    [pollBuildStatusOnce, projectData, stopBuildPolling],
  );

  const value: ProjectContextProps = {
    projectData,
    isLoading,
    startBuild,
    currentBuild,
    updateProjectFiles,
    addChatMessage,
    clearChatHistory,
    getGitHubToken,
    getWorkflowRuns,
    createFile,
    deleteFile,
    renameFile,
    setPackageName,
    exportProjectAsZip,
    importProjectFromZip,
    createNewProject,
    setProjectName,
    messages: projectData?.chatHistory?.filter((msg) => msg && msg.id) || [],
    autoFixRequest,
    triggerAutoFix,
    clearAutoFixRequest,
    exportAndBuild: async () => {
      Alert.alert("Fehler", "exportAndBuild ist veraltet.");
      return null;
    },
    setLinkedRepo,
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
