import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";

import { useProject } from "../../../contexts/ProjectContext";
import { useAI, type AIConfig } from "../../../contexts/AIContext";
import {
  sanitizeAiConfigFromBackup,
  safeFormatBackupDate,
} from "../../../lib/appInfoBackup";
import {
  createConfigAndSecretsBackupPayload,
  type SecretBackupPayloadV1,
  type SecureBackupScope,
  type SecureBackupPayloadV1,
} from "../../../lib/appInfoScopedBackup";
import { STORAGE_KEYS, legacyClientServiceRoleStorageKeys } from "../../../lib/storageKeys";
import { getSupabaseAnonKey, saveSupabaseAnonKey } from "../../../lib/supabaseAnonKeyStorage";
import { normalizeStoredSupabaseRaw } from "../../ConnectionsScreen/utils/validation";
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
import { logger } from "../../../lib/logger";
import {
  countMessages,
  getApiKeysCount,
  getAssetsStatusFromProjectFiles,
  getIconPreviewFromProjectFiles,
  getPackageNameFromProjectFiles,
  toProjectFiles,
} from "./useAppInfoScreen.helpers";
import {
  createCollectedSecretBackupPayload,
  readAppliedSecretTokens,
} from "./appInfoSecretFlowHelpers";
import { applyImportedApiConfig } from "./appInfoApiConfigHelpers";
import {
  getSecureBackupExportSuccessMessage,
  getSecureBackupImportScopeText,
} from "./appInfoSecureBackupUiHelpers";

type SecureBackupRequest =
  | { mode: "export"; scope: SecureBackupScope }
  | { mode: "import" };

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

async function removeLegacyClientServiceRoleKeys(): Promise<void> {
  const keys = legacyClientServiceRoleStorageKeys();
  const results = await Promise.allSettled(keys.map((key) => AsyncStorage.removeItem(key)));
  const failedKeys = results
    .map((result, index) => (result.status === "rejected" ? keys[index] : null))
    .filter((entry): entry is string => Boolean(entry));

  if (failedKeys.length > 0) {
    logger.warn("[useAppInfoScreen] Legacy Service-Role-Keys konnten nicht vollstaendig bereinigt werden.", {
      failedKeys,
    });
  }
}

function useAppMetadataState(projectName: string | undefined, projectFiles: ReturnType<typeof toProjectFiles>) {
  const [appName, setAppName] = useState("");
  const [packageName, setPackageNameState] = useState("");
  const [iconPreview, setIconPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!projectFiles.length) return;
    setAppName(projectName || "Meine App");
    setPackageNameState(getPackageNameFromProjectFiles(projectFiles));
  }, [projectName, projectFiles]);

  useEffect(() => {
    if (!projectFiles.length) {
      setIconPreview(null);
      return;
    }
    setIconPreview(getIconPreviewFromProjectFiles(projectFiles));
  }, [projectFiles]);

  return { appName, setAppName, packageName, setPackageNameState, iconPreview, setIconPreview };
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
  const {
    appName,
    setAppName,
    packageName,
    setPackageNameState,
    iconPreview,
    setIconPreview,
  } = useAppMetadataState(projectData?.name, projectFiles);
  const [secureBackupRequest, setSecureBackupRequest] = useState<SecureBackupRequest | null>(null);
  const [secureBackupBusy, setSecureBackupBusy] = useState(false);

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
      signingAdminKey,
      signingMasterKey,
    ] = await Promise.all([
      getGitHubToken().catch(() => null),
      getExpoToken().catch(() => null),
      getWorkflowAdminKey().catch(() => null),
      getAndroidKeystoreExportAdminKey().catch(() => null),
      getSigningAdminKey().catch(() => null),
      getSigningMasterKey().catch(() => null),
    ]);

    await removeLegacyClientServiceRoleKeys();

    const [supabaseRaw, supabaseUrl, supabaseAnonKey, easProjectId] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_RAW).catch(() => ""),
      AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL).catch(() => ""),
      getSupabaseAnonKey().catch(() => ""),
      AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID).catch(() => ""),
    ]);

    const normalizedSupabaseRaw = normalizeStoredSupabaseRaw(supabaseRaw ?? "", supabaseUrl ?? "");

    return createCollectedSecretBackupPayload({
      connections: {
        supabaseRaw: normalizedSupabaseRaw,
        supabaseUrl: supabaseUrl ?? "",
        supabaseAnonKey: supabaseAnonKey ?? "",
        easProjectId: easProjectId ?? "",
      },
      tokens: {
        githubToken,
        expoToken,
        workflowAdminKey,
        androidKeystoreExportAdminKey,
        signingAdminKey,
        signingMasterKey,
      },
      github: {
        linkedRepo: activeRepo,
        linkedBranch: activeBranch,
        recentRepos,
      },
    });
  }, [activeRepo, activeBranch, recentRepos]);

  const applySecretBackupPayload = useCallback(
    async (payload: SecretBackupPayloadV1) => {
      const c = payload.connections;
      const ops: Promise<unknown>[] = [];

      const normalizedSupabaseRaw = normalizeStoredSupabaseRaw(c.supabaseRaw, c.supabaseUrl);
      ops.push(AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_RAW, normalizedSupabaseRaw));
      ops.push(AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, c.supabaseUrl));
      ops.push(saveSupabaseAnonKey(c.supabaseAnonKey));
      ops.push(AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, c.easProjectId));

      await removeLegacyClientServiceRoleKeys();
      await Promise.all(ops);

      const {
        githubToken,
        expoToken,
        workflowAdminKey,
        androidKeystoreExportAdminKey,
        signingAdminKey,
        signingMaster,
      } = readAppliedSecretTokens(payload);

      if (githubToken) await saveGitHubToken(githubToken);
      else await deleteGitHubToken();

      if (expoToken) await saveExpoToken(expoToken);
      else await deleteExpoToken();

      if (workflowAdminKey) await saveWorkflowAdminKey(workflowAdminKey);
      else await deleteWorkflowAdminKey();

      if (androidKeystoreExportAdminKey) await saveAndroidKeystoreExportAdminKey(androidKeystoreExportAdminKey);
      else await deleteAndroidKeystoreExportAdminKey();

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
              const { nextConfig, totalKeysImported } = applyImportedApiConfig(result.config, config);
              setConfig(nextConfig);

              const exportDate = safeFormatBackupDate(result.exportDate);
              Alert.alert(
                "✅ Import erfolgreich",
                `AI-/Provider-Konfiguration wurde geladen. API-Keys bleiben aus Sicherheitsgründen unverändert (${totalKeysImported} vorhandene Keys auf diesem Gerät). Projektdateien und ZIP-Inhalte wurden nicht verändert.\n\nBackup-Datum: ${exportDate}`,
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
            getSecureBackupExportSuccessMessage({
              scope: secureBackupRequest.scope,
              fileName: result.fileName,
            }),
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
          const scopeText = getSecureBackupImportScopeText(imported);
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
  const messageCount = useMemo(() => countMessages(projectData), [projectData]);
  const apiKeysCount = useMemo(() => getApiKeysCount(config.apiKeys), [config.apiKeys]);
  const assetsStatus = useMemo(() => getAssetsStatusFromProjectFiles(projectFiles), [projectFiles]);

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
