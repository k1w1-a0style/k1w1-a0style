import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { createApiBackupExportPayload, validateApiBackupJson } from "../../../lib/appInfoBackup";
import {
  decryptScopedBackup,
  encryptScopedBackup,
  secureBackupNeedsCryptoUpgrade,
  validateEncryptedScopedBackupJson,
  type EncryptedScopedBackupV1,
  type SecureBackupPayloadV1,
  type SecureBackupScope,
} from "../../../lib/appInfoScopedBackup";
import { logger } from "../../../lib/logger";

import { TEMPLATE_INFO } from "../types";
import {
  getImportExportErrorMessage,
  isIgnorableImportExportCleanupError,
  isImportExportAborted,
} from "./importExportErrorHelpers";

async function cleanupTemporaryFile(fileUri: string, context: string): Promise<void> {
  await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch((error: unknown) => {
    if (isIgnorableImportExportCleanupError(error)) {
      return;
    }
    logger.warn(`[importExportHelpers] Temp-Datei konnte nicht entfernt werden (${context})`, {
      fileUri,
      error,
    });
  });
}

export const exportAPIConfig = async (config: unknown) => {
  let filePath: string | null = null;
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fileName = `k1w1-api-backup-${timestamp}.json`;
    filePath = FileSystem.cacheDirectory + fileName;

    const exportData = createApiBackupExportPayload({
      config,
      exportDate: new Date().toISOString(),
      appVersion: TEMPLATE_INFO.version,
    });

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
  } catch (error: unknown) {
    throw new Error(getImportExportErrorMessage(error, "Export fehlgeschlagen"));
  } finally {
    if (filePath) {
      await cleanupTemporaryFile(filePath, "exportAPIConfig");
    }
  }
};

export const importAPIConfig = async () => {
  let importedFileUri: string | null = null;
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/json",
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      throw new Error("Import abgebrochen");
    }

    importedFileUri = result.assets[0].uri;
    const fileContent = await FileSystem.readAsStringAsync(importedFileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const importData = validateApiBackupJson(JSON.parse(fileContent));

    return {
      success: true,
      config: importData.config,
      exportDate: importData.exportDate,
    };
  } catch (error: unknown) {
    if (isImportExportAborted(error)) {
      throw error;
    }
    throw new Error(getImportExportErrorMessage(error, "Import fehlgeschlagen"));
  } finally {
    if (importedFileUri) {
      await cleanupTemporaryFile(importedFileUri, "importAPIConfig");
    }
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
  let filePath: string | null = null;
  try {
    const backup = await encryptScopedBackup({
      scope: input.scope,
      passphrase: input.passphrase,
      appVersion: TEMPLATE_INFO.version,
      payload: input.payload,
    });

    const fileName = backupFileNameForScope(input.scope);
    filePath = FileSystem.cacheDirectory + fileName;

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
  } catch (error: unknown) {
    throw new Error(getImportExportErrorMessage(error, "Export fehlgeschlagen"));
  } finally {
    if (filePath) {
      await cleanupTemporaryFile(filePath, "exportEncryptedScopedBackup");
    }
  }
};

export const importEncryptedScopedBackup = async (passphrase: string) => {
  let importedFileUri: string | null = null;
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/json",
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      throw new Error("Import abgebrochen");
    }

    importedFileUri = result.assets[0].uri;
    const fileContent = await FileSystem.readAsStringAsync(importedFileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const encrypted = validateEncryptedScopedBackupJson(JSON.parse(fileContent));
    const data = await decryptScopedBackup({ passphrase, backup: encrypted });
    const needsCryptoUpgrade = secureBackupNeedsCryptoUpgrade(encrypted);
    const normalizedData = needsCryptoUpgrade
      ? await decryptScopedBackup({
        passphrase,
        backup: await encryptScopedBackup({
          scope: encrypted.scope,
          passphrase,
          appVersion: TEMPLATE_INFO.version,
          payload: data,
        }),
      })
      : data;

    return {
      success: true,
      data: normalizedData,
      exportDate: encrypted.exportDate,
      scope: encrypted.scope,
      encrypted,
      needsCryptoUpgrade,
    };
  } catch (error: unknown) {
    if (isImportExportAborted(error)) {
      throw error;
    }
    throw new Error(getImportExportErrorMessage(error, "Import fehlgeschlagen"));
  } finally {
    if (importedFileUri) {
      await cleanupTemporaryFile(importedFileUri, "importEncryptedScopedBackup");
    }
  }
};

export type ImportedEncryptedScopedBackup = {
  success: true;
  data: SecureBackupPayloadV1;
  exportDate: string;
  scope: SecureBackupScope;
  encrypted: EncryptedScopedBackupV1;
  needsCryptoUpgrade: boolean;
};
