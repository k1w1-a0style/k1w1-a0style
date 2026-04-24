// lib/validators.ts
// Sicherheits-Validatoren für Chat/Import/Files
// Ziel: deterministisch, testbar, und als "Gatekeeper" für LLM-Dateiänderungen.

import { z } from 'zod';
import { CONFIG } from '../config';

export type ValidationResult = { valid: true; errors: string[] } | { valid: false; errors: string[] };

const bytesToMB = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 100) / 100;

/**
 * Projekt-Policy (Single Source of Truth):
 * - Root-Dateien nur über CONFIG.PATHS.ALLOWED_ROOT
 * - Unterordner nur über CONFIG.PATHS.SRC_FOLDERS (plus .github)
 */
const ROOT_ALLOWLIST = new Set<string>([...(CONFIG.PATHS?.ALLOWED_ROOT ?? [])]);
const ALLOWED_TOP_LEVEL_DIRS = new Set<string>([...(CONFIG.PATHS?.SRC_FOLDERS ?? []), '.github']);

const hasAllowedExtension = (normalizedPath: string): boolean => {
  const allowed = CONFIG.PATHS?.ALLOWED_EXT ?? [];
  if (!allowed || allowed.length === 0) return true;

  const base = normalizedPath.split('/').pop() ?? normalizedPath;
  // Special case: filenames like ".gitignore" are listed as "extensions" in config.
  if (allowed.includes(base)) return true;

  return allowed.some((ext) => normalizedPath.endsWith(ext));
};

const INVALID_PATH_CHARS = /[\\:*?"<>|]/; // Windows reserved
const INVALID_PATH_SEGMENT = /(^|\/)\.(\/|$)|(^|\/)\.\.(\/|$)/; // . or ..
const LEADING_DOTSLASH = /^\.\//;
const RAW_FILE_URL = /^\s*file\s*:/i;
const RAW_WINDOWS_DRIVE = /^\s*[a-z]:/i;
const RAW_WINDOWS_UNC = /^\s*(?:\\\\|\/\/)/;
const RAW_ABSOLUTE = /^\s*[\/]/;

export const isBlockedRawPath = (raw: string): boolean => {
  const input = String(raw ?? "");
  return RAW_FILE_URL.test(input) || RAW_WINDOWS_DRIVE.test(input) || RAW_WINDOWS_UNC.test(input) || RAW_ABSOLUTE.test(input);
};

// ✅ FIX (einziger inhaltlicher Change): führendes "./" entfernen (auch mehrfach)
export const normalizePath = (p: string) =>
  String(p ?? '')
    .replace(/\r/g, '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^(\.\/)+/, '') // führende "./" Segmente entfernen
    .replace(/\/+$/g, '')
    .replace(/\/{2,}/g, '/');

export const FilePathSchema = z.string().min(1);
export const FileContentSchema = z.string(); // content can be empty (tests expect empty allowed)
export const GitHubRepoSchema = z.string().min(1);
export const ChatInputSchema = z.string().min(1);

export const validateFilePath = (path: string): { valid: boolean; errors: string[]; normalized?: string } => {
  const errors: string[] = [];
  if (!path || typeof path !== 'string' || path.trim().length === 0) {
    return { valid: false, errors: ['Pfad ist leer'] };
  }

  if (isBlockedRawPath(path)) {
    errors.push('Pfad darf kein absoluter/Windows/UNC/file:-Pfad sein');
  }

  const normalized = normalizePath(path);

  // Must not keep leading "./" (tests expect reject in validateFilePath)
  if (LEADING_DOTSLASH.test(path.trim())) {
    errors.push('Pfad darf nicht mit ./ beginnen');
  }

  if (normalized.length > (CONFIG.PATHS?.MAX_PATH_LENGTH ?? 255)) {
    errors.push('Pfad ist zu lang');
  }

  if (normalized.startsWith('/') || normalized.startsWith('\\')) {
    errors.push('Pfad darf nicht absolut sein');
  }

  if (INVALID_PATH_SEGMENT.test('/' + normalized + '/')) {
    errors.push('Pfad enthält ungültige Segmente');
  }

  if (INVALID_PATH_CHARS.test(normalized) || /[<>]/.test(normalized)) {
    errors.push('Ungültige Zeichen im Pfad');
  }

  // Disallow node_modules & native folders via policy
  if (normalized === 'node_modules' || normalized.startsWith('node_modules/')) {
    errors.push('node_modules ist nicht erlaubt');
  }
  if (normalized === 'ios' || normalized.startsWith('ios/')) {
    errors.push('ios ist nicht erlaubt');
  }

  // Root policy: allowlist only
  if (!normalized.includes('/')) {
    if (!ROOT_ALLOWLIST.has(normalized)) {
      errors.push('Root-Dateien sind nur über eine Allowlist erlaubt');
    }
  } else {
    const top = normalized.split('/')[0];
    if (!ALLOWED_TOP_LEVEL_DIRS.has(top)) {
      errors.push(`Ordner "${top}" ist nicht erlaubt`);
    }
  }

  // Extension policy (keeps chat-utils + file-writer consistent)
  if (normalized && !hasAllowedExtension(normalized)) {
    errors.push('Ungültige Dateiendung');
  }

  return { valid: errors.length === 0, errors, normalized };
};

export const validateFileContent = (
  content: string
): { valid: boolean; error?: string; sizeBytes: number; sizeMB: number } => {
  // Ensure string
  const safe = typeof content === 'string' ? content : String(content ?? '');
  const sizeBytes = Buffer.byteLength(safe, 'utf8');
  const sizeMB = bytesToMB(sizeBytes);

  const maxBytes = (() => {
    const cfg = CONFIG?.VALIDATION;
    const maxMB = Number(cfg?.MAX_FILE_SIZE_MB);
    if (Number.isFinite(maxMB) && maxMB > 0) return Math.floor(maxMB * 1024 * 1024);
    return 10 * 1024 * 1024; // tests expect 10MB ok, 11MB rejected
  })();

  if (sizeBytes > maxBytes) {
    return { valid: false, error: `Content ist zu groß (${sizeMB}MB)`, sizeBytes, sizeMB };
  }
  return { valid: true, sizeBytes, sizeMB };
};

export const validateGitHubRepo = (
  repo: string
): { valid: boolean; error?: string; owner?: string; name?: string } => {
  const raw = (repo ?? '').trim();
  if (!raw) return { valid: false, error: 'Repo ist leer' };
  // only "owner/name" (single slash), no leading/trailing slash
  const m = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!m) return { valid: false, error: 'Repo muss im Format owner/repo sein' };
  return { valid: true, owner: m[1], name: m[2] };
};

const XSS_DANGEROUS = /(script\b|iframe\b|on\w+\s*=|javascript:|data:text\/html)/i;
export const sanitizeChat = (input: string) => {
  // Keep harmless tags, but neutralize dangerous patterns
  let out = input;
  // remove script/iframe tags content
  out = out.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  out = out.replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '');
  // remove event handlers: onclick="..."
  out = out.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
  // neutralize javascript: URLs
  out = out.replace(/javascript:/gi, '');
  return out;
};

