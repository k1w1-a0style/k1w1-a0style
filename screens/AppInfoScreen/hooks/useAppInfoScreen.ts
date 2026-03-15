// screens/AppInfoScreen/hooks/useAppInfoScreen.ts
// REFACTORED: import/export helpers → importExportHelpers.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";

import { useProject } from "../../../contexts/ProjectContext";
import { useAI, type AllAIProviders } from "../../../contexts/AIContext";
import {
  sanitizeAiConfigFromBackup,
  safeFormatBackupDate,
  validateApiBackupJson,
} from "../../../lib/appInfoBackup";
import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { getSupabaseAnonKey, saveSupabaseAnonKey } from "../../../lib/supabaseAnonKeyStorage";
import { useGitHub } from "../../../contexts/GitHubContext";
import {
  getGitHubToken,
  saveGitHubToken,
  deleteGitHubToken,
  getExpoToken,
  saveExpoToken,
  deleteExpoToken,
  getEdgeAdminKey,
  saveEdgeAdminKey,
  deleteEdgeAdminKey,
  getSigningMasterKey,
  saveSigningMasterKey,
  deleteSigningMasterKey,
} from "../../../infra/github/githubService";

import { TEMPLATE_INFO, type FullBackupV1 } from "../types";


import { exportAPIConfig, importAPIConfig, exportFullBackup, importFullBackup } from "./importExportHelpers";

