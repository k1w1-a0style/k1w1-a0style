import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { AIConfig } from "../../../contexts/AIContext";
import { TEMPLATE_INFO } from "../constants";

type ExportResult = { success: true; fileName: string };
type ImportResult = { success: true; config: AIConfig; exportDate?: string };

const ensureFileUri = (path: string) =>
  path.startsWith("file://") ? path : `file://${path}`;

export const exportAPIConfig = async (
  config: AIConfig,
): Promise<ExportResult> => {
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
      {
        encoding: FileSystem.EncodingType.UTF8,
      },
    );

    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
    }

    await Sharing.shareAsync(ensureFileUri(filePath), {
      mimeType: "application/json",
      dialogTitle: "API-Konfiguration exportieren",
      UTI: "public.json",
    });

    return { success: true, fileName };
  } catch (error: any) {
    throw new Error(error?.message || "Export fehlgeschlagen");
  }
};

export const importAPIConfig = async (): Promise<ImportResult> => {
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
    if (error?.message?.includes("abgebrochen")) {
      throw error;
    }
    throw new Error(error?.message || "Import fehlgeschlagen");
  }
};
