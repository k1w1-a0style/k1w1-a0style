// infra/storage/projectPersistence.ts
// REFACTORED: helpers → persistenceHelpers.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProjectData } from "../../shared/types/project";
import type { ChatMessage } from "../../shared/types/chat";
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { v4 as uuidv4 } from 'uuid';
import { materializeProjectFiles } from "../../lib/projectMaterializer";
import { loadChatHistorySettings } from "../../lib/chatPrivacySettings";
import { shouldStronglyRedactPath } from "../../lib/promptSanitizer";

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
  PROJECT_STORAGE_KEY, CACHE_DIR,
  PROJECT_STORAGE_CHUNK_KEY_PREFIX,
  PROJECT_STORAGE_CHUNK_MAX_BYTES,
  isBinaryFilePath, stripBase64Prefix, trimChatHistory,
  ensureChatHistoryHasIds,
  readDirectoryRecursive,
  assertProjectStoragePayloadSafe,
  getUtf8ByteSize,
} from "./persistenceHelpers";

type ChunkedProjectStorageManifest = {
  type: "k1w1-project-storage-chunk-manifest";
  version: 1;
  chunkCount: number;
  chunkKeyPrefix: string;
  chunkBytes: number[];
  totalBytes: number;
};

const isChunkManifest = (value: unknown): value is ChunkedProjectStorageManifest => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ChunkedProjectStorageManifest>;
  return (
    candidate.type === "k1w1-project-storage-chunk-manifest" &&
    candidate.version === 1 &&
    typeof candidate.chunkCount === "number" &&
    candidate.chunkCount >= 1 &&
    typeof candidate.chunkKeyPrefix === "string" &&
    Array.isArray(candidate.chunkBytes)
  );
};

const createChunkKey = (index: number): string => `${PROJECT_STORAGE_CHUNK_KEY_PREFIX}${index}`;
const isHighSurrogateCodeUnit = (value: number): boolean => value >= 0xd800 && value <= 0xdbff;
const chunkPayloadByBytes = (payload: string, maxBytes: number): string[] => {
  if (payload.length === 0) return [""];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < payload.length) {
    let next = Math.min(payload.length, cursor + maxBytes);
    if (getUtf8ByteSize(payload.slice(cursor, next)) > maxBytes) {
      let low = cursor + 1;
      let high = next;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const bytes = getUtf8ByteSize(payload.slice(cursor, mid));
        if (bytes <= maxBytes) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      next = high;
    }
    if (
      next < payload.length &&
      next > cursor &&
      isHighSurrogateCodeUnit(payload.charCodeAt(next - 1))
    ) {
      next -= 1;
    }
    if (next === cursor) {
      throw new Error("Projekt-Payload konnte nicht sicher in Storage-Chunks aufgeteilt werden.");
    }
    chunks.push(payload.slice(cursor, next));
    cursor = next;
  }
  return chunks;
};

const cleanupChunkKeys = async (): Promise<void> => {
  const keys = await AsyncStorage.getAllKeys();
  const staleChunkKeys = keys.filter((key) => key.startsWith(PROJECT_STORAGE_CHUNK_KEY_PREFIX));
  if (staleChunkKeys.length > 0) {
    await AsyncStorage.multiRemove(staleChunkKeys);
  }
};

const readPersistedProjectPayload = async (): Promise<string | null> => {
  const rootPayload = await AsyncStorage.getItem(PROJECT_STORAGE_KEY);
  if (!rootPayload) return null;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rootPayload);
  } catch {
    return rootPayload;
  }
  if (!isChunkManifest(parsed)) {
    return rootPayload;
  }
  const manifest = parsed;
  const chunkKeys = Array.from({ length: manifest.chunkCount }, (_, index) => createChunkKey(index));
  const chunkEntries = await AsyncStorage.multiGet(chunkKeys);
  const chunkMap = new Map(chunkEntries);
  const missingChunkKey = chunkKeys.find((key) => typeof chunkMap.get(key) !== "string");
  if (missingChunkKey) {
    throw new Error(`Gespeicherter Projektstand ist unvollstaendig (fehlender Storage-Chunk: ${missingChunkKey}).`);
  }
  return chunkKeys.map((key) => chunkMap.get(key) as string).join("");
};

