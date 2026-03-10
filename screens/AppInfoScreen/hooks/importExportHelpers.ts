// screens/AppInfoScreen/hooks/importExportHelpers.ts
// Extracted from useAppInfoScreen.ts: import/export utility functions.

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


export const exportAPIConfig = async (config: any) => {
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

export const importAPIConfig = async () => {
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

    const importData = validateApiBackupJson(JSON.parse(fileContent));

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

export const exportFullBackup = async (data: FullBackupV1) => {
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

export const importFullBackup = async () => {
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
