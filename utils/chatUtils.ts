import { jsonrepair } from 'jsonrepair';
import { ProjectFile } from '../contexts/types';
import { CONFIG } from '../config';

type ErrorStat = {
  count: number;
  last: string;
  meta?: Record<string, unknown>;
};

const errorStats: Record<string, ErrorStat> = {};

const log = (
  level: 'INFO' | 'WARN' | 'ERROR',
  message: string,
  meta?: Record<string, unknown>
) => {
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

export const normalizePath = (path: string): string => {
  if (!path || typeof path !== 'string') return '';

  let normalized = path
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/[<>:"|?*\x00-\x1f]/g, '')
    .trim();

  if (normalized.startsWith('./')) normalized = normalized.slice(2);
  if (normalized.startsWith('/')) normalized = normalized.slice(1);
  if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);

  normalized = normalized
    .replace(/\.\.\//g, '')
    .replace(/\.\.\\/g, '')
    .replace(/\.\./g, '')
    .replace(/\/\.\//g, '/')
    .replace(/\/\.$/g, '');

  const parts = normalized
    .split('/')
    .filter(part => part.length > 0 && part !== '.');

  return parts.join('/');
};

export const ensureStringContent = (value: unknown): string => {
  if (value == null) return '';
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

export const hasInvalidPattern = (path: string): boolean => {
  const normalized = normalizePath(path);
  return CONFIG.VALIDATION.PATTERNS.INVALID_PATH.test(normalized);
};

export const isPathAllowed = (path: string): boolean => {
  const normalized = normalizePath(path);
  if (CONFIG.PATHS.ALLOWED_ROOT.includes(normalized)) return true;
  if (CONFIG.PATHS.ALLOWED_SINGLE.includes(normalized)) return true;
  for (const prefix of CONFIG.PATHS.ALLOWED_PREFIXES) {
    if (normalized.startsWith(prefix)) return true;
  }
  return false;
};

export const isCodeFile = (path: string): boolean => {
  const normalized = normalizePath(path);
  return (
    normalized.endsWith('.ts') ||
    normalized.endsWith('.tsx') ||
    normalized.endsWith('.js') ||
    normalized.endsWith('.jsx') ||
    normalized.endsWith('.json') ||
    normalized.endsWith('.md')
  );
};

// ---------------------------------------------------------------
// VALIDIERUNG
// ---------------------------------------------------------------
export const validateFilePath = (
  path: string
): { valid: boolean; errors: string[]; normalized: string } => {
  const errors: string[] = [];

  if (!path || typeof path !== 'string') {
    errors.push('Pfad ist leer oder kein String.');
    return { valid: false, errors, normalized: '' };
  }

  if (path.length > CONFIG.PATHS.MAX_PATH_LENGTH) {
    errors.push(
      `Pfad zu lang: ${path.length} Zeichen (max. ${CONFIG.PATHS.MAX_PATH_LENGTH})`
    );
  }

  const normalized = normalizePath(path);

  if (normalized.includes('..')) {
    errors.push('Pfad enthält Path Traversal-Versuche (../)');
  }

  if (normalized !== path && path.includes('..')) {
    errors.push('Pfad wurde normalisiert - möglicher Path Traversal-Versuch erkannt');
  }

  if (!normalized) {
    errors.push('Pfad ist nach Normalisierung leer.');
    return { valid: false, errors, normalized: '' };
  }

  if (/[<>:"|?*\x00-\x1f]/.test(normalized)) {
    errors.push('Pfad enthält verbotene Zeichen');
  }

  if (!hasValidExtension(normalized)) {
    errors.push(`Ungültige Dateiendung: ${normalized}`);
  }

  if (!isPathAllowed(normalized)) {
    errors.push(`Pfad außerhalb erlaubter Bereiche: ${normalized}`);
  }

  if (hasInvalidPattern(normalized)) {
    errors.push(`Pfad enthält verbotene Muster: ${normalized}`);
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
    const path = file.path;
    const normalizedPath = normalizePath(path);
    const content = ensureStringContent(file.content);

    const { valid, errors: pathErrors } = validateFilePath(path);
    if (!valid) errors.push(`Pfad ungültig (${path}): ${pathErrors.join(' | ')}`);

    const duplicateOf = seen.get(normalizedPath);
    if (duplicateOf) {
      errors.push(`Duplikat-Pfad: ${path} (entspricht ${duplicateOf})`);
    } else {
      seen.set(normalizedPath, path);
    }

    if (CONFIG.VALIDATION.PATTERNS.FORBIDDEN_IMPORT.test(content)) {
      errors.push(`Verbotenes Import-Muster in ${path} gefunden.`);
    }

    if (content.trim().length === 0) {
      errors.push(`Datei ist leer: ${path}`);
    }

    const isTsx = normalizedPath.endsWith('.tsx');
    const isTsOrJs =
      normalizedPath.endsWith('.ts') ||
      normalizedPath.endsWith('.js') ||
      normalizedPath.endsWith('.jsx');
    const isConfigLike = CONFIG.VALIDATION.PATTERNS.CONFIG_FILES.test(normalizedPath);

    if ((isTsx || isTsOrJs) && !isConfigLike) {
      const lineCount = getCodeLineCount(content);
      const minLines = isTsx ? CONFIG.VALIDATION.MIN_LINES_TSX : CONFIG.VALIDATION.MIN_LINES_TS;

      if (lineCount < minLines) {
        errors.push(`Zu wenig Code-Zeilen in ${path}: ${lineCount} (min. ${minLines})`);
      }

      if (!CONFIG.VALIDATION.PATTERNS.CODE_HEURISTIC.test(content)) {
        errors.push(`Inhalt von ${path} sieht nicht wie echter Code aus (Heuristik fehlgeschlagen).`);
      }
    }

    for (const placeholder of CONFIG.VALIDATION.CONTENT_PATTERNS.PLACEHOLDERS) {
      if (content.includes(placeholder)) {
        errors.push(`Platzhalter in ${path} gefunden: "${placeholder}"`);
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

export const safeJsonParse = <T = unknown>(input: unknown, opts: SafeJsonOpts = {}): T | null => {
  try {
    if (!input) return null;
    if (typeof input === 'object') return input as T;
    const repaired = jsonrepair(String(input));
    return JSON.parse(repaired) as T;
  } catch (e: unknown) {
    if (!opts.silent) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      log('ERROR', 'JSON Parse fehlgeschlagen', { error: errorMessage });
      logError('JSON Parse fehlgeschlagen', { error: errorMessage });
    }
    return null;
  }
};

export const safeJsonParseSilent = <T = unknown>(input: unknown): T | null =>
  safeJsonParse<T>(input, { silent: true });

// Balanced extraction (nicht greedy)
function extractBalanced(text: string, open: '{' | '[', close: '}' | ']'): string | null {
  const start = text.indexOf(open);
  if (start < 0) return null;

  let inString = false;
  let escape = false;
  let depth = 0;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') { inString = true; continue; }
    if (ch === open) depth++;
    if (ch === close) depth--;

    if (depth === 0 && i > start) {
      return text.slice(start, i + 1);
    }
  }

  // Unbalanced -> gib den Rest zurück (kann truncate sein)
  return text.slice(start);
}

export const extractJsonArray = (text: string): string | null => {
  if (!text) return null;

  // fenced json
  const block = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (block) return block[1];

  // fenced generic
  const generic = text.match(/```\s*([\s\S]*?)\s*```/);
  if (generic) return generic[1];

  // balanced [] zuerst
  const arr = extractBalanced(text, '[', ']');
  if (arr) return arr;

  // dann balanced {}
  const obj = extractBalanced(text, '{', '}');
  if (obj) return obj;

  return null;
};

// ---------------------------------------------------------------
// FILTER / NORMALIZE
// ---------------------------------------------------------------
export const filterProjectCodeFiles = (files: ProjectFile[]): ProjectFile[] => {
  if (!files || files.length === 0) return [];
  const result: ProjectFile[] = [];

  for (const f of files) {
    const p = normalizePath(f.path);
    const c = ensureStringContent(f.content);

    if (!hasValidExtension(p)) continue;
    if (hasInvalidPattern(p)) continue;
    if (!CONFIG.VALIDATION.PATTERNS.CODE_HEURISTIC.test(c)) continue;

    result.push({ path: p, content: c });
  }

  return result;
};

export const normalizeAndValidateFiles = (
  files: ProjectFile[],
  opts: { silent?: boolean } = {}
): ProjectFile[] | null => {
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
export function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => htmlEscapes[char] || char);
}

export function sanitizeForDisplay(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let sanitized = text
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<applet[^>]*>.*?<\/applet>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<link[^>]*>/gi, '');

  sanitized = sanitized
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '');

  sanitized = sanitized.replace(/\son\w+\s*=/gi, ' data-blocked=');

  return sanitized;
}

export function validateSafeDisplay(text: string): {
  safe: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!text || typeof text !== 'string') {
    return { safe: true, issues: [] };
  }

  if (/<script[^>]*>/i.test(text)) issues.push('Script-Tag gefunden');
  if (/<iframe[^>]*>/i.test(text)) issues.push('iFrame-Tag gefunden');
  if (/javascript:/i.test(text)) issues.push('JavaScript-URL gefunden');
  if (/on\w+\s*=/i.test(text)) issues.push('Event-Handler gefunden');
  if (/<object[^>]*>/i.test(text) || /<embed[^>]*>/i.test(text)) {
    issues.push('Object/Embed-Tag gefunden');
  }

  return { safe: issues.length === 0, issues };
}

export const getErrorStats = () => ({ ...errorStats });