const writePersistedProjectPayload = async (payload: string): Promise<void> => {
  const payloadBytes = getUtf8ByteSize(payload);
  if (payloadBytes <= PROJECT_STORAGE_CHUNK_MAX_BYTES) {
    await AsyncStorage.setItem(PROJECT_STORAGE_KEY, payload);
    await cleanupChunkKeys();
    return;
  }
  const chunks = chunkPayloadByBytes(payload, PROJECT_STORAGE_CHUNK_MAX_BYTES);
  const chunkEntries = chunks.map((chunk, index) => [createChunkKey(index), chunk] as const);
  await AsyncStorage.multiSet(chunkEntries as [string, string][]);
  const manifest: ChunkedProjectStorageManifest = {
    type: "k1w1-project-storage-chunk-manifest",
    version: 1,
    chunkCount: chunkEntries.length,
    chunkKeyPrefix: PROJECT_STORAGE_CHUNK_KEY_PREFIX,
    chunkBytes: chunks.map((chunk) => getUtf8ByteSize(chunk)),
    totalBytes: payloadBytes,
  };
  await AsyncStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(manifest));
  const keys = await AsyncStorage.getAllKeys();
  const staleChunkKeys = keys
    .filter((key) => key.startsWith(PROJECT_STORAGE_CHUNK_KEY_PREFIX))
    .filter((key) => !chunkEntries.some(([chunkKey]) => chunkKey === key));
  if (staleChunkKeys.length > 0) {
    await AsyncStorage.multiRemove(staleChunkKeys);
  }
};

const encryptProjectStoragePayloadOrPlaintextFallback = async (
  projectString: string,
): Promise<{ payload: string; encrypted: boolean }> => {
  try {
    return { payload: await encryptProjectStoragePayload(projectString), encrypted: true };
  } catch (error) {
    logger.warn("[projectStorage] Projekt-Persistenz-Crypto nicht verfügbar; Legacy-Plaintext-Fallback aktiviert", {
      err: error,
    });
    return { payload: projectString, encrypted: false };
  }
};

export const saveProjectToStorage = async (project: ProjectData): Promise<void> => {
  try {
    const { persist: persistChat, retention } = await loadChatHistorySettings();

    const projectToSave: ProjectData = {
      ...project,
      chatHistory: persistChat ? trimChatHistory(project.chatHistory ?? [], retention) : [],
    };
    const projectString = JSON.stringify(projectToSave);
    const plaintextPayloadState = assertProjectStoragePayloadSafe(projectString);

    const { payload: persistedProjectString, encrypted } = await encryptProjectStoragePayloadOrPlaintextFallback(projectString);
    const persistedPayloadState = assertProjectStoragePayloadSafe(persistedProjectString);
    await writePersistedProjectPayload(persistedProjectString);

    if (plaintextPayloadState.nearLimit || persistedPayloadState.nearLimit) {
      logger.warn("[projectStorage] Projektzustand nahe Storage-Limit gespeichert", {
        projectName: project.name,
        plaintextBytes: plaintextPayloadState.bytes,
        persistedBytes: persistedPayloadState.bytes,
        encrypted,
      });
    } else {
      logger.info(encrypted ? '💾 Projekt verschlüsselt gespeichert:' : '💾 Projekt gespeichert:', project.name);
    }
  } catch (error) {
    logger.error("[projectStorage] Fehler beim Speichern", { err: error });
    throw new Error('Projekt konnte nicht gespeichert werden');
  }
};

export const loadProjectFromStorage = async (): Promise<ProjectData | null> => {
  let rawStoragePayload: string | null = null;
  let hasProjectStorageRoot = false;
  try {
    hasProjectStorageRoot = Boolean(await AsyncStorage.getItem(PROJECT_STORAGE_KEY));
    rawStoragePayload = await readPersistedProjectPayload();
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
      await saveProjectToStorage(project).catch((migrationError: unknown) => {
        logger.warn("[projectStorage] Plaintext-Migration übersprungen; geladener Stand bleibt nutzbar", {
          err: migrationError,
        });
      });
    }
    return project;
  } catch (error) {
    logger.error("[projectStorage] Fehler beim Laden", { err: error });
    if (rawStoragePayload && looksLikeEncryptedProjectStoragePayload(rawStoragePayload)) {
      throw new Error(
        "Verschluesseltes Projekt konnte nicht entschluesselt werden (Key/Decrypt-Fehler). Bitte Daten wiederherstellen statt automatisch zu ueberschreiben.",
      );
    }
    if (rawStoragePayload || hasProjectStorageRoot) {
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
    await cleanupChunkKeys();
    logger.info('🗑️ Projekt aus Storage gelöscht');
  } catch (error) {
    logger.error("[projectStorage] Fehler beim Löschen", { err: error });
    throw new Error('Projekt konnte nicht gelöscht werden');
  }
};

