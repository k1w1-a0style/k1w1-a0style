import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";

import { useProject } from "../../../contexts/ProjectContext";
import { useAI, type AllAIProviders } from "../../../contexts/AIContext";
import { STORAGE_KEYS } from "../../../lib/storageKeys";
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
  getSupabaseServiceRoleKey,
  saveSupabaseServiceRoleKey,
  deleteSupabaseServiceRoleKey,
} from "../../../contexts/githubService";

import { TEMPLATE_INFO, type FullBackupV1 } from "../types";

const exportAPIConfig = async (config: any) => {
  try {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const fileName = `k1w1-api-backup-${timestamp}.json`;
    const filePath = FileSystem.cacheDirectory + fileName;

    const exportData = {
      version: 1,
      exportDate: new Date().toISOString(),
      appVersion: TEMPLATE_INFO.version,
      config: config,
    };

    await FileSystem.writeAsStringAsync(
      filePath,
      JSON.stringify(exportData, null, 2),
      { encoding: FileSystem.EncodingType.UTF8 },
    );

    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
    }

    await Sharing.shareAsync(`file://${filePath}`, {
      mimeType: "application/json",
      dialogTitle: "API-Konfiguration exportieren",
      UTI: "public.json",
    });

    return { success: true, fileName };
  } catch (error: any) {
    throw new Error(error?.message || "Export fehlgeschlagen");
  }
};

const importAPIConfig = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/json",
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      throw new Error("Import abgebrochen");
    }

    const fileContent = await FileSystem.readAsStringAsync(
      result.assets[0].uri,
      {
        encoding: FileSystem.EncodingType.UTF8,
      },
    );

    const importData = JSON.parse(fileContent);

    if (!importData.config || !importData.version) {
      throw new Error("Ungültiges Backup-Format");
    }

    return {
      success: true,
      config: importData.config,
      exportDate: importData.exportDate,
    };
  } catch (error: any) {
    if (error.message.includes("abgebrochen")) {
      throw error;
    }
    throw new Error(error?.message || "Import fehlgeschlagen");
  }
};

// Voll-Backup (ALLE Tokens/Keys + AI Config + Connections + GitHub Auswahl)
// ⚠️ Enthält SECRETS im Klartext. Datei nur sicher speichern!

const exportFullBackup = async (data: FullBackupV1) => {
  try {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const fileName = `k1w1-full-backup-${timestamp}.json`;
    const filePath = FileSystem.cacheDirectory + fileName;

    await FileSystem.writeAsStringAsync(
      filePath,
      JSON.stringify(data, null, 2),
      { encoding: FileSystem.EncodingType.UTF8 },
    );

    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
    }

    await Sharing.shareAsync(`file://${filePath}`, {
      mimeType: "application/json",
      dialogTitle: "Voll-Backup exportieren",
      UTI: "public.json",
    });

    return { success: true, fileName };
  } catch (error: any) {
    throw new Error(error?.message || "Export fehlgeschlagen");
  }
};

const importFullBackup = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/json",
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      throw new Error("Import abgebrochen");
    }

    const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const importData = JSON.parse(fileContent);

    if (!importData || importData.type !== "k1w1-full-backup" || importData.version !== 1) {
      throw new Error("Ungültiges Backup-Format");
    }

    return {
      success: true,
      data: importData as FullBackupV1,
      exportDate: importData.exportDate,
    };
  } catch (error: any) {
    if (error.message.includes("abgebrochen")) {
      throw error;
    }
    throw new Error(error?.message || "Import fehlgeschlagen");
  }
};

