import { jsonrepair } from 'jsonrepair';
import { ProjectFile } from '../contexts/types';
import { CONFIG } from '../config';
import { normalizePath as libNormalizePath, validateFilePath as libValidateFilePath } from '../lib/validators';

type ErrorStat = {
  count: number;
  last: string;
  meta?: Record<string, unknown>;
};

const errorStats: Record<string, ErrorStat> = {};

const log = (level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: Record<string, unknown>) => {
  const timestamp = new Date().toISOString();
  const ctx = meta ? ` | ${JSON.stringify(meta)}` : '';
  console.log(`[${level}] ${timestamp} - ${message}${ctx}`);
};

const logError = (key: string, meta?: Record<string, unknown>) => {
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

const getMinLinesForFile = (normalizedPath: string): number => {
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
type SafeJsonOpts = { silent?: boolean };

const extractBalanced = (text: string, open: string, close: string): string | null => {
  let inString = false;
  let escape = false;
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === open) {
      if (depth === 0) start = i;
      depth++;
      continue;
    }

    if (ch === close) {
      depth--;
      if (depth === 0 && start >= 0) return text.slice(start, i + 1);
    }
  }

  return null;
};

export const safeJsonParse = <T = unknown>(input: unknown, opts: SafeJsonOpts = {}): T | null => {
  try {
    if (input === null || input === undefined) return null;
    if (typeof input === 'object') return input as T;

    const repaired = jsonrepair(String(input));
    return JSON.parse(repaired) as T;
  } catch (e: unknown) {
    if (!opts.silent) {
      const msg = e instanceof Error ? e.message : String(e);
      log('WARN', 'JSON Parse failed', { error: msg });
      logError('JSON Parse failed', { error: msg });
    }
    return null;
  }
};

export const safeJsonParseSilent = <T = unknown>(input: unknown): T | null => safeJsonParse<T>(input, { silent: true });

export const extractJsonArray = (text: string): string | null => {
  if (!text) return null;

  const jsonBlock = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonBlock && jsonBlock[1]) return jsonBlock[1];

  const generic = text.match(/```\s*([\s\S]*?)\s*```/);
  if (generic && generic[1]) return generic[1];

  const arr = extractBalanced(text, '[', ']');
  if (arr) return arr;

  return null;
};

export const isJsonTruncated = (text: string): boolean => {
  if (!text) return false;
  const t = text.trim();

  if (t.endsWith('...')) return true;

  const openBrackets = (t.match(/\[/g) || []).length;
  const closeBrackets = (t.match(/\]/g) || []).length;

  const openBraces = (t.match(/\{/g) || []).length;
  const closeBraces = (t.match(/\}/g) || []).length;

  if (openBrackets !== closeBrackets) return true;
  if (openBraces !== closeBraces) return true;

  return false;
};

export const filterProjectCodeFiles = (files: ProjectFile[]) => {
  if (!files) return [];
  return files.filter((f) => isCodeFile(f.path));
};

export const normalizeAndValidateFiles = (files: ProjectFile[], opts: { silent?: boolean } = {}): ProjectFile[] | null => {
  if (!files || files.length === 0) {
    if (!opts.silent) {
      log('ERROR', 'Keine Dateien für Validierung übergeben.');
      logError('Keine Dateien');
    }
    return null;
  }

  const validation = validateProjectFiles(files);

  if (!validation.valid) {
    if (!opts.silent) {
      log('ERROR', 'VALIDIERUNG FEHLGESCHLAGEN', { errors: validation.errors });
      validation.errors.forEach((e) => logError(e));
    }
    return null;
  }

  const normalized = files.map((f) => ({
    path: normalizePath(f.path),
    content: ensureStringContent(f.content).replace(/^\uFEFF/, ''),
  }));

  if (!opts.silent) log('INFO', `Validierung OK: ${normalized.length} Dateien`);
  return normalized as ProjectFile[];
};

// ---------------------------------------------------------------
// XSS PROTECTION HELPERS
// ---------------------------------------------------------------
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeForDisplay(text: string): { sanitized: string; hadXSS: boolean } {
  if (!text || typeof text !== 'string') return { sanitized: '', hadXSS: false };

  const hadXSS =
    /<script[^>]*>/i.test(text) ||
    /<iframe[^>]*>/i.test(text) ||
    /javascript:/i.test(text) ||
    /on\w+\s*=/i.test(text) ||
    /<object[^>]*>/i.test(text) ||
    /<embed[^>]*>/i.test(text);

  // Minimal neutralization (display only)
  const sanitized = escapeHtml(text);
  return { sanitized, hadXSS };
}

export function validateSafeDisplay(text: string): { safe: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!text || typeof text !== 'string') return { safe: true, issues: [] };

  if (/<script[^>]*>/i.test(text)) issues.push('Script-Tag gefunden');
  if (/<iframe[^>]*>/i.test(text)) issues.push('iFrame-Tag gefunden');
  if (/javascript:/i.test(text)) issues.push('JavaScript-URL gefunden');
  if (/on\w+\s*=/i.test(text)) issues.push('Event-Handler gefunden');
  if (/<object[^>]*>/i.test(text) || /<embed[^>]*>/i.test(text)) issues.push('Object/Embed-Tag gefunden');

  return { safe: issues.length === 0, issues };
}

export const getErrorStats = () => ({ ...errorStats });
