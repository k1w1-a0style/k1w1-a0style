import { jsonrepair } from 'jsonrepair';
import { ProjectFile } from '../contexts/types';
import { CONFIG } from '../config';

type ErrorStat = {
  count: number;
  last: string;
  meta?: any;
};

const errorStats: Record<string, ErrorStat> = {};

const log = (
  level: 'INFO' | 'WARN' | 'ERROR',
  message: string,
  meta?: Record<string, any>
) => {
  const timestamp = new Date().toISOString();
  const ctx = meta ? ` | ${JSON.stringify(meta)}` : '';
  console.log(`[${level}] ${timestamp} - ${message}${ctx}`);
};

const logError = (key: string, meta?: any) => {
  if (!errorStats[key]) {
    errorStats[key] = { count: 0, last: new Date().toISOString(), meta };
  }
  errorStats[key].count += 1;
  errorStats[key].last = new Date().toISOString();
};

// ---------------------------------------------------------------
// BASIC HELPERS
// ---------------------------------------------------------------

export const normalizePath = (path: string): string => {
  if (!path) return '';
  let normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/');

  if (normalized.startsWith('./')) normalized = normalized.slice(2);
  if (normalized.startsWith('/')) normalized = normalized.slice(1);

  // einfache Sicherheits-Normalisierung: "../" kappen
  normalized = normalized.replace(/\.\.\//g, '');

  return normalized;
};

export const ensureStringContent = (value: any): string => {
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
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const normalized = normalizePath(path);

  if (!normalized) errors.push('Pfad ist leer oder ungültig.');
  if (!hasValidExtension(normalized))
    errors.push(`Ungültige Dateiendung: ${normalized}`);
  if (!isPathAllowed(normalized))
    errors.push(`Pfad außerhalb erlaubter Bereiche: ${normalized}`);
  if (hasInvalidPattern(normalized))
    errors.push(`Pfad enthält verbotene Muster: ${normalized}`);

  return { valid: errors.length === 0, errors };
};

export const validateProjectFiles = (files: ProjectFile[]) => {
  const errors: string[] = [];

  if (!files || files.length === 0) {
    errors.push('Es wurden keine Dateien geliefert.');
    return { valid: false, errors };
  }

  if (files.length > CONFIG.VALIDATION.MAX_FILES) {
    errors.push(
      `Zu viele Dateien: ${files.length} (max. ${CONFIG.VALIDATION.MAX_FILES})`
    );
  }

  const seen = new Set<string>();

  for (const file of files) {
    const path = file.path;
    const content = ensureStringContent(file.content);

    const { valid, errors: pathErrors } = validateFilePath(path);
    if (!valid)
      errors.push(`Pfad ungültig (${path}): ${pathErrors.join(' | ')}`);

    if (seen.has(path)) {
      errors.push(`Duplikat-Pfad: ${path}`);
    } else {
      seen.add(path);
    }

    if (CONFIG.VALIDATION.PATTERNS.FORBIDDEN_IMPORT.test(content)) {
      errors.push(`Verbotenes Import-Muster in ${path} gefunden.`);
    }

    if (content.trim().length === 0) {
      errors.push(`Datei ist leer: ${path}`);
    }
  }

  return { valid: errors.length === 0, errors };
};

// ---------------------------------------------------------------
// JSON / LLM HELFER
// ---------------------------------------------------------------

export const safeJsonParse = <T = any>(input: any): T | null => {
  try {
    if (!input) return null;
    if (typeof input === 'object') return input as T;

    const repaired = jsonrepair(String(input));
    return JSON.parse(repaired) as T;
  } catch (e: any) {
    log('ERROR', 'JSON Parse fehlgeschlagen', { error: e.message });
    logError('JSON Parse fehlgeschlagen', e.message);
    return null;
  }
};

export const extractJsonArray = (text: string): string | null => {
  if (!text) return null;

  const block = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (block) return block[1];

  const generic = text.match(/```\s*([\s\S]*?)\s*```/);
  if (generic) return generic[1];

  const arr = text.match(/\[[\s\S]*\]/);
  if (arr) return arr[0];

  const obj = text.match(/\{[\s\S]*\}$/);
  if (obj) return obj[0];

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
  files: ProjectFile[]
): ProjectFile[] | null => {
  if (!files || files.length === 0) {
    log('ERROR', 'Keine Dateien für Validierung übergeben.');
    logError('Keine Dateien');
    return null;
  }

  const normalized = files.map((f) => ({
    path: normalizePath(f.path),
    content: ensureStringContent(f.content).replace(/^\uFEFF/, ''),
  }));

  const validation = validateProjectFiles(normalized as ProjectFile[]);

  if (!validation.valid) {
    log('ERROR', 'VALIDIERUNG FEHLGESCHLAGEN', { errors: validation.errors });
    validation.errors.forEach((e) => logError(e));
    return null;
  }

  log('INFO', `Validierung OK: ${normalized.length} Dateien`);
  return normalized as ProjectFile[];
};

export const getErrorStats = () => ({ ...errorStats });
