import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";

import { useProject } from "../../../contexts/ProjectContext";
import { useAI } from "../../../contexts/AIContext";
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
import {
  getImportExportErrorMessage,
  isImportExportAborted,
} from "./importExportErrorHelpers";
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
  hydrateGitHubSelectionFromBackup,
  persistAppliedSecretTokens,
  readAppliedSecretTokens,
} from "./appInfoSecretFlowHelpers";
import { applyImportedApiConfig } from "./appInfoApiConfigHelpers";
import {
  getSecureBackupExportSuccessMessage,
  getSecureBackupImportScopeText,
} from "./appInfoSecureBackupUiHelpers";
import { resetDerivedStatusAfterSecretImport } from "./secretImportStatusReset";
import { resolveEasProjectIdImportDecision } from "./easProjectIdImportHelpers";

type SecureBackupRequest =
  | { mode: "export"; scope: SecureBackupScope }
  | { mode: "import" };

function getErrorMessage(error: unknown, fallback: string): string {
  return getImportExportErrorMessage(error, fallback);
}

function isAbortLikeError(error: unknown): boolean {
  return isImportExportAborted(error);
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

  const runApplyIconToAssets = useCallback(async (base64Content: string) => {
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
  }, [updateProjectFiles]);

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

      await runApplyIconToAssets(asset.base64);
    } catch (error: unknown) {
      Alert.alert("Fehler", getErrorMessage(error, "Assets konnten nicht aktualisiert werden."));
    }
  }, [runApplyIconToAssets]);

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

  const persistImportedConnectionSecrets = useCallback(async (payload: SecretBackupPayloadV1) => {
    const c = payload.connections;
    const normalizedSupabaseRaw = normalizeStoredSupabaseRaw(c.supabaseRaw, c.supabaseUrl);
    const easProjectIdDecision = resolveEasProjectIdImportDecision(c.easProjectId);

    await removeLegacyClientServiceRoleKeys();
    const writes: Promise<unknown>[] = [
      AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_RAW, normalizedSupabaseRaw),
      AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, c.supabaseUrl),
      saveSupabaseAnonKey(c.supabaseAnonKey),
    ];
    if (easProjectIdDecision.mode === "set") {
      writes.push(AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, easProjectIdDecision.value));
    } else if (easProjectIdDecision.mode === "clear") {
      writes.push(AsyncStorage.removeItem(STORAGE_KEYS.EAS_PROJECT_ID));
    } else {
      logger.warn("[useAppInfoScreen] Ignoriere ungueltige EAS Project ID aus Secret-Import.", {
        easProjectIdPreview: easProjectIdDecision.value.slice(0, 8),
      });
    }
    await Promise.all(writes);
  }, []);

  const persistImportedTokenSecrets = useCallback(async (payload: SecretBackupPayloadV1) => {
    const tokens = readAppliedSecretTokens(payload);
    await persistAppliedSecretTokens(tokens, {
      saveGitHubToken,
      deleteGitHubToken,
      saveExpoToken,
      deleteExpoToken,
      saveWorkflowAdminKey,
      deleteWorkflowAdminKey,
      saveAndroidKeystoreExportAdminKey,
      deleteAndroidKeystoreExportAdminKey,
      saveSigningAdminKey,
      deleteSigningAdminKey,
      saveSigningMasterKey,
      deleteSigningMasterKey,
    });
  }, []);

  const hydrateImportedGitHubSelection = useCallback(async (payload: SecretBackupPayloadV1) => {
    await hydrateGitHubSelectionFromBackup(payload.github, {
      clearRecentRepos,
      addRecentRepo,
      setLinkedRepo,
    });
  }, [addRecentRepo, clearRecentRepos, setLinkedRepo]);

  const applySecretBackupPayloadCore = useCallback(
    async (payload: SecretBackupPayloadV1) => {
      await persistImportedConnectionSecrets(payload);
      await persistImportedTokenSecrets(payload);
      await hydrateImportedGitHubSelection(payload);
    },
    [hydrateImportedGitHubSelection, persistImportedConnectionSecrets, persistImportedTokenSecrets],
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

  const runApiConfigImport = useCallback(async () => {
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
      if (isAbortLikeError(error)) {
        logger.info("[useAppInfoScreen] API-Config-Import wurde abgebrochen.");
        return;
      }
      Alert.alert("Fehler beim Import", getErrorMessage(error, "Import fehlgeschlagen"));
    }
  }, [config, setConfig]);

  const handleImportAPIConfig = useCallback(async () => {
    Alert.alert(
      "⚠️ API-/KI-Konfiguration importieren",
      "Dies ersetzt nur die gespeicherte AI-/Provider-Konfiguration auf diesem Gerät. Projektdateien und ZIP-Exporte bleiben unberührt. Fortfahren?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Importieren",
          style: "destructive",
          onPress: () => {
            void runApiConfigImport();
          },
        },
      ],
    );
  }, [runApiConfigImport]);

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

  const runSecureBackupExport = useCallback(
    async (passphrase: string, scope: SecureBackupScope) => {
      const secretPayload = await collectSecretBackupPayload();
      const payload: SecureBackupPayloadV1 =
        scope === "secrets"
          ? secretPayload
          : createConfigAndSecretsBackupPayload({
              aiConfig: config,
              secrets: secretPayload,
            });

      const result = await exportEncryptedScopedBackup({
        scope,
        passphrase,
        payload,
      });

      Alert.alert(
        "✅ Export erfolgreich",
        getSecureBackupExportSuccessMessage({
          scope,
          fileName: result.fileName,
        }),
      );
    },
    [collectSecretBackupPayload, config],
  );

  const runSecureBackupImport = useCallback(
    async (passphrase: string) => {
      const result = await importEncryptedScopedBackup(passphrase);
      const imported = result.data;
      const secretPayload = imported.kind === "config-secret-snapshot" ? imported.secrets : imported;
      const rollbackSecrets = await collectSecretBackupPayload();
      try {
        await applySecretBackupPayloadCore(secretPayload);
        await resetDerivedStatusAfterSecretImport();
      } catch (error) {
        logger.error("[useAppInfoScreen] Secret-Import fehlgeschlagen, starte best-effort Rollback.", { error });
        await applySecretBackupPayloadCore(rollbackSecrets).catch((rollbackError) => {
          logger.error("[useAppInfoScreen] Secret-Import Rollback fehlgeschlagen.", { rollbackError });
        });
        throw error;
      }
      if (imported.kind === "config-secret-snapshot") {
        setConfig(sanitizeAiConfigFromBackup(imported.aiConfig, config));
      }

      const exportDate = safeFormatBackupDate(result.exportDate);
      const scopeText = getSecureBackupImportScopeText(imported);
      Alert.alert(
        "✅ Import erfolgreich",
        `Gesichertes Backup wurde importiert. Wiederhergestellt: ${scopeText}.\n\nBackup-Datum: ${exportDate}\n\nProjektdateien, Chats und ZIP-Inhalte wurden nicht berührt.`,
      );
    },
    [applySecretBackupPayloadCore, collectSecretBackupPayload, setConfig, config],
  );

  const handleSubmitSecureBackupPassphrase = useCallback(
    async (passphrase: string) => {
      if (!secureBackupRequest || secureBackupBusy) return;

      setSecureBackupBusy(true);
      try {
        if (secureBackupRequest.mode === "export") {
          await runSecureBackupExport(passphrase, secureBackupRequest.scope);
        } else {
          await runSecureBackupImport(passphrase);
        }

        setSecureBackupRequest(null);
      } catch (error: unknown) {
        if (isAbortLikeError(error)) {
          logger.info("[useAppInfoScreen] Secure-Backup-Flow wurde abgebrochen.");
        } else {
          Alert.alert("Fehler beim gesicherten Backup", getErrorMessage(error, "Backup fehlgeschlagen"));
        }
      } finally {
        setSecureBackupBusy(false);
      }
    },
    [secureBackupRequest, secureBackupBusy, runSecureBackupExport, runSecureBackupImport],
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
