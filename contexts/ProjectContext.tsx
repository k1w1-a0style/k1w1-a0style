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

import {
  ProjectData,
  ProjectFile,
  ChatMessage,
  ProjectContextProps,
  AutoFixRequest,
  LastPreviewMeta,
} from "./types";

import type { TemplateId, CoreTemplateId } from "./types";

import {
  saveProjectToStorage,
  loadProjectFromStorage,
  exportProjectAsZipFile,
  importProjectFromZipFile,
} from "./projectStorage";

import {
  getGitHubToken,
  getEdgeAdminKey,
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
import { runTemplateHardChecklist, resolveEffectiveTemplateId } from "../lib/templateChecklist";

const loadTemplateFromFile = async (templateId: TemplateId = "base"): Promise<ProjectFile[]> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const template =
      templateId === "navigation"
        ? require("../templates/expo-sdk54-navigation.json")
        : templateId === "crud"
          ? require("../templates/expo-sdk54-crud.json")
          : templateId === "full"
            ? require("../templates/expo-sdk54-full.json")
            : require("../templates/expo-sdk54-base.json");
    if (!Array.isArray(template) || template.length === 0) {
      throw new Error("Template ist ungültig");
    }
    const mapped = template.map((file: any) => ({
      ...file,
      content:
        typeof file.content === "string"
          ? file.content
          : JSON.stringify(file.content ?? "", null, 2),
    })) as ProjectFile[];

    // ✅ Harte Template-Checkliste (Autofix aktiv): verhindert "halbkaputte" New-Projects
    const firstPass = runTemplateHardChecklist(mapped, { autofix: true });
    const secondPass = runTemplateHardChecklist(firstPass.files, { autofix: false });

    if (!secondPass.report.ok) {
      const issues = secondPass.report.issues
        .map((i) => `- [${i.severity}] ${i.file ?? "(global)"}: ${i.reason}${i.fix ? ` → FIX: ${i.fix}` : ""}`)
        .join("\n");

      // Wir lassen das Projekt trotzdem entstehen (autofix hat schon viel repariert),
      // aber legen einen Report ab, damit du sofort siehst, was noch fehlt.
      const reportFile: ProjectFile = {
        path: "TEMPLATE_CHECKLIST_REPORT.md",
        content: `# Template Checklist Report\n\n${secondPass.report.summary}\n\n${issues}\n`,
      };

      return [reportFile, ...firstPass.files];
    }

    return firstPass.files;
  } catch (error) {
    console.error("X Template Fehler:", error);
    return [{ path: "README.md", content: "# Template Fehler" }];
  }
};

const SAVE_DEBOUNCE_MS = 500;

