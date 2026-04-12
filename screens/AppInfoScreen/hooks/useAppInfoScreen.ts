import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import * as ImagePicker from "expo-image-picker";

import { useProject } from "../../../contexts/ProjectContext";
import { useAI } from "../../../contexts/AIContext";
import { useGitHub } from "../../../contexts/GitHubContext";

import { countMessages, getApiKeysCount, getAssetsStatusFromProjectFiles, getIconPreviewFromProjectFiles, getPackageNameFromProjectFiles, toProjectBinaryBase64, toProjectFiles } from "./useAppInfoScreen.helpers";
import { useAppInfoApiConfigFlow } from "./useAppInfoApiConfigFlow";
import { useAppInfoSecureBackupFlow } from "./useAppInfoSecureBackupFlow";
import { getImportExportErrorMessage } from "./importExportErrorHelpers";

function getErrorMessage(error: unknown, fallback: string): string {
  return getImportExportErrorMessage(error, fallback);
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
  const { activeRepo, activeBranch, recentRepos, addRecentRepo, clearRecentRepos } = useGitHub();

  const { appName, setAppName, packageName, setPackageNameState, iconPreview, setIconPreview } = useAppMetadataState(projectData?.name, projectFiles);

  const { handleExportAPIConfig, handleImportAPIConfig } = useAppInfoApiConfigFlow({ config, setConfig });
  const {
    secureBackupRequest,
    secureBackupBusy,
    closeSecureBackupPrompt,
    handleSubmitSecureBackupPassphrase,
    handleExportSecretsBackup,
    handleExportConfigSecretsBackup,
    handleImportSecureBackup,
  } = useAppInfoSecureBackupFlow({
    config,
    setConfig,
    github: {
      activeRepo,
      activeBranch,
      recentRepos,
      addRecentRepo,
      clearRecentRepos,
      setLinkedRepo,
    },
  });

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
    const binaryContent = toProjectBinaryBase64(base64Content);
    await updateProjectFiles([
      { path: "assets/icon.png", content: binaryContent },
      { path: "assets/adaptive-icon.png", content: binaryContent },
      { path: "assets/splash.png", content: binaryContent },
      { path: "assets/favicon.png", content: binaryContent },
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

      if (pickerResult.canceled) return;

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
