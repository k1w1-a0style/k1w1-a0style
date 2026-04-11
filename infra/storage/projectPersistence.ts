// infra/storage/projectPersistence.ts
// REFACTORED: helpers → persistenceHelpers.ts

// infra/storage/projectPersistence.ts (moved from contexts/projectStorage.ts)
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProjectData, ProjectFile } from "../../shared/types/project";
import type { ChatMessage } from "../../shared/types/chat";
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { v4 as uuidv4 } from 'uuid';
import { materializeProjectFiles } from "../../lib/projectMaterializer";
import { loadChatHistorySettings } from "../../lib/chatPrivacySettings";

// ✅ Phase 1 Step 3: normalizePath aus lib/validators statt utils/chatValidation
import { normalizePath, Validators, validateZipImport } from '../../lib/validators';

import { zip, unzip } from 'react-native-zip-archive';
import { logger } from "../../lib/logger";
import { inspectZipArchiveFromUri } from "./zipInspection";
import {
  deserializeProjectStoragePayload,
  encryptProjectStoragePayload,
  looksLikeEncryptedProjectStoragePayload,
} from "./projectStorageCrypto";

import {
  PROJECT_STORAGE_KEY, CACHE_DIR, BINARY_EXTENSIONS,
  isBinaryFilePath, stripBase64Prefix, trimChatHistory,
  ensureChatHistoryHasIds,
  readDirectoryRecursive,
  assertProjectStoragePayloadSafe,
} from "./persistenceHelpers";

export const saveProjectToStorage = async (project: ProjectData): Promise<void> => {
  try {
    const { persist: persistChat, retention } = await loadChatHistorySettings();

    const projectToSave: ProjectData = {
      ...project,
      chatHistory: persistChat ? trimChatHistory(project.chatHistory ?? [], retention) : [],
    };
    const projectString = JSON.stringify(projectToSave);
    const plaintextPayloadState = assertProjectStoragePayloadSafe(projectString);

    const encryptedProjectString = await encryptProjectStoragePayload(projectString);
    const persistedPayloadState = assertProjectStoragePayloadSafe(encryptedProjectString);
    await AsyncStorage.setItem(PROJECT_STORAGE_KEY, encryptedProjectString);

    if (plaintextPayloadState.nearLimit || persistedPayloadState.nearLimit) {
      logger.warn("[projectStorage] Projektzustand nahe Storage-Limit gespeichert", {
        projectName: project.name,
        plaintextBytes: plaintextPayloadState.bytes,
        persistedBytes: persistedPayloadState.bytes,
      });
    } else {
      logger.info('💾 Projekt gespeichert:', project.name);
    }
  } catch (error) {
    logger.error("[projectStorage] Fehler beim Speichern", { err: error });
    throw new Error('Projekt konnte nicht gespeichert werden');
  }
};

export const loadProjectFromStorage = async (): Promise<ProjectData | null> => {
  let rawStoragePayload: string | null = null;
  try {
    rawStoragePayload = await AsyncStorage.getItem(PROJECT_STORAGE_KEY);
    if (!rawStoragePayload) {
      logger.info('📂 Kein gespeichertes Projekt gefunden');
      return null;
    }

    const { projectString: persistedProjectString, migratedFromPlaintext } =
      await deserializeProjectStoragePayload(rawStoragePayload);
    const project = JSON.parse(persistedProjectString);
    logger.info('📖 Projekt geladen:', project.name);

    if (!project.files) {
      project.files = [];
      logger.info('🔧 files Array repariert');
    }

    if (!project.chatHistory) {
      // Repariere alte Speicherstände
      // Migration: Alte 'messages' Property zu 'chatHistory'
      const projectWithMessages = project as ProjectData & { messages?: ChatMessage[] };
      project.chatHistory = projectWithMessages.messages || [];
      logger.info('🔧 chatHistory Array repariert');
    }



    // Migration/Repair: older chat entries may miss id/timestamp
    project.chatHistory = ensureChatHistoryHasIds(project.chatHistory);

    try {
      const { persist: persistChat, retention } = await loadChatHistorySettings();
      project.chatHistory = persistChat
        ? trimChatHistory(project.chatHistory ?? [], retention)
        : [];
    } catch {
      // best-effort
    }

    if (migratedFromPlaintext) {
      await saveProjectToStorage(project);
    }
    return project;
  } catch (error) {
    logger.error("[projectStorage] Fehler beim Laden", { err: error });
    if (rawStoragePayload && looksLikeEncryptedProjectStoragePayload(rawStoragePayload)) {
      throw new Error(
        "Verschluesseltes Projekt konnte nicht entschluesselt werden (Key/Decrypt-Fehler). Bitte Daten wiederherstellen statt automatisch zu ueberschreiben.",
      );
    }
    if (rawStoragePayload) {
      throw new Error(
        "Gespeicherter unverschluesselter Projektstand ist beschaedigt oder unlesbar. Bitte Daten wiederherstellen statt automatisch zu ueberschreiben.",
      );
    }
    return null;
  }
};

