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

// ✅ Phase 1 Step 3: normalizePath aus lib/validators statt utils/chatUtils
import { normalizePath, Validators, validateFilePath, validateFileContent, validateZipImport } from '../../lib/validators';

import { zip, unzip } from 'react-native-zip-archive';
import { logger } from "../../lib/logger";


import {
  PROJECT_STORAGE_KEY, CACHE_DIR, BINARY_EXTENSIONS,
  isBinaryFilePath, stripBase64Prefix, trimChatHistory,
  ensureChatHistoryHasIds, readDirectoryRecursive,
} from "./persistenceHelpers";

export const saveProjectToStorage = async (project: ProjectData): Promise<void> => {
  try {
    const { persist: persistChat, retention } = await loadChatHistorySettings();

    const projectToSave: ProjectData = {
      ...project,
      chatHistory: persistChat ? trimChatHistory(project.chatHistory ?? [], retention) : [],
    };
    const projectString = JSON.stringify(projectToSave);
    await AsyncStorage.setItem(PROJECT_STORAGE_KEY, projectString);
    logger.info('💾 Projekt gespeichert:', project.name);
  } catch (error) {
    logger.error("[projectStorage] Fehler beim Speichern", { err: error });
    throw new Error('Projekt konnte nicht gespeichert werden');
  }
};

export const loadProjectFromStorage = async (): Promise<ProjectData | null> => {
  try {
    const projectString = await AsyncStorage.getItem(PROJECT_STORAGE_KEY);
    if (!projectString) {
      logger.info('📂 Kein gespeichertes Projekt gefunden');
      return null;
    }

    const project = JSON.parse(projectString);
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
    return project;
  } catch (error) {
    logger.error("[projectStorage] Fehler beim Laden", { err: error });
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

  try {
    const tempDir = CACHE_DIR + 'projekt-export/';
    const zipPath = FileSystem.cacheDirectory + `${projectName}.zip`;

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

    await FileSystem.deleteAsync(tempDir, { idempotent: true });

    return {
      projectName: project.name || 'Unbenannt',
      fileCount: (project.files || []).length,
      messageCount: (project.chatHistory || []).length,
    };
  } catch (error: unknown) {
    logger.error("[projectStorage] Fehler beim ZIP-Export", { err: error });
    const errorMessage = error instanceof Error ? error.message : 'ZIP-Export fehlgeschlagen';
    throw new Error(errorMessage);
  }
};

export const importProjectFromZipFile = async (): Promise<{
  project: ProjectData;
  fileCount: number;
  messageCount: number;
  metadata?: Record<string, unknown>;
}> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/zip',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      throw new Error('Import abgebrochen');
    }

    const zipAsset = result.assets[0];
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
      const errorMsg = [
        'ZIP-Validierung fehlgeschlagen:',
        ...zipValidation.errors,
        `Ungültige Dateien: ${zipValidation.invalidFiles.length}`,
      ].join('\n');

      logger.error("[projectStorage] Invalid ZIP content", { errorMsg });
      throw new Error(errorMsg);
    }

    if (zipValidation.invalidFiles.length > 0) {
      logger.warn(
        `[projectStorage] ${zipValidation.invalidFiles.length} ungültige Dateien übersprungen:`,
        zipValidation.invalidFiles.map((f: { path: string; reason: string }) => `${f.path}: ${f.reason}`),
      );
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

    logger.info(`✅ ZIP-Import erfolgreich: ${validatedFiles.length} Dateien validiert`);

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
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true }).catch(() => {});
  }
};
