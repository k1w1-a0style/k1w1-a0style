import { useCallback } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { AllAIProviders, AIConfig } from "../../../contexts/AIContext";
import { PROVIDERS } from "../constants";
import { exportAPIConfig, importAPIConfig } from "../utils/apiBackup";

type Deps = {
  appName: string;
  packageName: string;
  setIconPreview: (next: string | null) => void;

  setProjectName: (name: string) => void | Promise<void>;
  setPackageName: (name: string) => void | Promise<void>;
  updateProjectFiles: (
    files: Array<{ path: string; content: string }>,
    newName?: string,
  ) => void | Promise<void>;

  config: AIConfig;
  addApiKey: (provider: AllAIProviders, key: string) => void | Promise<void>;
};

export const useAppInfoHandlers = ({
  appName,
  packageName,
  setIconPreview,
  setProjectName,
  setPackageName,
  updateProjectFiles,
  config,
  addApiKey,
}: Deps) => {
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

      if (pickerResult.canceled) return;

      const asset = pickerResult.assets?.[0];
      if (!asset || !asset.base64) {
        Alert.alert("Fehler", "Konnte das Bild nicht als Base64 laden.");
        return;
      }

      const base64Content = asset.base64;

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

  const handleImportAPIConfig = useCallback(() => {
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

              const importedConfig = result.config;
              let totalKeysImported = 0;

              for (const provider of PROVIDERS) {
                const keys = importedConfig.apiKeys?.[provider] || [];
                for (const key of keys) {
                  try {
                    await addApiKey(provider, key);
                    totalKeysImported++;
                  } catch {
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

  const handleIconPreviewError = useCallback(() => {
    setIconPreview(null);
  }, [setIconPreview]);

  return {
    handleSaveAppName,
    handleSavePackageName,
    handleChooseIcon,
    handleExportAPIConfig,
    handleImportAPIConfig,
    handleIconPreviewError,
  };
};