export const clearProjectFromStorage = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PROJECT_STORAGE_KEY);
    logger.info('🗑️ Projekt aus Storage gelöscht');
  } catch (error) {
    logger.error("[projectStorage] Fehler beim Löschen", { err: error });
    throw new Error('Projekt konnte nicht gelöscht werden');
  }
};

// === ECHTE ZIP-FUNKTIONEN ===
export const exportProjectAsZipFile = async (
  project: ProjectData,
): Promise<{
  projectName: string;
  fileCount: number;
  messageCount: number;
}> => {
  logger.info('🎯 Export-Anfrage für:', project.name);
  const projectFiles = materializeProjectFiles(project.files, { name: project.name, slug: project.slug ?? project.name, packageName: project.packageName });
  const projectName = project.name.replace(/[\s\/]+/g, '_') || 'projekt';
  const tempDir = CACHE_DIR + 'projekt-export/';
  const zipPath = FileSystem.cacheDirectory + `${projectName}.zip`;

  try {
    await FileSystem.deleteAsync(tempDir, { idempotent: true });
    await FileSystem.deleteAsync(zipPath, { idempotent: true });
    await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

    for (const file of projectFiles) {
      const contentString =
        typeof file.content === 'string' ? file.content : JSON.stringify(file.content, null, 2);

      const filePath = `${tempDir}${file.path}`;
      const dirName = filePath.substring(0, filePath.lastIndexOf('/'));

      if (dirName && dirName !== tempDir.slice(0, -1)) {
        await FileSystem.makeDirectoryAsync(dirName, { intermediates: true });
      }

      const normalized = normalizePath(file.path);
      const isBinary = isBinaryFilePath(normalized);
      const hasBase64 = typeof contentString === "string" && contentString.startsWith("base64:");

      if (isBinary && hasBase64) {
        await FileSystem.writeAsStringAsync(filePath, stripBase64Prefix(contentString), {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        await FileSystem.writeAsStringAsync(filePath, contentString, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

}

    const resultPath = await zip(tempDir, zipPath);
    const shareableUri = resultPath.startsWith('file://') ? resultPath : `file://${resultPath}`;

    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
    }

    await Sharing.shareAsync(shareableUri, {
      mimeType: 'application/zip',
      dialogTitle: `Projekt '${project.name}' exportieren`,
      UTI: 'com.pkware.zip-archive',
    });

    return {
      projectName: project.name || 'Unbenannt',
      fileCount: (project.files || []).length,
      messageCount: (project.chatHistory || []).length,
    };
  } catch (error: unknown) {
    logger.error("[projectStorage] Fehler beim ZIP-Export", { err: error });
    const errorMessage = error instanceof Error ? error.message : 'ZIP-Export fehlgeschlagen';
    throw new Error(errorMessage);
  } finally {
    await FileSystem.deleteAsync(tempDir, { idempotent: true }).catch((cleanupError: unknown) => {
      logger.warn("[projectStorage] Temp-Dir cleanup failed", { err: cleanupError });
    });
    await FileSystem.deleteAsync(zipPath, { idempotent: true }).catch((cleanupError: unknown) => {
      logger.warn("[projectStorage] Temp-ZIP cleanup failed", { err: cleanupError });
    });
  }
};

export const importProjectFromZipFile = async (): Promise<{
  project: ProjectData;
  fileCount: number;
  messageCount: number;
  metadata?: Record<string, unknown>;
}> => {
  const MAX_ZIP_ARCHIVE_BYTES = 25 * 1024 * 1024;
  const MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;

  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/zip',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      throw new Error('Import abgebrochen');
    }

    const zipAsset = result.assets[0];

    const zipInfo = await FileSystem.getInfoAsync(zipAsset.uri);
    const zipSizeBytes =
      typeof zipAsset.size === 'number' && zipAsset.size > 0
        ? zipAsset.size
        : (zipInfo as { size?: number }).size ?? 0;

    if (!Number.isFinite(zipSizeBytes) || zipSizeBytes <= 0) {
      throw new Error('ZIP-Datei ist leer oder Größe nicht lesbar');
    }

    if (zipSizeBytes > MAX_ZIP_ARCHIVE_BYTES) {
      throw new Error(
        `ZIP-Datei ist zu groß für den Import vor dem Entpacken (${(zipSizeBytes / (1024 * 1024)).toFixed(2)}MB > ${(MAX_ZIP_ARCHIVE_BYTES / (1024 * 1024)).toFixed(2)}MB)`,
      );
    }

    const archiveInspection = await inspectZipArchiveFromUri(zipAsset.uri, {
      maxEntries: Validators.constants.MAX_FILES_IN_ZIP,
      maxFileBytes: Validators.constants.MAX_FILE_SIZE_BYTES,
      maxTotalUncompressedBytes: MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES,
    });

    if (!archiveInspection.valid) {
      const issuePreview = archiveInspection.issues
        .slice(0, 5)
        .map((issue) => `${issue.path}: ${issue.reason}`);
      throw new Error(
        [
          'ZIP-Metadatenprüfung vor dem Entpacken fehlgeschlagen:',
          ...archiveInspection.errors,
          ...(issuePreview.length > 0 ? ['Beispiele:', ...issuePreview] : []),
        ].join('\n'),
      );
    }

    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });

    logger.info('📦 Entpacke...');
    await unzip(zipAsset.uri, CACHE_DIR);

    const newFiles = await readDirectoryRecursive(CACHE_DIR);
    if (newFiles.length === 0) throw new Error('ZIP enthält keine Dateien');

    // ✅ SICHERHEIT: Zusätzliche ZIP-Validierung
    logger.info('🔍 Validiere ZIP-Inhalte...');
    const zipValidation = validateZipImport(newFiles);

    if (!zipValidation.valid) {
      const invalidPreview = zipValidation.invalidFiles
        .slice(0, 5)
        .map((f: { path: string; reason: string }) => `${f.path}: ${f.reason}`);
      const errorMsg = [
        'ZIP-Validierung fehlgeschlagen (strikter Import, keine Teilübernahme):',
        ...zipValidation.errors,
        `Ungültige Dateien: ${zipValidation.invalidFiles.length}`,
        ...(invalidPreview.length > 0 ? ['Beispiele:', ...invalidPreview] : []),
      ].join('\n');

      logger.error("[projectStorage] ZIP import rejected by validator", {
        errors: zipValidation.errors,
        invalidFilesCount: zipValidation.invalidFiles.length,
      });
      throw new Error(errorMsg);
    }

    const validatedFiles = zipValidation.validFiles;
    const newName = zipAsset.name.replace(/\.zip$/i, '') || 'Importiertes Projekt';

    const newProject: ProjectData = {
      id: uuidv4(),
      name: newName,
      files: validatedFiles,
      chatHistory: [],
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    logger.info(`✅ ZIP-Import erfolgreich: ${validatedFiles.length} Dateien validiert (strict all-or-nothing)`);

    return {
      project: newProject,
      fileCount: validatedFiles.length,
      messageCount: 0,
    };
  } catch (error: unknown) {
    logger.error("[projectStorage] Fehler beim ZIP-Import", { err: error });

    if (error instanceof Error) {
      if (error.message.includes('Import abgebrochen')) {
        throw error;
      }
      throw new Error(error.message || 'ZIP-Import fehlgeschlagen');
    }

    throw new Error('ZIP-Import fehlgeschlagen');
  } finally {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true }).catch((cleanupError: unknown) => {
      logger.warn("[projectStorage] Konnte temporäres ZIP-Verzeichnis nicht bereinigen", {
        cacheDir: CACHE_DIR,
        err: cleanupError,
      });
    });
  }
};
