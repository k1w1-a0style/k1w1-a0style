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

// ---------------------------------------------------------------
// BASIC HELPERS
// ---------------------------------------------------------------

/**
 * Normalisiert einen Dateipfad und entfernt gefährliche Zeichen
 * @param path - Der zu normalisierende Pfad
 * @returns Normalisierter, sicherer Pfad
 */
export const normalizePath = (path: string): string => {
  if (!path || typeof path !== 'string') return '';
  
  // Entferne gefährliche Zeichen und normalisiere Pfad-Trenner
  let normalized = path
    .replace(/\\/g, '/')           // Backslashes zu Forward Slashes
    .replace(/\/+/g, '/')          // Mehrfache Slashes zu einem
    .replace(/[<>:"|?*\x00-\x1f]/g, '') // Entferne verbotene Zeichen
    .trim();

  // Entferne führende/trailing Slashes und "./"
  if (normalized.startsWith('./')) normalized = normalized.slice(2);
  if (normalized.startsWith('/')) normalized = normalized.slice(1);
  if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);

  // KRITISCH: Path Traversal-Schutz - entferne alle "../" Sequenzen
  // Auch nach Normalisierung, falls sie durch Encoding umgangen wurden
  normalized = normalized
    .replace(/\.\.\//g, '')        // "../"
    .replace(/\.\.\\/g, '')        // "..\" (falls noch vorhanden)
    .replace(/\.\./g, '')          // ".." allein
    .replace(/\/\.\//g, '/')       // "/./"
    .replace(/\/\.$/g, '');        // "/." am Ende

  // Entferne leere Segmente
  const parts = normalized.split('/').filter(part => part.length > 0 && part !== '.');
  normalized = parts.join('/');

  return normalized;
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

/**
 * Validiert einen Dateipfad auf Sicherheit und Gültigkeit
 * @param path - Der zu validierende Pfad
 * @returns Validierungsergebnis mit Fehlern
 */
export const validateFilePath = (
  path: string
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!path || typeof path !== 'string') {
    errors.push('Pfad ist leer oder kein String.');
    return { valid: false, errors };
  }

  // Maximale Pfadlänge prüfen
  if (path.length > CONFIG.PATHS.MAX_PATH_LENGTH) {
    errors.push(`Pfad zu lang: ${path.length} Zeichen (max. ${CONFIG.PATHS.MAX_PATH_LENGTH})`);
  }

  // Normalisiere und prüfe auf Path Traversal-Versuche
  const normalized = normalizePath(path);
  
  // Prüfe ob nach Normalisierung noch gefährliche Muster vorhanden sind
  if (normalized.includes('..')) {
    errors.push('Pfad enthält Path Traversal-Versuche (../)');
  }
  
  if (normalized !== path && path.includes('..')) {
    errors.push('Pfad wurde normalisiert - möglicher Path Traversal-Versuch erkannt');
  }

  if (!normalized) {
    errors.push('Pfad ist nach Normalisierung leer.');
    return { valid: false, errors };
  }

  // Prüfe auf verbotene Zeichen (sollten bereits durch normalizePath entfernt sein)
  if (/[<>:"|?*\x00-\x1f]/.test(normalized)) {
    errors.push('Pfad enthält verbotene Zeichen');
  }

  // Prüfe auf erlaubte Dateiendungen
  if (!hasValidExtension(normalized)) {
    errors.push(`Ungültige Dateiendung: ${normalized}`);
  }

  // Prüfe auf erlaubte Pfade
  if (!isPathAllowed(normalized)) {
    errors.push(`Pfad außerhalb erlaubter Bereiche: ${normalized}`);
  }

  // Prüfe auf weitere verbotene Muster
  if (hasInvalidPattern(normalized)) {
    errors.push(`Pfad enthält verbotene Muster: ${normalized}`);
  }

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
    const normalizedPath = normalizePath(path);
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

    // -----------------------------------------------------------
    // 🔍 MINDESTZEILEN & "ECHTER CODE" (nur für Code-Dateien)
    // -----------------------------------------------------------
    const isTsx = normalizedPath.endsWith('.tsx');
    const isTsOrJs =
      normalizedPath.endsWith('.ts') ||
      normalizedPath.endsWith('.js') ||
      normalizedPath.endsWith('.jsx');
    const isConfigLike =
      CONFIG.VALIDATION.PATTERNS.CONFIG_FILES.test(normalizedPath);

    if ((isTsx || isTsOrJs) && !isConfigLike) {
      const lineCount = getCodeLineCount(content);
      const minLines = isTsx
        ? CONFIG.VALIDATION.MIN_LINES_TSX
        : CONFIG.VALIDATION.MIN_LINES_TS;

      if (lineCount < minLines) {
        errors.push(
          `Zu wenig Code-Zeilen in ${path}: ${lineCount} (min. ${minLines})`
        );
      }

      // Heuristik: sieht der Inhalt wie echter Code aus?
      if (!CONFIG.VALIDATION.PATTERNS.CODE_HEURISTIC.test(content)) {
        errors.push(
          `Inhalt von ${path} sieht nicht wie echter Code aus (Heuristik fehlgeschlagen).`
        );
      }
    }

    // -----------------------------------------------------------
    // 🧱 Platzhalter-Texte erkennen (für alle Dateien)
    // -----------------------------------------------------------
    for (const placeholder of CONFIG.VALIDATION.CONTENT_PATTERNS
      .PLACEHOLDERS) {
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

export const safeJsonParse = <T = unknown>(input: unknown): T | null => {
  try {
    if (!input) return null;
    if (typeof input === 'object') return input as T;

    const repaired = jsonrepair(String(input));
    return JSON.parse(repaired) as T;
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    log('ERROR', 'JSON Parse fehlgeschlagen', { error: errorMessage });
    logError('JSON Parse fehlgeschlagen', { error: errorMessage });
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

// ---------------------------------------------------------------
// XSS PROTECTION HELPERS
// ---------------------------------------------------------------

/**
 * Escaped HTML-Zeichen zur Verhinderung von XSS
 * @param text - Der zu escapende Text
 * @returns Escaped Text
 */
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

/**
 * Sanitized Text für sichere Anzeige
 * Entfernt gefährliche HTML-Tags und JavaScript
 * @param text - Der zu bereinigende Text
 * @returns Bereinigter Text
 */
export function sanitizeForDisplay(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  // Entferne script, iframe und andere gefährliche Tags
  let sanitized = text
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<applet[^>]*>.*?<\/applet>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<link[^>]*>/gi, '');
  
  // Entferne javascript: und data: URLs
  sanitized = sanitized
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '');
  
  // Entferne on* Event-Handler
  sanitized = sanitized.replace(/\son\w+\s*=/gi, ' data-blocked=');
  
  return sanitized;
}

/**
 * Validiert ob ein Text sichere Anzeige erlaubt
 * @param text - Der zu prüfende Text
 * @returns Validierungsergebnis
 */
export function validateSafeDisplay(text: string): {
  safe: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  if (!text || typeof text !== 'string') {
    return { safe: true, issues: [] };
  }
  
  // Prüfe auf gefährliche Patterns
  if (/<script[^>]*>/i.test(text)) {
    issues.push('Script-Tag gefunden');
  }
  
  if (/<iframe[^>]*>/i.test(text)) {
    issues.push('iFrame-Tag gefunden');
  }
  
  if (/javascript:/i.test(text)) {
    issues.push('JavaScript-URL gefunden');
  }
  
  if (/on\w+\s*=/i.test(text)) {
    issues.push('Event-Handler gefunden');
  }
  
  if (/<object[^>]*>/i.test(text) || /<embed[^>]*>/i.test(text)) {
    issues.push('Object/Embed-Tag gefunden');
  }
  
  return {
    safe: issues.length === 0,
    issues,
  };
}

export const getErrorStats = () => ({ ...errorStats });
