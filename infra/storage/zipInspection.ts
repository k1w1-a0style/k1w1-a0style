import * as FileSystem from 'expo-file-system/legacy';

import { validateFilePath } from '../../lib/validators';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const MAX_EOCD_SEARCH = 65_557; // 64KiB comment + EOCD structure
const ZIP64_U16_MAX = 0xffff;
const ZIP64_U32_MAX = 0xffffffff;

export type ZipInspectionLimits = {
  maxEntries: number;
  maxFileBytes: number;
  maxTotalUncompressedBytes: number;
};

export type ZipArchiveEntry = {
  path: string;
  compressedBytes: number;
  uncompressedBytes: number;
  isDirectory: boolean;
};

export type ZipInspectionIssue = {
  path: string;
  reason: string;
};

export type ZipInspectionResult = {
  valid: boolean;
  entries: ZipArchiveEntry[];
  totalCompressedBytes: number;
  totalUncompressedBytes: number;
  issues: ZipInspectionIssue[];
  errors: string[];
};

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)
  ) >>> 0;
}

function decodeBase64(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  if (typeof atob === 'function') {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }

  throw new Error('ZIP-Metadaten können auf diesem Gerät nicht gelesen werden.');
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const start = Math.max(0, bytes.length - MAX_EOCD_SEARCH);
  for (let offset = bytes.length - 22; offset >= start; offset -= 1) {
    if (readUint32LE(bytes, offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }
  return -1;
}

function validateEntryPath(
  rawPath: string,
  isDirectory: boolean,
): { valid: boolean; normalized?: string; reason?: string } {
  const candidate = isDirectory ? rawPath.replace(/\/+$/, '') : rawPath;
  if (!candidate.trim()) {
    return { valid: false, reason: 'Pfad ist leer' };
  }
  if (candidate.includes('\\')) {
    return { valid: false, reason: 'Pfad darf keine Backslashes enthalten' };
  }
  if (candidate.includes('\0')) {
    return { valid: false, reason: 'Pfad enthält Null-Bytes' };
  }

  if (isDirectory) {
    const normalized = candidate
      .replace(/\r/g, '')
      .trim()
      .replace(/^\/+/, '')
      .replace(/\/+$/g, '')
      .replace(/\/{2,}/g, '/');

    if (!normalized) {
      return { valid: false, reason: 'Pfad ist leer' };
    }

    if (/(^|\/)\.(\/|$)|(^|\/)\.\.(\/|$)/.test(`/${normalized}/`)) {
      return { valid: false, reason: 'Pfad enthält ungültige Segmente' };
    }

    return { valid: true, normalized };
  }

  const validation = validateFilePath(candidate);
  if (!validation.valid) {
    return { valid: false, reason: validation.errors.join('; ') };
  }

  return { valid: true, normalized: validation.normalized };
}

export function inspectZipArchiveBytes(
  bytes: Uint8Array,
  limits: ZipInspectionLimits,
): ZipInspectionResult {
  const errors: string[] = [];
  const issues: ZipInspectionIssue[] = [];
  const entries: ZipArchiveEntry[] = [];

  if (!(bytes instanceof Uint8Array) || bytes.length < 22) {
    return {
      valid: false,
      entries: [],
      totalCompressedBytes: 0,
      totalUncompressedBytes: 0,
      issues: [{ path: '(archive)', reason: 'ZIP-Datei ist leer oder unvollständig' }],
      errors: ['ZIP-Datei ist leer oder unvollständig'],
    };
  }

  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) {
    return {
      valid: false,
      entries: [],
      totalCompressedBytes: 0,
      totalUncompressedBytes: 0,
      issues: [{ path: '(archive)', reason: 'ZIP-Zentralverzeichnis wurde nicht gefunden' }],
      errors: ['ZIP-Zentralverzeichnis wurde nicht gefunden'],
    };
  }

  const entryCount = readUint16LE(bytes, eocdOffset + 10);
  const centralDirectorySize = readUint32LE(bytes, eocdOffset + 12);
  const centralDirectoryOffset = readUint32LE(bytes, eocdOffset + 16);

  if (
    entryCount === ZIP64_U16_MAX ||
    centralDirectorySize === ZIP64_U32_MAX ||
    centralDirectoryOffset === ZIP64_U32_MAX
  ) {
    return {
      valid: false,
      entries: [],
      totalCompressedBytes: 0,
      totalUncompressedBytes: 0,
      issues: [{ path: '(archive)', reason: 'ZIP64 wird für den Import nicht unterstützt' }],
      errors: ['ZIP64 wird für den Import nicht unterstützt'],
    };
  }

  if (entryCount === 0) {
    return {
      valid: false,
      entries: [],
      totalCompressedBytes: 0,
      totalUncompressedBytes: 0,
      issues: [{ path: '(archive)', reason: 'ZIP enthält keine Dateien' }],
      errors: ['ZIP enthält keine Dateien'],
    };
  }

  if (entryCount > limits.maxEntries) {
    errors.push(`ZIP enthält zu viele Dateien (max ${limits.maxEntries})`);
  }

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > bytes.length) {
    return {
      valid: false,
      entries: [],
      totalCompressedBytes: 0,
      totalUncompressedBytes: 0,
      issues: [{ path: '(archive)', reason: 'ZIP-Zentralverzeichnis ist beschädigt oder unvollständig' }],
      errors: ['ZIP-Zentralverzeichnis ist beschädigt oder unvollständig'],
    };
  }

  let cursor = centralDirectoryOffset;
  let totalCompressedBytes = 0;
  let totalUncompressedBytes = 0;
  const seenFilePaths = new Set<string>();

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > bytes.length) {
      errors.push('ZIP-Zentralverzeichnis ist beschädigt oder unvollständig');
      break;
    }

    const signature = readUint32LE(bytes, cursor);
    if (signature !== CENTRAL_DIRECTORY_SIGNATURE) {
      errors.push('ZIP-Zentralverzeichnis enthält einen ungültigen Eintrag');
      break;
    }

    const compressedBytes = readUint32LE(bytes, cursor + 20);
    const uncompressedBytes = readUint32LE(bytes, cursor + 24);
    const fileNameLength = readUint16LE(bytes, cursor + 28);
    const extraLength = readUint16LE(bytes, cursor + 30);
    const commentLength = readUint16LE(bytes, cursor + 32);
    const headerSize = 46 + fileNameLength + extraLength + commentLength;

    if (cursor + headerSize > bytes.length) {
      errors.push('ZIP-Eintrag ist beschädigt oder unvollständig');
      break;
    }

    if (compressedBytes === ZIP64_U32_MAX || uncompressedBytes === ZIP64_U32_MAX) {
      issues.push({ path: '(archive)', reason: 'ZIP64-Einträge werden für den Import nicht unterstützt' });
      errors.push('ZIP64-Einträge werden für den Import nicht unterstützt');
      break;
    }

    const fileNameBytes = bytes.slice(cursor + 46, cursor + 46 + fileNameLength);
    const rawPath = decodeUtf8(fileNameBytes);
    const isDirectory = rawPath.endsWith('/');

    const pathValidation = validateEntryPath(rawPath, isDirectory);
    if (!pathValidation.valid) {
      issues.push({ path: rawPath || '(leer)', reason: pathValidation.reason ?? 'Ungültiger Pfad' });
    } else if (!isDirectory) {
      const normalizedPath = pathValidation.normalized ?? rawPath;
      if (seenFilePaths.has(normalizedPath)) {
        issues.push({
          path: normalizedPath,
          reason: 'Duplizierter Dateipfad im Archiv',
        });
      } else {
        seenFilePaths.add(normalizedPath);
      }

      totalCompressedBytes += compressedBytes;
      totalUncompressedBytes += uncompressedBytes;

      if (uncompressedBytes > limits.maxFileBytes) {
        issues.push({
          path: normalizedPath,
          reason: `Datei zu groß im Archiv (${(uncompressedBytes / (1024 * 1024)).toFixed(2)}MB > ${(limits.maxFileBytes / (1024 * 1024)).toFixed(2)}MB)`,
        });
      }

      entries.push({
        path: normalizedPath,
        compressedBytes,
        uncompressedBytes,
        isDirectory: false,
      });
    }

    cursor += headerSize;
  }

  if (issues.length > 0) {
    errors.push('ZIP-Metadatenprüfung fehlgeschlagen');
  }

  if (totalUncompressedBytes > limits.maxTotalUncompressedBytes) {
    errors.push(
      `ZIP entpackt zu viele Daten (${(totalUncompressedBytes / (1024 * 1024)).toFixed(2)}MB > ${(limits.maxTotalUncompressedBytes / (1024 * 1024)).toFixed(2)}MB)`,
    );
  }

  return {
    valid: errors.length === 0,
    entries,
    totalCompressedBytes,
    totalUncompressedBytes,
    issues,
    errors,
  };
}

export async function inspectZipArchiveFromUri(
  uri: string,
  limits: ZipInspectionLimits,
): Promise<ZipInspectionResult> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return inspectZipArchiveBytes(decodeBase64(base64), limits);
}
