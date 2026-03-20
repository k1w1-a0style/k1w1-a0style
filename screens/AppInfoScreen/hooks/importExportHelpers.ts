import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { validateApiBackupJson } from "../../../lib/appInfoBackup";
import {
  decryptScopedBackup,
  encryptScopedBackup,
  validateEncryptedScopedBackupJson,
  type EncryptedScopedBackupV1,
  type SecureBackupPayloadV1,
  type SecureBackupScope,
} from "../../../lib/appInfoScopedBackup";

import { TEMPLATE_INFO } from "../types";

export const exportAPIConfig = async (config: unknown) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fileName = `k1w1-api-backup-${timestamp}.json`;
    const filePath = FileSystem.cacheDirectory + fileName;

    const exportData = {
      version: 1,
      exportDate: new Date().toISOString(),
      appVersion: TEMPLATE_INFO.version,
      config,
    };

    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(exportData, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
    }

    await Sharing.shareAsync(`file://${filePath}`, {
      mimeType: "application/json",
      dialogTitle: "API-/KI-Konfiguration exportieren",
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

    const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

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

function backupFileNameForScope(scope: SecureBackupScope): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return scope === "secrets"
    ? `k1w1-secrets-backup-${timestamp}.json`
    : `k1w1-config-secrets-backup-${timestamp}.json`;
}

function backupDialogTitleForScope(scope: SecureBackupScope): string {
  return scope === "secrets"
    ? "Secrets-/Token-Backup exportieren"
    : "Gesichertes Konfig-Backup exportieren";
}

export const exportEncryptedScopedBackup = async (input: {
  scope: SecureBackupScope;
  passphrase: string;
  payload: SecureBackupPayloadV1;
}) => {
  try {
    const backup = await encryptScopedBackup({
      scope: input.scope,
      passphrase: input.passphrase,
      appVersion: TEMPLATE_INFO.version,
      payload: input.payload,
    });

    const fileName = backupFileNameForScope(input.scope);
    const filePath = FileSystem.cacheDirectory + fileName;

    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(backup, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
    }

    await Sharing.shareAsync(`file://${filePath}`, {
      mimeType: "application/json",
      dialogTitle: backupDialogTitleForScope(input.scope),
      UTI: "public.json",
    });

    return { success: true, fileName, backup };
  } catch (error: any) {
    throw new Error(error?.message || "Export fehlgeschlagen");
  }
};

export const importEncryptedScopedBackup = async (passphrase: string) => {
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

    const encrypted = validateEncryptedScopedBackupJson(JSON.parse(fileContent));
    const data = await decryptScopedBackup({ passphrase, backup: encrypted });

    return {
      success: true,
      data,
      exportDate: encrypted.exportDate,
      scope: encrypted.scope,
      encrypted,
    };
  } catch (error: any) {
    if (error.message.includes("abgebrochen")) {
      throw error;
    }
    throw new Error(error?.message || "Import fehlgeschlagen");
  }
};

export type ImportedEncryptedScopedBackup = {
  success: true;
  data: SecureBackupPayloadV1;
  exportDate: string;
  scope: SecureBackupScope;
  encrypted: EncryptedScopedBackupV1;
};
