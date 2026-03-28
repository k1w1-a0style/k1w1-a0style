import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";

import { useProject } from "../../../contexts/ProjectContext";
import { useAI, type AIConfig, type AllAIProviders } from "../../../contexts/AIContext";
import {
  sanitizeAiConfigFromBackup,
  safeFormatBackupDate,
} from "../../../lib/appInfoBackup";
import {
  createConfigAndSecretsBackupPayload,
  createSecretBackupPayload,
  type SecretBackupPayloadV1,
  type SecureBackupScope,
  type SecureBackupPayloadV1,
} from "../../../lib/appInfoScopedBackup";
import { STORAGE_KEYS, legacyClientServiceRoleStorageKeys } from "../../../lib/storageKeys";
import { getSupabaseAnonKey, saveSupabaseAnonKey } from "../../../lib/supabaseAnonKeyStorage";
import { useGitHub } from "../../../contexts/GitHubContext";
import {
  getGitHubToken,
  saveGitHubToken,
  deleteGitHubToken,
  getExpoToken,
  saveExpoToken,
  deleteExpoToken,
  getWorkflowAdminKey,
  saveWorkflowAdminKey,
  deleteWorkflowAdminKey,
  getAndroidKeystoreExportAdminKey,
  saveAndroidKeystoreExportAdminKey,
  deleteAndroidKeystoreExportAdminKey,
  getLegacyEdgeAdminKey,
  saveLegacyEdgeAdminKey,
  deleteLegacyEdgeAdminKey,
  getSigningAdminKey,
  saveSigningAdminKey,
  deleteSigningAdminKey,
  getSigningMasterKey,
  saveSigningMasterKey,
  deleteSigningMasterKey,
} from "../../../infra/github/githubService";

import {
  exportAPIConfig,
  exportEncryptedScopedBackup,
  importAPIConfig,
  importEncryptedScopedBackup,
} from "./importExportHelpers";

type SecureBackupRequest =
  | { mode: "export"; scope: SecureBackupScope }
  | { mode: "import" };

