// infra/storage/persistenceHelpers.ts
// Extracted from projectPersistence.ts: private helper functions.

import type { ProjectFile } from "../../shared/types/project";
import type { ChatMessage } from "../../shared/types/chat";
import * as FileSystem from 'expo-file-system/legacy';
import { v4 as uuidv4 } from 'uuid';

// ✅ Phase 1 Step 3: normalizePath aus lib/validators statt utils/chatValidation
import { normalizePath, Validators } from '../../lib/validators';

import { logger } from "../../lib/logger";


export const PROJECT_STORAGE_KEY = 'k1w1_project_data';
export const PROJECT_STORAGE_SOFT_LIMIT_BYTES = 1_500_000;
export const PROJECT_STORAGE_HARD_LIMIT_BYTES = 3_800_000;
export const PROJECT_STORAGE_CHUNK_MAX_BYTES = 900_000;
export const PROJECT_STORAGE_CHUNK_KEY_PREFIX = `${PROJECT_STORAGE_KEY}__chunk__`;
export const CACHE_DIR = FileSystem.cacheDirectory + 'zip_temp/';
// === Binary file handling (assets etc.) ===
export const BINARY_EXTENSIONS = new Set([
  "png","jpg","jpeg","webp","gif","bmp","ico",
  "mp3","wav","m4a","mp4","mov","mkv",
  "zip","jar","keystore","jks","cer","der","p12",
  "ttf","otf","woff","woff2",
]);

export function isBinaryFilePath(p: string): boolean {
  const n = normalizePath(p).toLowerCase();
  const ext = n.includes(".") ? n.split(".").pop()! : "";
  return BINARY_EXTENSIONS.has(ext);
}

export function stripBase64Prefix(s: string): string {
  return s.startsWith("base64:") ? s.slice("base64:".length) : s;
}

export function getUtf8ByteSize(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.byteLength(value, "utf8");
  }

  return unescape(encodeURIComponent(value)).length;
}

export function assertProjectStoragePayloadSafe(payload: string): {
  bytes: number;
  nearLimit: boolean;
} {
  const bytes = getUtf8ByteSize(payload);

  if (bytes > PROJECT_STORAGE_HARD_LIMIT_BYTES) {
    throw new Error(
      `Persisted project payload exceeds storage hard limit (${bytes} bytes > ${PROJECT_STORAGE_HARD_LIMIT_BYTES} bytes).`,
    );
  }

  return {
    bytes,
    nearLimit: bytes > PROJECT_STORAGE_SOFT_LIMIT_BYTES,
  };
}

export function trimChatHistory<T extends { timestamp?: string }>(
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




type LegacyChatMessageLike = {
  id?: unknown;
  role?: unknown;
  content?: unknown;
  timestamp?: unknown;
  meta?: unknown;
};

function isLegacyChatMessageLike(value: unknown): value is LegacyChatMessageLike {
  return !!value && typeof value === "object";
}

export function ensureChatHistoryHasIds(history: unknown[]): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter(isLegacyChatMessageLike)
    .map((m) => {
      const role: ChatMessage["role"] =
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
type DirectoryReadContext = {
  filesRead: number;
  maxFiles: number;
};

const createDirectoryReadContext = (): DirectoryReadContext => ({
  filesRead: 0,
  maxFiles: Validators.constants.MAX_FILES_IN_ZIP,
});

export const readDirectoryRecursive = async (
  dirUri: string,
  basePath = '',
  context: DirectoryReadContext = createDirectoryReadContext(),
): Promise<ProjectFile[]> => {
  const files: ProjectFile[] = [];
  const MAX_FILE_SIZE = Validators.constants.MAX_FILE_SIZE_BYTES;

  try {
    const items = await FileSystem.readDirectoryAsync(dirUri);

    for (const item of items) {
      if (context.filesRead >= context.maxFiles) {
        throw new Error(`ZIP enthält zu viele Dateien (max ${context.maxFiles})`);
      }

      const itemUri = `${dirUri}${item}`;
      const info = await FileSystem.getInfoAsync(itemUri);
      const relativePath = basePath ? `${basePath}/${item}` : item;

      if (info.isDirectory) {
        const nestedFiles = await readDirectoryRecursive(`${itemUri}/`, relativePath, context);
        files.push(...nestedFiles);
      } else {
        const fileInfo = info as { exists: true; size?: number; isDirectory: boolean; uri: string };
        const fileSize = fileInfo.size ?? 0;

        if (fileSize > MAX_FILE_SIZE) {
          throw new Error(
            `Datei zu groß im ZIP: ${relativePath} (${(fileSize / (1024 * 1024)).toFixed(2)}MB > ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(2)}MB)`,
          );
        }

        const rel = normalizePath(relativePath);
        const isBinary = isBinaryFilePath(rel);
        const content = isBinary
          ? `base64:${await FileSystem.readAsStringAsync(itemUri, { encoding: FileSystem.EncodingType.Base64 })}`
          : await FileSystem.readAsStringAsync(itemUri, { encoding: FileSystem.EncodingType.UTF8 });

        files.push({ path: rel, content });
        context.filesRead += 1;
      }
    }
  } catch (error) {
    logger.error("[projectStorage] Verzeichnis-Fehler beim ZIP-Read", { err: error, dirUri, basePath });
    throw error;
  }

  return files;
};

// === PROJEKT SPEICHERN/LADEN (Unverändert) ===