export const scrubChatHistoryFromStoredProject = async (): Promise<void> => {
  const rawStoragePayload = await readPersistedProjectPayload();
  if (!rawStoragePayload) return;

  const { projectString } = await deserializeProjectStoragePayload(rawStoragePayload);
  const parsed = JSON.parse(projectString) as ProjectData & { messages?: ChatMessage[] };
  parsed.chatHistory = [];
  if (Array.isArray(parsed.messages)) {
    delete parsed.messages;
  }
  const scrubbedPayload = JSON.stringify(parsed);
  const { payload } = await encryptProjectStoragePayloadOrPlaintextFallback(scrubbedPayload);
  await writePersistedProjectPayload(payload);
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
  const projectName = project.name.replace(/[\s\/]+/g, '_') || 'projekt';
  const tempDir = CACHE_DIR + 'projekt-export/';
  const zipPath = FileSystem.cacheDirectory + `${projectName}.zip`;
  const exportRootPath = tempDir.endsWith('/') ? tempDir : `${tempDir}/`;

  const resolveCanonicalExportWritePath = (rawPath: string): { normalizedPath: string; writePath: string } => {
    if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
      throw new Error('ZIP-Exportpfad ist leer oder ungültig');
    }

    const trimmedRawPath = rawPath.trim();
    const normalizedPath = normalizePath(trimmedRawPath);
    const pathSegments = normalizedPath.split('/');

    const hasInvalidSegments =
      normalizedPath.length === 0 ||
      pathSegments.some((segment) => segment.length === 0 || segment === '.' || segment === '..');
    const hasAbsoluteOrRootedPrefix =
      trimmedRawPath.startsWith('/') ||
      trimmedRawPath.startsWith('\\') ||
      trimmedRawPath.startsWith('file://') ||
      /^[a-zA-Z]:/.test(trimmedRawPath) ||
      trimmedRawPath.startsWith('\\\\');

    if (hasInvalidSegments || hasAbsoluteOrRootedPrefix || normalizedPath.includes('\0')) {
      throw new Error(`Unsicherer ZIP-Exportpfad erkannt: ${rawPath}`);
    }

    return {
      normalizedPath,
      writePath: `${exportRootPath}${normalizedPath}`,
    };
  };
  for (const rawFile of project.files ?? []) {
    resolveCanonicalExportWritePath(String(rawFile?.path ?? ''));
  }
  const projectFiles = materializeProjectFiles(project.files, { name: project.name, slug: project.slug ?? project.name, packageName: project.packageName });

  try {
    await FileSystem.deleteAsync(tempDir, { idempotent: true });
    await FileSystem.deleteAsync(zipPath, { idempotent: true });
    await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

    for (const file of projectFiles) {
      const contentString =
        typeof file.content === 'string' ? file.content : JSON.stringify(file.content, null, 2);
      const { normalizedPath, writePath } = resolveCanonicalExportWritePath(file.path);

      if (shouldStronglyRedactPath(normalizedPath)) {
        logger.warn('[projectStorage] Sensitive Datei vom ZIP-Export ausgeschlossen', { path: normalizedPath });
        continue;
      }

      const dirName = writePath.substring(0, writePath.lastIndexOf('/'));

      if (dirName && dirName !== exportRootPath.slice(0, -1)) {
        await FileSystem.makeDirectoryAsync(dirName, { intermediates: true });
      }

      const isBinary = isBinaryFilePath(normalizedPath);
      const hasBase64 = typeof contentString === "string" && contentString.startsWith("base64:");

      if (isBinary && hasBase64) {
        await FileSystem.writeAsStringAsync(writePath, stripBase64Prefix(contentString), {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        await FileSystem.writeAsStringAsync(writePath, contentString, {
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