type ProjectFileLike = {
  path: string;
  content: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  if (isRecord(error) && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function isAbortLikeError(error: unknown): boolean {
  const message = getErrorMessage(error, "").toLowerCase();
  return message.includes("abgebrochen");
}

function toProjectFiles(value: unknown): ProjectFileLike[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is ProjectFileLike =>
      isRecord(entry) && typeof entry.path === "string" && typeof entry.content === "string",
  );
}

function buildSecretCiSecrets(payload: SecretBackupPayloadV1) {
  return {
    GITHUB_TOKEN: payload.tokens.githubToken ?? "",
    EXPO_TOKEN: payload.tokens.expoToken ?? "",
    SUPABASE_URL: payload.connections.supabaseUrl,
    SUPABASE_ANON_KEY: payload.connections.supabaseAnonKey,
    EAS_PROJECT_ID: payload.connections.easProjectId,
    K1W1_EDGE_WORKFLOW_ADMIN_KEY: payload.tokens.workflowAdminKey ?? "",
    K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY: payload.tokens.androidKeystoreExportAdminKey ?? "",
    K1W1_EDGE_ADMIN_KEY: payload.tokens.legacyEdgeAdminKey ?? "",
    K1W1_EDGE_WORKFLOW_CI_BEARER: "",
    SIGNING_ADMIN_KEY: payload.tokens.signingAdminKey ?? "",
    SIGNING_MASTER_KEY: payload.tokens.signingMasterKey ?? "",
  };
}

export function useAppInfoScreen() {
  const { projectData, setProjectName, updateProjectFiles, setPackageName, setLinkedRepo } = useProject();
  const projectFiles = useMemo(() => toProjectFiles(projectData?.files), [projectData?.files]);
  const { config, setConfig } = useAI();
  const {
    activeRepo,
    activeBranch,
    recentRepos,
    addRecentRepo,
    clearRecentRepos,
  } = useGitHub();
  const [appName, setAppName] = useState("");
  const [packageName, setPackageNameState] = useState("");
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [secureBackupRequest, setSecureBackupRequest] = useState<SecureBackupRequest | null>(null);
  const [secureBackupBusy, setSecureBackupBusy] = useState(false);

  useEffect(() => {
    if (!projectFiles.length) return;

    setAppName(projectData?.name || "Meine App");

    const pkgJson = projectFiles.find((f) => f.path === "package.json");
    if (pkgJson && typeof pkgJson.content === "string") {
      try {
        const parsed = JSON.parse(pkgJson.content);
        setPackageNameState(parsed.name || "meine-app");
      } catch {
        setPackageNameState("meine-app");
      }
    }
  }, [projectData?.name, projectFiles]);

  useEffect(() => {
    if (!projectFiles.length) {
      setIconPreview(null);
      return;
    }

    const iconFile = projectFiles.find((f) => f.path === "assets/icon.png");
    if (!iconFile?.content) {
      setIconPreview(null);
      return;
    }

    let base64Data = iconFile.content;
    if (base64Data.startsWith("data:image/")) {
      base64Data = base64Data.split(",")[1];
    }

    if (base64Data && base64Data.length > 100 && /^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
      setIconPreview(`data:image/png;base64,${base64Data}`);
    } else {
      setIconPreview(null);
    }
  }, [projectFiles, projectData?.lastModified]);

  const handleSaveAppName = useCallback(async () => {
    const trimmedName = appName.trim();
    if (!trimmedName) {
      Alert.alert("Fehler", "App-Name darf nicht leer sein.");
      return;
    }

    try {
      await setProjectName(trimmedName);
      Alert.alert("✅ Gespeichert", `App-Name: "${trimmedName}"`);
    } catch (error: unknown) {
      Alert.alert("Fehler", getErrorMessage(error, "Konnte App-Name nicht speichern."));
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
    } catch (error: unknown) {
      Alert.alert("Fehler", getErrorMessage(error, "Konnte Package Name nicht speichern."));
    }
  }, [packageName, setPackageName]);

  const handleChooseIcon = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
      await updateProjectFiles([
        { path: "assets/icon.png", content: base64Content },
        { path: "assets/adaptive-icon.png", content: base64Content },
        { path: "assets/splash.png", content: base64Content },
        { path: "assets/favicon.png", content: base64Content },
      ]);

      Alert.alert(
        "✅ Erfolg",
        "Alle App-Assets wurden aktualisiert:\n\n• icon.png\n• adaptive-icon.png\n• splash.png\n• favicon.png\n\nDeine App ist bereit für den Build!",
      );
    } catch (error: unknown) {
      Alert.alert("Fehler", getErrorMessage(error, "Assets konnten nicht aktualisiert werden."));
    }
  }, [updateProjectFiles]);

  const collectSecretBackupPayload = useCallback(async () => {
    const [
      githubToken,
      expoToken,
      workflowAdminKey,
      androidKeystoreExportAdminKey,
      legacyEdgeAdminKey,
      signingAdminKey,
      signingMasterKey,
    ] = await Promise.all([
      getGitHubToken().catch(() => null),
      getExpoToken().catch(() => null),
      getWorkflowAdminKey().catch(() => null),
      getAndroidKeystoreExportAdminKey().catch(() => null),
      getLegacyEdgeAdminKey().catch(() => null),
      getSigningAdminKey().catch(() => null),
      getSigningMasterKey().catch(() => null),
    ]);

    await Promise.all(
      legacyClientServiceRoleStorageKeys().map((key) => AsyncStorage.removeItem(key).catch(() => {})),
    );

    const [supabaseRaw, supabaseUrl, supabaseAnonKey, easProjectId] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_RAW).catch(() => ""),
      AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL).catch(() => ""),
      getSupabaseAnonKey().catch(() => ""),
      AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID).catch(() => ""),
    ]);

    const payload = createSecretBackupPayload({
      connections: {
        supabaseRaw: supabaseRaw ?? "",
        supabaseUrl: supabaseUrl ?? "",
        supabaseAnonKey: supabaseAnonKey ?? "",
        easProjectId: easProjectId ?? "",
      },
      tokens: {
        githubToken,
        expoToken,
        workflowAdminKey,
        androidKeystoreExportAdminKey,
        legacyEdgeAdminKey,
        signingAdminKey,
        signingMasterKey,
      },
      ciSecrets: {},
      github: {
        linkedRepo: activeRepo,
        linkedBranch: activeBranch,
        recentRepos,
      },
    });

    return {
      ...payload,
      ciSecrets: buildSecretCiSecrets(payload),
    } as SecretBackupPayloadV1;
  }, [activeRepo, activeBranch, recentRepos]);

  const applySecretBackupPayload = useCallback(
    async (payload: SecretBackupPayloadV1) => {
      const c = payload.connections;
      const ops: Promise<unknown>[] = [];

      ops.push(AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_RAW, c.supabaseRaw));
      ops.push(AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, c.supabaseUrl));
      ops.push(saveSupabaseAnonKey(c.supabaseAnonKey));
      ops.push(AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, c.easProjectId));

      await Promise.all(
        legacyClientServiceRoleStorageKeys().map((key) => AsyncStorage.removeItem(key).catch(() => {})),
      );
      await Promise.all(ops);

      const t = payload.tokens;
      const cs = payload.ciSecrets;
      const githubToken = t.githubToken?.trim() || cs.GITHUB_TOKEN?.trim() || "";
      const expoToken = t.expoToken?.trim() || cs.EXPO_TOKEN?.trim() || "";
      const workflowAdminKey =
        t.workflowAdminKey?.trim() ||
        cs.K1W1_EDGE_WORKFLOW_ADMIN_KEY?.trim() ||
        "";
      const androidKeystoreExportAdminKey =
        t.androidKeystoreExportAdminKey?.trim() ||
        cs.K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY?.trim() ||
        "";
      const legacyEdgeAdminKey =
        t.legacyEdgeAdminKey?.trim() ||
        t.edgeAdminKey?.trim() ||
        cs.K1W1_EDGE_ADMIN_KEY?.trim() ||
        "";
      const signingAdminKey =
        t.signingAdminKey?.trim() ||
        cs.SIGNING_ADMIN_KEY?.trim() ||
        "";
      const signingMaster = t.signingMasterKey?.trim() || cs.SIGNING_MASTER_KEY?.trim() || "";

      if (githubToken) await saveGitHubToken(githubToken);
      else await deleteGitHubToken();

      if (expoToken) await saveExpoToken(expoToken);
      else await deleteExpoToken();

      if (workflowAdminKey) await saveWorkflowAdminKey(workflowAdminKey);
      else await deleteWorkflowAdminKey();

      if (androidKeystoreExportAdminKey) await saveAndroidKeystoreExportAdminKey(androidKeystoreExportAdminKey);
      else await deleteAndroidKeystoreExportAdminKey();

      if (legacyEdgeAdminKey) await saveLegacyEdgeAdminKey(legacyEdgeAdminKey);
      else await deleteLegacyEdgeAdminKey();

      if (signingAdminKey) await saveSigningAdminKey(signingAdminKey);
      else await deleteSigningAdminKey();

      if (signingMaster) await saveSigningMasterKey(signingMaster);
      else await deleteSigningMasterKey();

      await clearRecentRepos();
      for (const repo of [...payload.github.recentRepos].reverse()) {
        try {
          addRecentRepo(repo);
        } catch {
          // ignore duplicates / no-op
        }
      }

      setLinkedRepo(payload.github.linkedRepo, payload.github.linkedBranch);
    },
    [addRecentRepo, clearRecentRepos, setLinkedRepo],
  );

  const handleExportAPIConfig = useCallback(async () => {
    try {
      const result = await exportAPIConfig(config);
      Alert.alert(
        "✅ Export erfolgreich",
        `API-/KI-Konfiguration wurde als Datei "${result.fileName}" gespeichert. Sie enthält keine Projektdateien.`,
      );
    } catch (error: unknown) {
      Alert.alert("Fehler beim Export", getErrorMessage(error, "Export fehlgeschlagen"));
    }
  }, [config]);

  const handleImportAPIConfig = useCallback(async () => {
    Alert.alert(
      "⚠️ API-/KI-Konfiguration importieren",
      "Dies ersetzt nur die gespeicherte AI-/Provider-Konfiguration auf diesem Gerät. Projektdateien und ZIP-Exporte bleiben unberührt. Fortfahren?",
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

              const providers: AllAIProviders[] = ["groq", "gemini", "openai", "anthropic", "huggingface"];
              const totalKeysImported = providers.reduce(
                (sum, provider) => sum + (nextConfig.apiKeys?.[provider]?.length || 0),
                0,
              );

              const exportDate = safeFormatBackupDate(result.exportDate);
              Alert.alert(
                "✅ Import erfolgreich",
                `${totalKeysImported} API-Keys wurden geladen. Projektdateien und ZIP-Inhalte wurden nicht verändert.\n\nBackup-Datum: ${exportDate}`,
              );
            } catch (error: unknown) {
              if (!isAbortLikeError(error)) {
                Alert.alert("Fehler beim Import", getErrorMessage(error, "Import fehlgeschlagen"));
              }
            }
          },
        },
      ],
    );
  }, [config, setConfig]);

  const openSecureBackupFlow = useCallback((request: SecureBackupRequest) => {
    setSecureBackupRequest(request);
  }, []);

  const handleExportSecretsBackup = useCallback(() => {
    openSecureBackupFlow({ mode: "export", scope: "secrets" });
  }, [openSecureBackupFlow]);

  const handleExportConfigSecretsBackup = useCallback(() => {
    openSecureBackupFlow({ mode: "export", scope: "config-secrets" });
  }, [openSecureBackupFlow]);

  const handleImportSecureBackup = useCallback(() => {
    Alert.alert(
      "⚠️ Gesichertes Backup importieren",
      "Dieses Backup stellt nur Secrets/Tokens/Connections und optional die AI-/KI-Konfiguration wieder her. Projektdateien, Chats und ZIP-Inhalte gehören nicht in diesen Pfad. Fortfahren?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Weiter",
          style: "destructive",
          onPress: () => openSecureBackupFlow({ mode: "import" }),
        },
      ],
    );
  }, [openSecureBackupFlow]);

  const closeSecureBackupPrompt = useCallback(() => {
    if (secureBackupBusy) return;
    setSecureBackupRequest(null);
  }, [secureBackupBusy]);

  const handleSubmitSecureBackupPassphrase = useCallback(
    async (passphrase: string) => {
      if (!secureBackupRequest || secureBackupBusy) return;

      setSecureBackupBusy(true);
      try {
        if (secureBackupRequest.mode === "export") {
          const secretPayload = await collectSecretBackupPayload();
          const payload: SecureBackupPayloadV1 =
            secureBackupRequest.scope === "secrets"
              ? secretPayload
              : createConfigAndSecretsBackupPayload({
                  aiConfig: config as AIConfig,
                  secrets: secretPayload,
                });

          const result = await exportEncryptedScopedBackup({
            scope: secureBackupRequest.scope,
            passphrase,
            payload,
          });

          Alert.alert(
            "✅ Export erfolgreich",
            secureBackupRequest.scope === "secrets"
              ? `Secrets-/Token-Backup wurde verschlüsselt als "${result.fileName}" exportiert. Keine Projektdateien oder Chats sind enthalten.`
              : `Gesichertes Konfig-Backup wurde verschlüsselt als "${result.fileName}" exportiert. Enthalten sind nur AI-/KI-Konfiguration plus Secrets/Connections – keine Projektdateien.`,
          );
        } else {
          const result = await importEncryptedScopedBackup(passphrase);
          const imported = result.data;
          const secretPayload = imported.kind === "config-secret-snapshot" ? imported.secrets : imported;

          await applySecretBackupPayload(secretPayload);
          if (imported.kind === "config-secret-snapshot") {
            setConfig(sanitizeAiConfigFromBackup(imported.aiConfig, config));
          }

          const exportDate = safeFormatBackupDate(result.exportDate);
          const scopeText = imported.kind === "config-secret-snapshot"
            ? "AI-/KI-Konfiguration plus Secrets/Connections"
            : "Secrets/Tokens/Connections";
          Alert.alert(
            "✅ Import erfolgreich",
            `Gesichertes Backup wurde importiert. Wiederhergestellt: ${scopeText}.\n\nBackup-Datum: ${exportDate}\n\nProjektdateien, Chats und ZIP-Inhalte wurden nicht berührt.`,
          );
        }

        setSecureBackupRequest(null);
      } catch (error: unknown) {
        if (!isAbortLikeError(error)) {
          Alert.alert("Fehler beim gesicherten Backup", getErrorMessage(error, "Backup fehlgeschlagen"));
        }
      } finally {
        setSecureBackupBusy(false);
      }
    },
    [secureBackupRequest, secureBackupBusy, collectSecretBackupPayload, config, applySecretBackupPayload, setConfig],
  );

  const fileCount = useMemo(() => projectFiles.length, [projectFiles]);
  const messageCount = useMemo(
    () => (Array.isArray(projectData?.chatHistory) ? projectData.chatHistory : projectData?.messages)?.length || 0,
    [projectData?.chatHistory, projectData?.messages],
  );

  const apiKeysCount = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(config.apiKeys).forEach((provider) => {
      counts[provider] = (config.apiKeys[provider as AllAIProviders] || []).length;
    });
    return counts;
  }, [config.apiKeys]);

  const assetsStatus = useMemo(() => {
    if (!projectFiles.length) {
      return { icon: false, adaptiveIcon: false, splash: false, favicon: false };
    }

    const hasAsset = (path: string) =>
      projectFiles.some((file) => file.path === path && file.content.length > 100);

    return {
      icon: hasAsset("assets/icon.png"),
      adaptiveIcon: hasAsset("assets/adaptive-icon.png"),
      splash: hasAsset("assets/splash.png"),
      favicon: hasAsset("assets/favicon.png"),
    };
  }, [projectFiles]);

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
    handleExportSecretsBackup,
    handleExportConfigSecretsBackup,
    handleImportSecureBackup,
    secureBackupRequest,
    secureBackupBusy,
    closeSecureBackupPrompt,
    handleSubmitSecureBackupPassphrase,
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
