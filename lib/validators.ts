// lib/validators.ts
// Sicherheits-Validatoren für Chat/Import/Files
// Ziel: deterministisch, testbar, und als "Gatekeeper" für LLM-Dateiänderungen.

import { z } from 'zod';
import { CONFIG } from '../config';

export type ValidationResult = { valid: true; errors: string[] } | { valid: false; errors: string[] };

const bytesToMB = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 100) / 100;

/**
 * Projekt-Policy: Root ist grundsätzlich gesperrt – außer einer harten Allowlist.
 * Alles andere muss in einem erlaubten Ordner liegen.
 */
const ROOT_ALLOWLIST = new Set<string>([
  'App.tsx',
  'app.config.js',
  'eas.json',
  'package.json',
  'tsconfig.json',
  'babel.config.js',
  'metro.config.js',
  'jest.config.js',
  'jest.setup.js',
  'eslint.config.js',
  'README.md',
  'SYSTEM_README.md',
]);

const ALLOWED_TOP_LEVEL_DIRS = new Set<string>([
  'screens',
  'components',
  'contexts',
  'hooks',
  'lib',
  'utils',
  'types',
  'navigation',
  'assets',
  'templates',
  'tools',
  'scripts',
  'supabase',
]);

const INVALID_PATH_CHARS = /[\\:*?"<>|]/; // Windows reserved
const INVALID_PATH_SEGMENT = /(^|\/)\.(\/|$)|(^|\/)\.\.(\/|$)/; // . or ..
const LEADING_DOTSLASH = /^\.\//;

export const normalizePath = (p: string) =>
  p.replace(/\r/g, '').trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/g, '').replace(/\/{2,}/g, '/');

export const FilePathSchema = z.string().min(1);
export const FileContentSchema = z.string(); // content can be empty (tests expect empty allowed)
export const GitHubRepoSchema = z.string().min(1);
export const ChatInputSchema = z.string().min(1);

export const validateFilePath = (path: string): { valid: boolean; errors: string[]; normalized?: string } => {
  const errors: string[] = [];
  if (!path || typeof path !== 'string' || path.trim().length === 0) {
    return { valid: false, errors: ['Pfad ist leer'] };
  }

  const normalized = normalizePath(path);

  // Must not keep leading "./" (tests expect reject)
  if (LEADING_DOTSLASH.test(path.trim())) {
    errors.push('Pfad darf nicht mit ./ beginnen');
  }

  if (normalized.length > ((CONFIG as any)?.PATHS?.MAX_PATH_LENGTH ?? 255)) {
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
  if (normalized === 'android' || normalized.startsWith('android/')) {
    errors.push('android ist nicht erlaubt');
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
    const cfg = CONFIG?.VALIDATION as any;
    // prefer bytes if present, otherwise MB fallback to 10MB
    const maxBytesDirect = Number(cfg?.MAX_FILE_SIZE_BYTES);
    if (Number.isFinite(maxBytesDirect) && maxBytesDirect > 0) return maxBytesDirect;
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
  const sanitized = hadXSS ? sanitizeChat(raw) : raw;

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

  if (files.length > maxFiles) {
    errors.push(`Zu viele Dateien (max ${maxFiles})`);
  }

  for (const f of files) {
    const p = normalizePath(String(f?.path ?? ''));
    const c = typeof f?.content === 'string' ? f.content : String(f?.content ?? '');

    const pRes = validateFilePath(p);
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

  if (invalidFiles.length > 0) errors.push('Einige Dateien sind ungültig');

  return { valid: errors.length === 0 && invalidFiles.length === 0, validFiles, invalidFiles, errors };
};


// Backwards-compat: einige Stellen erwarten Validators.constants
export const Validators = {
  constants: {
    MAX_FILES: CONFIG?.VALIDATION?.MAX_FILES ?? 200,
    MAX_FILES_IN_ZIP: CONFIG?.VALIDATION?.MAX_FILES ?? 200,
    MAX_FILE_SIZE_BYTES: (() => {
      const cfg: any = CONFIG?.VALIDATION;
      const b = Number(cfg?.MAX_FILE_SIZE_BYTES);
      if (Number.isFinite(b) && b > 0) return b;
      const mb = Number(cfg?.MAX_FILE_SIZE_MB);
      if (Number.isFinite(mb) && mb > 0) return Math.floor(mb * 1024 * 1024);
      return 10 * 1024 * 1024;
    })(),
    MAX_FILE_SIZE: (() => {
      const cfg = CONFIG?.VALIDATION as any;
      const b = Number(cfg?.MAX_FILE_SIZE_BYTES);
      if (Number.isFinite(b) && b > 0) return b;
      const mb = Number(cfg?.MAX_FILE_SIZE_MB);
      if (Number.isFinite(mb) && mb > 0) return Math.floor(mb * 1024 * 1024);
      return 10 * 1024 * 1024;
    })(),
  },
};
