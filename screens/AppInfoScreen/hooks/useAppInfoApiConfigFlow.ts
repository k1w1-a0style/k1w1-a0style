import { useCallback } from "react";
import { Alert } from "react-native";

import { type AIConfig } from "../../../contexts/AIContext/models";
import { safeFormatBackupDate } from "../../../lib/appInfoBackup";
import { logger } from "../../../lib/logger";
import { applyImportedApiConfig } from "./appInfoApiConfigHelpers";
import { getImportExportErrorMessage, isImportExportAborted } from "./importExportErrorHelpers";
import { exportAPIConfig, importAPIConfig } from "./importExportHelpers";

function getErrorMessage(error: unknown, fallback: string): string {
  return getImportExportErrorMessage(error, fallback);
}

function isAbortLikeError(error: unknown): boolean {
  return isImportExportAborted(error);
}

export function useAppInfoApiConfigFlow(params: {
  config: AIConfig;
  setConfig: (next: AIConfig) => void;
}) {
  const { config, setConfig } = params;

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

  return {
    handleExportAPIConfig,
    handleImportAPIConfig,
  };
}
