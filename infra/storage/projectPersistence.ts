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

const PROJECT_STORAGE_KEY = 'k1w1_project_data';
const CACHE_DIR = FileSystem.cacheDirectory + 'zip_temp/';
// === Binary file handling (assets etc.) ===
const BINARY_EXTENSIONS = new Set([
  "png","jpg","jpeg","webp","gif","bmp","ico",
  "mp3","wav","m4a","mp4","mov","mkv",
  "zip","jar","keystore","jks","cer","der","p12",
  "ttf","otf","woff","woff2",
]);

function isBinaryFilePath(p: string): boolean {
  const n = normalizePath(p).toLowerCase();
  const ext = n.includes(".") ? n.split(".").pop()! : "";
  return BINARY_EXTENSIONS.has(ext);
}

function stripBase64Prefix(s: string): string {
  return s.startsWith("base64:") ? s.slice("base64:".length) : s;
}

function trimChatHistory<T extends { timestamp?: string }>(
  history: T[],
  limit: number,
): T[] {
  if (!Array.isArray(history)) return [];
  const max = Number.isFinite(limit) && limit >= 0 ? Math.floor(limit) : 0;
  if (max === 0) return [];
  if (history.length <= max) return history;

  // Keep the newest entries (timestamp best-effort)
  const copy = [...history];
  copy.sort((a, b) => {
    const ta = Date.parse(String(a?.timestamp ?? "")) || 0;
    const tb = Date.parse(String(b?.timestamp ?? "")) || 0;
    return ta - tb;
  });

  return copy.slice(-max);
}




function ensureChatHistoryHasIds(history: any[]): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && typeof m === "object")
    .map((m) => {
      const role =
        m.role === "user" || m.role === "assistant" || m.role === "system"
          ? m.role
          : "assistant";
      const content =
        typeof m.content === "string"
          ? m.content
          : m.content != null
            ? String(m.content)
            : "";
      const timestamp =
        typeof m.timestamp === "string" && m.timestamp
          ? m.timestamp
          : new Date().toISOString();
      const id =
        typeof m.id === "string" && m.id
          ? m.id
          : uuidv4(); // Migration for old chat entries
      const meta =
        m.meta && typeof m.meta === "object"
          ? (m.meta as ChatMessage["meta"])
          : undefined;

      return { id, role, content, timestamp, meta };
    })
    .filter((m) => m.content.length > 0);
}

// === HELPER: Verzeichnis rekursiv lesen (wird für ZIP-Import benötigt) ===
const readDirectoryRecursive = async (dirUri: string, basePath = ''): Promise<ProjectFile[]> => {
  let files: ProjectFile[] = [];
  const MAX_FILE_SIZE = Validators.constants.MAX_FILE_SIZE_BYTES;
  const MAX_TOTAL_FILES = Validators.constants.MAX_FILES_IN_ZIP;

  try {
    const items = await FileSystem.readDirectoryAsync(dirUri);

    for (const item of items) {
      // ✅ FIX: Prüfe Dateianzahl NACH dem Hinzufügen, nicht vorher
      if (files.length >= MAX_TOTAL_FILES) {
        logger.warn(`[projectStorage] Maximale Dateianzahl erreicht: ${MAX_TOTAL_FILES}`);
        return files;
      }

      const itemUri = `${dirUri}${item}`;
      const info = await FileSystem.getInfoAsync(itemUri);
      const relativePath = basePath ? `${basePath}/${item}` : item;

      if (info.isDirectory) {
        files = files.concat(await readDirectoryRecursive(itemUri + '/', relativePath));
      } else {
        try {
          // ✅ SICHERHEIT: Dateigröße prüfen
          const fileInfo = info as { exists: true; size?: number; isDirectory: boolean; uri: string };
          if (fileInfo.size && fileInfo.size > MAX_FILE_SIZE) {
            logger.warn(
              `[projectStorage] Datei zu groß, übersprungen: ${relativePath}`,
              `Größe: ${(fileInfo.size / (1024 * 1024)).toFixed(2)}MB`,
            );
            continue;
          }

          const rel = normalizePath(relativePath);
          const isBinary = isBinaryFilePath(rel);
          const content = isBinary
            ? `base64:${await FileSystem.readAsStringAsync(itemUri, { encoding: FileSystem.EncodingType.Base64 })}`
            : await FileSystem.readAsStringAsync(itemUri, { encoding: FileSystem.EncodingType.UTF8 });

          // ✅ SICHERHEIT: Pfad UND Content validieren
          const pathValidation = validateFilePath(relativePath);
          if (!pathValidation.valid) {
            logger.warn(`[projectStorage] Ungültiger Pfad übersprungen: ${relativePath}`, pathValidation.errors);
            continue;
          }

          const contentValidation = validateFileContent(content);
          if (!contentValidation.valid) {
            logger.warn(
              `[projectStorage] Ungültiger Content übersprungen: ${relativePath}`,
              contentValidation.error,
            );
            continue;
          }

          const normalizedPath = pathValidation.normalized || normalizePath(relativePath);
          files.push({ path: normalizedPath, content });
        } catch (error) {
          logger.warn(`[projectStorage] Konnte nicht lesen: ${relativePath}`, error);
        }
      }
    }
  } catch (error) {
    logger.error("[projectStorage] Verzeichnis-Fehler", { err: error });
  }

  return files;
};

// === PROJEKT SPEICHERN/LADEN (Unverändert) ===
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