export function useAppInfoScreen() {
  const { projectData, setProjectName, updateProjectFiles, setPackageName } =
    useProject();

  // Keep a local typed view to avoid implicit-any in array callbacks while
  // preserving runtime behavior.
  const typedProjectData = projectData as any;
const { config, addApiKey, setConfig } = useAI();
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

              // Importiere alle Keys
              const importedConfig = result.config;
              const providers: AllAIProviders[] = [
                "groq",
                "gemini",
                "openai",
                "anthropic",
                "huggingface",
              ];

              let totalKeysImported = 0;
              for (const provider of providers) {
                const keys = importedConfig.apiKeys?.[provider] || [];
                for (const key of keys) {
                  try {
                    await addApiKey(provider, key);
                    totalKeysImported++;
                  } catch (e) {
                    // Key existiert bereits, überspringen
                  }
                }
              }

              const exportDate = result.exportDate
                ? new Date(result.exportDate).toLocaleString("de-DE")
                : "Unbekannt";

              Alert.alert(
                "✅ Import erfolgreich",
                `${totalKeysImported} API-Keys wurden importiert.\n\nBackup-Datum: ${exportDate}\n\nBitte überprüfe die geladenen Keys in der Liste unten.`,
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
  }, [addApiKey]);

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
              const [githubToken, expoToken, edgeAdminKey] = await Promise.all([
                getGitHubToken().catch(() => null),
                getExpoToken().catch(() => null),
                getEdgeAdminKey().catch(() => null),
              ]);

              const srvSecure = await getSupabaseServiceRoleKey().catch(() => null);
              const srvLegacy = await AsyncStorage.getItem(
                STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY_LEGACY,
              ).catch(() => "");
              const supabaseServiceRoleKey = (srvSecure || srvLegacy || "").trim();
              if (!srvSecure && srvLegacy) {
                await saveSupabaseServiceRoleKey(srvLegacy);
                await AsyncStorage.removeItem(
                  STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY_LEGACY,
                ).catch(() => {});
              }

              const [supabaseRaw, supabaseUrl, supabaseAnonKey, easProjectId] =
                await Promise.all([
                  AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_RAW).catch(() => ""),
                  AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL).catch(() => ""),
                  AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_KEY).catch(() => ""),
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
                  supabaseServiceRoleKey: supabaseServiceRoleKey ?? "",
                  easProjectId: easProjectId ?? "",
                },
                tokens: {
                  githubToken,
                  expoToken,
                  edgeAdminKey,
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

              // 1) AI Config (inkl. apiKeys)
              if (data.aiConfig) {
                setConfig(data.aiConfig);
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
                ops.push(
                  AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_KEY, c.supabaseAnonKey),
                );
              const roleKeyToSet =
                typeof c.supabaseServiceRoleKey === "string"
                  ? c.supabaseServiceRoleKey.trim()
                  : "";

              if (typeof c.easProjectId === "string")
                ops.push(
                  AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, c.easProjectId),
                );
              await Promise.all(ops);

              // Supabase Service Role Key -> SecureStore (and clear legacy AsyncStorage)
              if (roleKeyToSet) await saveSupabaseServiceRoleKey(roleKeyToSet);
              else await deleteSupabaseServiceRoleKey();
              await AsyncStorage.removeItem(
                STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY_LEGACY,
              ).catch(() => {});

              // 3) Tokens (SecureStore via helpers)
              const t = data.tokens || ({} as any);
              if (typeof t.githubToken === "string" && t.githubToken.trim())
                await saveGitHubToken(t.githubToken.trim());
              else await deleteGitHubToken();

              if (typeof t.expoToken === "string" && t.expoToken.trim())
                await saveExpoToken(t.expoToken.trim());
              else await deleteExpoToken();

              if (typeof t.edgeAdminKey === "string" && t.edgeAdminKey.trim())
                await saveEdgeAdminKey(t.edgeAdminKey.trim());
              else await deleteEdgeAdminKey();

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
              if (typeof g.activeRepo === "string")
                setActiveRepo(g.activeRepo || null);
              if (typeof g.activeBranch === "string")
                setActiveBranch(g.activeBranch || null);

              const exportDate = result.exportDate
                ? new Date(result.exportDate).toLocaleString("de-DE")
                : "Unbekannt";

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
  }, [setConfig, clearRecentRepos, addRecentRepo, setActiveRepo, setActiveBranch]);


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
