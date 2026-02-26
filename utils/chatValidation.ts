// utils/chatValidation.ts
// Extracted from chatUtils.ts: path/file validation utilities.

import { jsonrepair } from 'jsonrepair';

import { CONFIG } from '../config';
import { normalizePath as libNormalizePath, validateFilePath as libValidateFilePath } from '../lib/validators';

import type { ProjectFile } from "../shared/types/project";
import { logger } from '../lib/logger';

export type ErrorStat = {
  count: number;
  last: string;
  meta?: Record<string, unknown>;
};

export const errorStats: Record<string, ErrorStat> = {};

export const log = (level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: Record<string, unknown>) => {
  const timestamp = new Date().toISOString();
  const ctx = meta ? ` | ${JSON.stringify(meta)}` : '';
  logger.debug(`[${level}] ${timestamp} - ${message}${ctx}`);
};

export const logError = (key: string, meta?: Record<string, unknown>) => {
  if (!errorStats[key]) {
    errorStats[key] = { count: 0, last: new Date().toISOString(), meta };
  }
  errorStats[key].count += 1;
  errorStats[key].last = new Date().toISOString();
};

// ✅ Step 4A: normalizePath bleibt exportiert (kompatibel), delegiert final an lib/validators.normalizePath
export const normalizePath = (path: string): string => {
  if (!path || typeof path !== 'string') return '';

  // Keep legacy sanitization (removes illegal chars / control chars),
  // then delegate to lib/validators.normalizePath for canonical normalization.
  let sanitized = path
    .replace(/\r/g, '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/[<>:"|?*\x00-\x1f]/g, '');

  // Remove leading "./" segments (even multiple), and leading slashes
  sanitized = sanitized.replace(/^(\.\/)+/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  // Remove trivial traversal fragments (best-effort)
  sanitized = sanitized.replace(/\.\.\//g, '').replace(/\.\.\\/g, '').replace(/\/{2,}/g, '/');

  return libNormalizePath(sanitized);
};

export const ensureStringContent = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const getCodeLineCount = (content: string): number => {
  if (!content) return 0;
  return content.split('\n').filter((line) => line.trim().length > 0).length;
};

export const hasValidExtension = (path: string): boolean => {
  const normalized = normalizePath(path);
  return CONFIG.PATHS.ALLOWED_EXT.some((ext) => normalized.endsWith(ext));
};

/**
 * Dein CONFIG hat kein PATHS.INVALID_PATTERNS.
 * Wir halten diese Funktion als “safe guard”, aber basierend auf robusten Basics:
 * - path traversal
 * - node_modules/android/ios
 * - absolute paths
 */
export const hasInvalidPattern = (path: string): boolean => {
  const normalized = normalizePath(path);
  if (!normalized) return true;

  if (normalized.startsWith('/') || normalized.startsWith('\\')) return true;
  if (normalized.includes('..')) return true;

  const badPrefixes = ['node_modules/', 'android/', 'ios/'];
  if (badPrefixes.some((p) => normalized === p.slice(0, -1) || normalized.startsWith(p))) return true;

  return false;
};

export const isPathAllowed = (path: string): boolean => {
  const normalized = normalizePath(path);

  // root allowlist
  if (CONFIG.PATHS.ALLOWED_ROOT.includes(normalized)) return true;

  // allowed folders
  return CONFIG.PATHS.SRC_FOLDERS.some(
    (folder) => normalized === folder || normalized.startsWith(`${folder}/`),
  );
};

export const isCodeFile = (path: string): boolean => {
  const normalized = normalizePath(path);
  const okExt = CONFIG.PATHS.ALLOWED_EXT.some((ext) => normalized.endsWith(ext));
  return okExt && !normalized.endsWith('.json');
};

export const getMinLinesForFile = (normalizedPath: string): number => {
  const p = normalizedPath.toLowerCase();
  const v = CONFIG.VALIDATION;

  // du hast: MIN_LINES_TSX / MIN_LINES_TS (kein CODE_MIN_LINES)
  if (p.endsWith('.tsx') || p.endsWith('.jsx')) return v.MIN_LINES_TSX ?? 8;
  if (p.endsWith('.ts') || p.endsWith('.js')) return v.MIN_LINES_TS ?? 5;

  // fallback: nicht streng
  return 1;
};

// ✅ Step 4A: validateFilePath bleibt exportiert (kompatibel), Policy ist aber in lib/validators
export const validateFilePath = (path: string): { valid: boolean; errors: string[]; normalized: string } => {
  // Single source of truth: policy lives in lib/validators.validateFilePath
  // This wrapper exists only for backwards compatibility (other modules import from utils/chatUtils).
  const base = libValidateFilePath(path);
  const normalized = base.normalized ?? normalizePath(path);

  const errors = [...(base.errors ?? [])];

  // Extra defense-in-depth: keep legacy forbidden pattern check (even if policy already catches most)
  if (normalized && hasInvalidPattern(normalized)) {
    const already = errors.some((e) => /verbotene|muster|pattern/i.test(e));
    if (!already) errors.push(`Pfad enthält verbotene Muster: ${normalized}`);
  }

  return { valid: errors.length === 0, errors, normalized };
};

export const validateProjectFiles = (files: ProjectFile[]) => {
  const errors: string[] = [];

  if (!files || files.length === 0) {
    errors.push('Es wurden keine Dateien geliefert.');
    return { valid: false, errors };
  }

  if (files.length > CONFIG.VALIDATION.MAX_FILES) {
    errors.push(`Zu viele Dateien: ${files.length} (max. ${CONFIG.VALIDATION.MAX_FILES})`);
  }

  const seen = new Map<string, string>();

  for (const file of files) {
    const path = ensureStringContent(file?.path);
    const content = ensureStringContent(file?.content);

    const pathRes = validateFilePath(path);
    if (!pathRes.valid) {
      errors.push(...pathRes.errors.map((e) => `${path || '(leer)'}: ${e}`));
      continue;
    }

    if (!content || content.trim().length === 0) {
      errors.push(`Leerer Dateiinhalt: ${pathRes.normalized}`);
      continue;
    }

    const prev = seen.get(pathRes.normalized);
    if (prev) {
      errors.push(`Doppelter Pfad: ${pathRes.normalized} (bereits gesehen als "${prev}")`);
    } else {
      seen.set(pathRes.normalized, path);
    }

    if (isCodeFile(pathRes.normalized)) {
      const lineCount = getCodeLineCount(content);
      const minLines = getMinLinesForFile(pathRes.normalized);

      if (lineCount < minLines) {
        errors.push(`Zu wenig Code-Zeilen in ${pathRes.normalized}: ${lineCount} (min. ${minLines})`);
      }

      if (!CONFIG.VALIDATION.PATTERNS.CODE_HEURISTIC.test(content)) {
        errors.push(`Inhalt von ${pathRes.normalized} sieht nicht wie echter Code aus (Heuristik fehlgeschlagen).`);
      }
    }

    for (const placeholder of CONFIG.VALIDATION.CONTENT_PATTERNS.PLACEHOLDERS) {
      if (content.includes(placeholder)) {
        errors.push(`Platzhalter in ${pathRes.normalized} gefunden: "${placeholder}"`);
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
};

// ---------------------------------------------------------------
// JSON / LLM HELFER
// ---------------------------------------------------------------