const TEMPLATE_CATALOG: Record<CoreTemplateId, { id: CoreTemplateId; label: string; description: string; files: any[] }> = {
  base: {
    id: "base",
    label: "Base (Blank)",
    description: "Expo SDK 54 blank scaffold (Android-only) with EAS profiles (dev/preview/prod).",
    files: require("../templates/expo-sdk54-base.json"),
  },
  navigation: {
    id: "navigation",
    label: "Navigation",
    description: "Blank + React Navigation stack + basic screens (Android-only).",
    files: require("../templates/expo-sdk54-navigation.json"),
  },
  crud: {
    id: "crud",
    label: "CRUD",
    description: "Blank + simple CRUD sample + storage (Android-only).",
    files: require("../templates/expo-sdk54-crud.json"),
  },
  full: {
    id: "full",
    label: "Full",
    description: "Blank + React Navigation + CRUD sample (Android-only).",
    files: require("../templates/expo-sdk54-full.json"),
  },
};

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
} from "./githubService";

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentBuild, setCurrentBuild] = useState<CurrentBuildState | null>(
    null,
  );

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

  const exportTextFilesAsZip = useCallback(async () => {
    if (!projectData) {
      Alert.alert(
        "Export Fehlgeschlagen",
        "Kein Projekt zum Exportieren vorhanden.",
      );
      return;
    }

    // Filter out binary/assets so the ZIP is shareable without leaking heavy files.
    const BINARY_EXT = new Set([
      "png",
      "jpg",
      "jpeg",
      "webp",
      "gif",
      "bmp",
      "ico",
      "mp3",
      "wav",
      "m4a",
      "mp4",
      "mov",
      "mkv",
      "zip",
      "jar",
      "keystore",
      "jks",
      "cer",
      "der",
      "p12",
      "ttf",
      "otf",
      "woff",
      "woff2",
    ]);

    const isBinaryPath = (p: string) => {
      const n = String(p || "").toLowerCase();
      const ext = n.includes(".") ? n.split(".").pop() || "" : "";
      return BINARY_EXT.has(ext);
    };

    const filtered = (projectData.files || []).filter((f) => {
      if (!f?.path || typeof f.path !== "string") return false;
      const content = typeof (f as any).content === "string" ? (f as any).content : "";
      if (content.startsWith("base64:")) return false;
      if (isBinaryPath(f.path)) return false;
      return true;
    });

    try {
      const clone = {
        ...projectData,
        files: filtered,
      };
      const result = await exportProjectAsZipFile(clone as any);
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

  const setTemplateId = useCallback(
    async (templateId: TemplateId) => {
      if (!templateId) return;
      await updateProject((prev) => ({ ...prev, templateId }));
      console.log(`🧩 Template gespeichert: ${templateId}`);
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
      console.log(`⚙️ Preferred Build-Profile gespeichert: ${profile}`);
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

  const buildPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
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


const pauseBuildPolling = useCallback(() => {
  if (buildPollIntervalRef.current) {
    clearInterval(buildPollIntervalRef.current);
    buildPollIntervalRef.current = null;
  }
  // keep activeBuildJobIdRef for resume
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

        const edgeAdminKey = await getEdgeAdminKey().catch(() => null);
        const invokeOpts: { body: any; headers?: Record<string, string> } = {
          body: { jobId },
        };
        if (edgeAdminKey)
          invokeOpts.headers = { "x-k1w1-admin-key": edgeAdminKey };
        const { data, error } = await supabase.functions.invoke(
          "check-eas-build",
          invokeOpts,
        );

        if (error) throw error;

        // check-eas-build returns { ok, job: {...} }.
        // Keep backwards-compat with older shapes by probing multiple fields.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyData: any = data ?? {};
        const job = anyData?.job ?? anyData?.data?.job ?? null;

        const rawStatus: string | undefined =
          (job?.status as string | undefined) ??
          (anyData?.status as string | undefined) ??
          (anyData?.job_status as string | undefined) ??
          undefined;

        const mapped: BuildStatus = mapBuildStatus(rawStatus);

        const runIdRaw =
          job?.github_run_id ??
          anyData?.runId ??
          anyData?.run_id ??
          anyData?.github_run_id ??
          null;

        const runId: number | null =
          typeof runIdRaw === "number"
            ? runIdRaw
            : typeof runIdRaw === "string" && /^\d+$/.test(runIdRaw)
              ? Number(runIdRaw)
              : null;

        const urls = job?.urls ?? anyData?.urls ?? {};
        const htmlUrl =
          urls?.githubRun ?? urls?.html ?? urls?.run ?? urls?.runUrl ?? null;
        const artifactsUrl = urls?.artifacts ?? urls?.artifact ?? null;

        const buildUrl =
          urls?.buildUrl ??
          job?.build_url ??
          anyData?.build_url ??
          anyData?.buildUrl ??
          null;

        const downloadUrl =
          job?.download_url ??
          anyData?.download_url ??
          anyData?.downloadUrl ??
          null;

        const nowIso = new Date().toISOString();

        setCurrentBuild((prev) => {
          const base: CurrentBuildState = prev ?? { status: "idle" };
          return {
            ...base,
            status: mapped,
            jobId,
            runId: runId ?? base.runId ?? null,
            urls: {
              html: htmlUrl ?? base.urls?.html ?? null,
              artifacts: artifactsUrl ?? base.urls?.artifacts ?? null,
              // Priority: direct download_url → artifacts page → EAS build url
              buildUrl:
                (typeof downloadUrl === "string" && downloadUrl.trim()
                  ? downloadUrl
                  : null) ??
                (typeof artifactsUrl === "string" && artifactsUrl.trim()
                  ? artifactsUrl
                  : null) ??
                (typeof buildUrl === "string" && buildUrl.trim()
                  ? buildUrl
                  : null) ??
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
            htmlUrl: htmlUrl ?? null,
            artifactUrl: artifactsUrl ?? null,
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
        if (buildPollErrorCountRef.current >= 8) {
          const msg = e?.message || String(e);
          stopBuildPolling();
          setCurrentBuild((prev) => ({
            ...(prev ?? { status: "error" }),
            status: "error",
            message: `🛑 Polling abgebrochen (zu viele Fehler). Letzter Fehler: ${msg}`,
            lastUpdatedAt: new Date().toISOString(),
          }));
          return;
        }
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

// Pause/Resume build polling on AppState (Android background reliability)
useEffect(() => {
  const sub = AppState.addEventListener("change", (state) => {
    if (state !== "active") {
      pauseBuildPolling();
      return;
    }
    const activeId = activeBuildJobIdRef.current;
    if (activeId && !buildPollIntervalRef.current) {
      pollBuildStatusOnce(activeId).catch(() => {});
      buildPollIntervalRef.current = setInterval(() => {
        const id = activeBuildJobIdRef.current;
        if (!id) return;
        pollBuildStatusOnce(id).catch(() => {});
      }, 6000);
    }
  });
  return () => sub.remove();
}, [pauseBuildPolling, pollBuildStatusOnce]);


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
          if (!githubRepo || !githubRepo.includes("/")) {
            throw new Error(
              'Kein GitHub-Repo verbunden. Bitte in "Connections" ein Repo verknüpfen.',
            );
          }
          const [owner, repo] = githubRepo.split("/");
          const localFiles = pd.files;

          if (owner && repo && localFiles?.length) {
            // ✅ Branch: linkedBranch → repo default branch → fallback main
            if (!buildBranch) {
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
        const edgeAdminKey = await getEdgeAdminKey().catch(() => null);
        const invokeOpts: { body: any; headers?: Record<string, string> } = {
          body: { githubRepo, buildProfile: profile, branch: buildBranch },
        };
        if (edgeAdminKey)
          invokeOpts.headers = { "x-k1w1-admin-key": edgeAdminKey };
        const { data, error } = await supabase.functions.invoke(
          "trigger-eas-build",
          invokeOpts,
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
          pollBuildStatusOnce(activeId).catch(() => {});
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
    messages: projectData?.chatHistory?.filter((msg) => msg && msg.id) || [],
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