export function useAppInfoScreen() {
  const {
    projectData,
    setProjectName,
    updateProjectFiles,
    setPackageName,
    setLinkedRepo,
  } = useProject();

  // Keep a local typed view to avoid implicit-any in array callbacks while
  // preserving runtime behavior.
  const typedProjectData = projectData as any;
  const { config, setConfig } = useAI();
  const {
    activeRepo,
    activeBranch,
    recentRepos,
    setActiveRepo,
    setActiveBranch,
    addRecentRepo,
    clearRecentRepos,
  } = useGitHub();
  const [appName, setAppName] = useState("");
  const [packageName, setPackageNameState] = useState("");
  const [iconPreview, setIconPreview] = useState<string | null>(null);

  // Load app name and package name from project
  useEffect(() => {
    if (!typedProjectData?.files) return;

    setAppName(typedProjectData.name || "Meine App");

    const pkgJson = typedProjectData.files.find(
      (f: any) => f.path === "package.json",
    );
    if (pkgJson && typeof pkgJson.content === "string") {
      try {
        const parsed = JSON.parse(pkgJson.content);
        setPackageNameState(parsed.name || "meine-app");
      } catch (error) {
        // Silently fallback to default
        setPackageNameState("meine-app");
      }
    }
  }, [typedProjectData?.name, typedProjectData?.files]);

  // Load icon preview separately to avoid unnecessary re-renders
  useEffect(() => {
    if (!typedProjectData?.files) {
      setIconPreview(null);
      return;
    }

    const iconFile = typedProjectData.files.find(
      (f: any) => f.path === "assets/icon.png",
    );
    if (!iconFile?.content) {
      setIconPreview(null);
      return;
    }

    let base64Data = iconFile.content;
    if (base64Data.startsWith("data:image/")) {
      base64Data = base64Data.split(",")[1];
    }

    if (
      base64Data &&
      base64Data.length > 100 &&
      /^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)
    ) {
      setIconPreview(`data:image/png;base64,${base64Data}`);
    } else {
      setIconPreview(null);
    }
  }, [typedProjectData?.files, (typedProjectData as any)?.lastModified]);

  const handleSaveAppName = useCallback(async () => {
    const trimmedName = appName.trim();
    if (!trimmedName) {
      Alert.alert("Fehler", "App-Name darf nicht leer sein.");
      return;
    }

    try {
      await setProjectName(trimmedName);
      Alert.alert("✅ Gespeichert", `App-Name: "${trimmedName}"`);
    } catch (error: any) {
      Alert.alert(
        "Fehler",
        error?.message || "Konnte App-Name nicht speichern.",
      );
    }
  }, [appName, setProjectName]);

  const handleSavePackageName = useCallback(async () => {
    const trimmedPkg = packageName.trim();
    if (!trimmedPkg) {
      Alert.alert("Fehler", "Package Name darf nicht leer sein.");
      return;
    }

    try {
      await setPackageName(trimmedPkg);
      Alert.alert("✅ Gespeichert", `Package Name: "${trimmedPkg}"`);
    } catch (error: any) {
      Alert.alert(
        "Fehler",
        error?.message || "Konnte Package Name nicht speichern.",
      );
    }
  }, [packageName, setPackageName]);

  const handleChooseIcon = useCallback(async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert("Fehler", "Zugriff auf die Fotogalerie wurde verweigert.");
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (pickerResult.canceled) {
        return;
      }

      const asset = pickerResult.assets?.[0];
      if (!asset || !asset.base64) {
        Alert.alert("Fehler", "Konnte das Bild nicht als Base64 laden.");
        return;
      }

      const base64Content = asset.base64;

      // Setze alle notwendigen Asset-Dateien für den App-Build
      const iconFile = { path: "assets/icon.png", content: base64Content };
      const adaptiveIconFile = {
        path: "assets/adaptive-icon.png",
        content: base64Content,
      };
      const splashFile = { path: "assets/splash.png", content: base64Content };
      const faviconFile = {
        path: "assets/favicon.png",
        content: base64Content,
      };

      await updateProjectFiles([
        iconFile,
        adaptiveIconFile,
        splashFile,
        faviconFile,
      ]);

      Alert.alert(
        "✅ Erfolg",
        "Alle App-Assets wurden aktualisiert:\n\n• icon.png\n• adaptive-icon.png\n• splash.png\n• favicon.png\n\nDeine App ist bereit für den Build!",
      );
    } catch (error: any) {
      Alert.alert(
        "Fehler",
        error?.message || "Assets konnten nicht aktualisiert werden.",
      );
    }
  }, [updateProjectFiles]);

  const handleExportAPIConfig = useCallback(async () => {
    try {
      const result = await exportAPIConfig(config);
      Alert.alert(
        "✅ Export erfolgreich",
        `API-Konfiguration wurde als Datei "${result.fileName}" gespeichert und kann nun geteilt werden.`,
      );
    } catch (error: any) {
      Alert.alert(
        "Fehler beim Export",
        error?.message || "Export fehlgeschlagen",
      );
    }
  }, [config]);

  const handleImportAPIConfig = useCallback(async () => {
    Alert.alert(
      "⚠️ API-Konfiguration importieren",
      "Dies wird alle vorhandenen API-Keys durch die importierten ersetzen. Fortfahren?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Importieren",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await importAPIConfig();
              const nextConfig = sanitizeAiConfigFromBackup(result.config, config);
              setConfig(nextConfig);

              const providers: AllAIProviders[] = [
                "groq",
                "gemini",
                "openai",
                "anthropic",
                "huggingface",
              ];
              const totalKeysImported = providers.reduce(
                (sum, p) => sum + (nextConfig.apiKeys?.[p]?.length || 0),
                0,
              );

              const exportDate = safeFormatBackupDate(result.exportDate);

              Alert.alert(
                "✅ Import erfolgreich",
                `${totalKeysImported} API-Keys wurden geladen (ersetzen die bisherigen).\n\nBackup-Datum: ${exportDate}`,
              );
            } catch (error: any) {
              if (!error.message.includes("abgebrochen")) {
                Alert.alert(
                  "Fehler beim Import",
                  error?.message || "Import fehlgeschlagen",
                );
              }
            }
          },
        },
      ],
    );
  }, [config, setConfig]);

  const handleExportFullBackup = useCallback(async () => {
    Alert.alert(
      "⚠️ Achtung: Voll-Backup enthält SECRETS",
      "Diese Datei enthält ALLE Tokens/Keys im Klartext (GitHub/Expo/Supabase/AI). Speichere sie nur sicher (z.B. verschlüsselt/privat). Fortfahren?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Exportieren",
          style: "destructive",
          onPress: async () => {
            try {
              const [githubToken, expoToken, edgeAdminKey, signingMasterKey] = await Promise.all([
                getGitHubToken().catch(() => null),
                getExpoToken().catch(() => null),
                getEdgeAdminKey().catch(() => null),
                getSigningMasterKey().catch(() => null),
              ]);

              await AsyncStorage.removeItem(
                STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY,
              ).catch(() => {});

              const [supabaseRaw, supabaseUrl, supabaseAnonKey, easProjectId] =
                await Promise.all([
                  AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_RAW).catch(() => ""),
                  AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL).catch(() => ""),
                  getSupabaseAnonKey().catch(() => ""),
                  AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID).catch(() => ""),
                ]);

              const payload: FullBackupV1 = {
                type: "k1w1-full-backup",
                version: 1,
                exportDate: new Date().toISOString(),
                appVersion: TEMPLATE_INFO.version,
                aiConfig: config,
                connections: {
                  supabaseRaw: supabaseRaw ?? "",
                  supabaseUrl: supabaseUrl ?? "",
                  supabaseAnonKey: supabaseAnonKey ?? "",
                  easProjectId: easProjectId ?? "",
                },
                tokens: {
                  githubToken,
                  expoToken,
                  edgeAdminKey,
                  signingMasterKey,
                },
                ciSecrets: {
                  // GitHub Actions / CI
                  GITHUB_TOKEN: githubToken ?? "",
                  EXPO_TOKEN: expoToken ?? "",
                  SUPABASE_URL: supabaseUrl ?? "",
                  SUPABASE_ANON_KEY: supabaseAnonKey ?? "",
                  EAS_PROJECT_ID: easProjectId ?? "",
                  // Our naming variants used across docs/scripts
                  K1W1_EDGE_ADMIN_KEY: edgeAdminKey ?? "",
                  SIGNING_ADMIN_KEY: edgeAdminKey ?? "",
                  SIGNING_MASTER_KEY: signingMasterKey ?? "",
                },
                github: {
                  activeRepo,
                  activeBranch,
                  recentRepos,
                },
              };

              const result = await exportFullBackup(payload);
              Alert.alert(
                "✅ Export erfolgreich",
                `Voll-Backup wurde als Datei "${result.fileName}" exportiert.

⚠️ Enthält Secrets im Klartext!`,
              );
            } catch (e: any) {
              Alert.alert(
                "Fehler beim Export",
                e?.message || "Export fehlgeschlagen",
              );
            }
          },
        },
      ],
    );
  }, [config, activeRepo, activeBranch, recentRepos]);

  const handleImportFullBackup = useCallback(async () => {
    Alert.alert(
      "⚠️ Voll-Backup importieren",
      "Das überschreibt ALLE Tokens/Keys + Connections + AI Config auf diesem Gerät. Fortfahren?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Importieren",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await importFullBackup();
              const data = result.data;
              if (!data) throw new Error("Ungültiges Backup (data fehlt)");

              // 1) AI Config (inkl. apiKeys) - sanitize to avoid weird backups
              if (data.aiConfig) {
                setConfig(sanitizeAiConfigFromBackup(data.aiConfig, config));
              }

              // 2) Connections (AsyncStorage)
              const c = data.connections || ({} as any);
              const ops: Promise<any>[] = [];
              if (typeof c.supabaseRaw === "string")
                ops.push(
                  AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_RAW, c.supabaseRaw),
                );
              if (typeof c.supabaseUrl === "string")
                ops.push(
                  AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, c.supabaseUrl),
                );
              if (typeof c.supabaseAnonKey === "string")
                ops.push(saveSupabaseAnonKey(c.supabaseAnonKey));
              await AsyncStorage.removeItem(
                STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY,
              ).catch(() => {});

              if (typeof c.easProjectId === "string")
                ops.push(
                  AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, c.easProjectId),
                );
              await Promise.all(ops);

              // 3) Tokens (SecureStore via helpers)
              // Prefer explicit fields in data.tokens; fall back to ciSecrets map.
              const t = (data as any).tokens || ({} as any);
              const cs = (data as any).ciSecrets || ({} as any);

              const ghTok =
                typeof t.githubToken === "string" && t.githubToken.trim()
                  ? t.githubToken.trim()
                  : typeof cs.GITHUB_TOKEN === "string" && cs.GITHUB_TOKEN.trim()
                    ? cs.GITHUB_TOKEN.trim()
                    : "";
              if (ghTok) await saveGitHubToken(ghTok);
              else await deleteGitHubToken();

              const expoTok =
                typeof t.expoToken === "string" && t.expoToken.trim()
                  ? t.expoToken.trim()
                  : typeof cs.EXPO_TOKEN === "string" && cs.EXPO_TOKEN.trim()
                    ? cs.EXPO_TOKEN.trim()
                    : "";
              if (expoTok) await saveExpoToken(expoTok);
              else await deleteExpoToken();

              const edgeKey =
                typeof t.edgeAdminKey === "string" && t.edgeAdminKey.trim()
                  ? t.edgeAdminKey.trim()
                  : typeof cs.K1W1_EDGE_ADMIN_KEY === "string" && cs.K1W1_EDGE_ADMIN_KEY.trim()
                    ? cs.K1W1_EDGE_ADMIN_KEY.trim()
                    : typeof cs.SIGNING_ADMIN_KEY === "string" && cs.SIGNING_ADMIN_KEY.trim()
                      ? cs.SIGNING_ADMIN_KEY.trim()
                      : "";
              if (edgeKey) await saveEdgeAdminKey(edgeKey);
              else await deleteEdgeAdminKey();

              const signingMaster =
                typeof t.signingMasterKey === "string" && t.signingMasterKey.trim()
                  ? t.signingMasterKey.trim()
                  : typeof cs.SIGNING_MASTER_KEY === "string" && cs.SIGNING_MASTER_KEY.trim()
                    ? cs.SIGNING_MASTER_KEY.trim()
                    : "";
              if (signingMaster) await saveSigningMasterKey(signingMaster);
              else await deleteSigningMasterKey();

              // 4) GitHub context (sofort aktiv setzen)
              const g = data.github || ({} as any);
              if (Array.isArray(g.recentRepos)) {
                await clearRecentRepos();
                const ordered = g.recentRepos.filter(Boolean);
                for (const repo of [...ordered].reverse()) {
                  try {
                    addRecentRepo(repo);
                  } catch {}
                }
              }
              const nextRepo = typeof g.activeRepo === "string" ? g.activeRepo || null : null;
              const nextBranch =
                typeof g.activeBranch === "string" ? g.activeBranch || null : null;

              setActiveRepo(nextRepo);
              setActiveBranch(nextBranch);

              // Persist selection so the rest of the app doesn't snap back to an old linkedRepo.
              // (GitHubContext syncs from ProjectContext during hydration.)
              setLinkedRepo(nextRepo, nextBranch);

              const exportDate = safeFormatBackupDate(result.exportDate);

              Alert.alert(
                "✅ Import erfolgreich",
                `Voll-Backup wurde importiert.

Backup-Datum: ${exportDate}

Tipp: App einmal neu öffnen, wenn irgendwas noch nicht sofort sichtbar ist.`,
              );
            } catch (error: any) {
              if (!error.message.includes("abgebrochen")) {
                Alert.alert(
                  "Fehler beim Import",
                  error?.message || "Import fehlgeschlagen",
                );
              }
            }
          },
        },
      ],
    );
  }, [config, setConfig, clearRecentRepos, addRecentRepo, setActiveRepo, setActiveBranch]);


  const fileCount = useMemo(
    () => typedProjectData?.files?.length || 0,
    [typedProjectData?.files],
  );
  const messageCount = useMemo(
    () =>
      (typedProjectData?.chatHistory || typedProjectData?.messages)?.length ||
      0,
    [typedProjectData?.chatHistory, typedProjectData?.messages],
  );

  // API Keys für jede Provider zählen
  const apiKeysCount = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(config.apiKeys).forEach((provider) => {
      counts[provider] = (
        config.apiKeys[provider as AllAIProviders] || []
      ).length;
    });
    return counts;
  }, [config.apiKeys]);

  // Prüfe, welche Assets gesetzt sind
  const assetsStatus = useMemo(() => {
    if (!typedProjectData?.files)
      return {
        icon: false,
        adaptiveIcon: false,
        splash: false,
        favicon: false,
      };

    const hasIcon = typedProjectData.files.some(
      (f: any) =>
        f.path === "assets/icon.png" && f.content.length > 100,
    );
    const hasAdaptiveIcon = typedProjectData.files.some(
      (f: any) =>
        f.path === "assets/adaptive-icon.png" && f.content.length > 100,
    );
    const hasSplash = typedProjectData.files.some(
      (f: any) =>
        f.path === "assets/splash.png" && f.content.length > 100,
    );
    const hasFavicon = typedProjectData.files.some(
      (f: any) =>
        f.path === "assets/favicon.png" && f.content.length > 100,
    );

    return {
      icon: hasIcon,
      adaptiveIcon: hasAdaptiveIcon,
      splash: hasSplash,
      favicon: hasFavicon,
    };
  }, [typedProjectData?.files]);


  return {
    projectData,
    appName,
    setAppName,
    packageName,
    setPackageNameState,
    iconPreview,
    setIconPreview,
    handleSaveAppName,
    handleSavePackageName,
    handleChooseIcon,
    handleExportAPIConfig,
    handleImportAPIConfig,
    handleExportFullBackup,
    handleImportFullBackup,
    fileCount,
    messageCount,
    apiKeysCount,
    assetsStatus,
    config,
    activeRepo,
    activeBranch,
    recentRepos,
  };
}