export const validateChatInput = (
  input: string
): { valid: boolean; error?: string; sanitized?: string; hadXSS?: boolean } => {
  const raw = typeof input === 'string' ? input : String(input ?? '');
  if (raw.trim().length === 0) return { valid: false, error: 'Nachricht ist leer' };
  if (raw.length > 10000) return { valid: false, error: 'Nachricht ist zu lang' };

  const hadXSS = XSS_DANGEROUS.test(raw);
  const sanitized = (hadXSS ? sanitizeChat(raw) : raw).trim();

  return { valid: true, sanitized, hadXSS };
};

export type ZipFileEntry = { path: string; content: string };

export const validateZipImport = (
  files: ZipFileEntry[]
): {
  valid: boolean;
  validFiles: { path: string; content: string }[];
  invalidFiles: { path: string; reason: string }[];
  errors: string[];
} => {
  const errors: string[] = [];
  const validFiles: { path: string; content: string }[] = [];
  const invalidFiles: { path: string; reason: string }[] = [];

  const maxFiles = CONFIG?.VALIDATION?.MAX_FILES ?? 200;

  if (!Array.isArray(files)) {
    return { valid: false, validFiles: [], invalidFiles: [], errors: ['Import ist kein Array'] };
  }

  if (files.length === 0) {
    errors.push('ZIP enthält keine Dateien');
  }

  if (files.length > maxFiles) {
    errors.push(`Zu viele Dateien (max ${maxFiles})`);
  }

  for (const f of files) {
    const p = normalizePath(String(f?.path ?? ''));
    const c = typeof f?.content === 'string' ? f.content : String(f?.content ?? '');

    const pRes = validateFilePath(String(f?.path ?? ""));
    if (!pRes.valid) {
      invalidFiles.push({ path: p || '(leer)', reason: pRes.errors.join('; ') });
      continue;
    }

    const cRes = validateFileContent(c);
    if (!cRes.valid) {
      invalidFiles.push({ path: pRes.normalized || p, reason: cRes.error || 'Ungültiger Content' });
      continue;
    }

    validFiles.push({ path: pRes.normalized || p, content: c });
  }

  if (invalidFiles.length > 0) errors.push('ZIP enthält ungültige Dateien (strict all-or-nothing)');

  return { valid: errors.length === 0 && invalidFiles.length === 0, validFiles, invalidFiles, errors };
};

const readValidationConfigRecord = (): Record<string, unknown> => {
  const cfg = CONFIG?.VALIDATION;
  return cfg && typeof cfg === 'object' ? (cfg as Record<string, unknown>) : {};
};

const readValidationMaxFileSizeBytes = (): number => {
  const cfg = readValidationConfigRecord();
  const bytes = Number(cfg.MAX_FILE_SIZE_BYTES);
  if (Number.isFinite(bytes) && bytes > 0) return bytes;
  const mb = Number(cfg.MAX_FILE_SIZE_MB);
  if (Number.isFinite(mb) && mb > 0) return Math.floor(mb * 1024 * 1024);
  return 10 * 1024 * 1024;
};

// Backwards-compat: einige Stellen erwarten Validators.constants
export const Validators = {
  constants: {
    MAX_FILES: CONFIG?.VALIDATION?.MAX_FILES ?? 200,
    MAX_FILES_IN_ZIP: CONFIG?.VALIDATION?.MAX_FILES ?? 200,
    MAX_FILE_SIZE_BYTES: readValidationMaxFileSizeBytes(),
    // Back-compat alias
    MAX_FILE_SIZE: readValidationMaxFileSizeBytes(),
  },
};
