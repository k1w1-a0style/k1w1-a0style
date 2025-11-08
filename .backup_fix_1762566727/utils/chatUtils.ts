import { jsonrepair } from 'jsonrepair';
import { ProjectFile } from '../contexts/ProjectContext';
import { CONFIG } from '../config';

// Strukturierter Logger
const log = (level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: Record<string, any>) => {
  const timestamp = new Date().toISOString();
  const ctx = meta ? ` | ${JSON.stringify(meta)}` : '';
  console.log(`[${level}] ${timestamp} - ${message}${ctx}`);
};

// Fehlerstatistiken
const errorStats: Record<string, number> = {};
const logError = (error: string) => {
  errorStats[error] = (errorStats[error] || 0) + 1;
};

// Optimierte Zeilenzählung
export const getCodeLineCount = (content: string): number => {
  if (!content) return 0;
  let lines = 0;
  const len = content.length;
  let start = 0;
  for (let i = 0; i <= len; i++) {
    if (i === len || content[i] === '\n') {
      const line = content.slice(start, i).trim();
      if (line.length > 0) lines++;
      start = i + 1;
    }
  }
  return lines;
};

// Type-Safe Content-Konvertierung
export const ensureStringContent = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (content == null) return '';
  try {
    // Node Buffer detection defensive
    // @ts-ignore
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(content)) {
      // @ts-ignore
      return Buffer.from(content).toString('utf8');
    }
  } catch (e) {
    // ignore
  }
  if (typeof content === 'object') {
    const c = content as any;
    if (c?.content && typeof c.content === 'string') return c.content;
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return String(content);
    }
  }
  return String(content);
};

// Normalisiert Pfade sicher
export const normalizePath = (path: string): string => {
  if (!path || typeof path !== 'string') return '';
  let normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
  if (CONFIG.VALIDATION.PATTERNS.INVALID_PATH.test(normalized)) {
    log('ERROR', 'Ungültiger Pfad', { path: normalized, reason: 'Invalid characters or traversal' });
    logError('Ungültiger Pfad');
    return '';
  }
  if (normalized.length > CONFIG.PATHS.MAX_PATH_LENGTH) {
    log('ERROR', 'Pfad zu lang', { path: normalized, length: normalized.length });
    logError('Pfad zu lang');
    return '';
  }
  return normalized;
};

// Prüft, ob Pfad zu einer Code-Datei gehört
export const isCodeFile = (p?: string) => !!p && (p.endsWith('.tsx') || p.endsWith('.ts') || p.endsWith('.js') || p.endsWith('.jsx'));

// Heuristik für src-Ordner (behält Logik, um Ordner vorzuschlagen)
export const getSrcFolderForFile = (filename: string, content?: string): string | null => {
  const name = normalizePath(filename).toLowerCase();
  if (!name) return null;
  try {
    if (content) {
      if (CONFIG.VALIDATION.CONTENT_PATTERNS.CONTEXT.test(content)) return 'contexts';
      if (CONFIG.VALIDATION.CONTENT_PATTERNS.HOOK.test(content) && name.endsWith('.ts')) return 'hooks';
      if (CONFIG.VALIDATION.CONTENT_PATTERNS.STYLE.test(content)) return 'components';
    }
    if (CONFIG.VALIDATION.PATTERNS.COMPONENT.test(name)) return 'components';
    if (CONFIG.VALIDATION.PATTERNS.SCREEN.test(name)) return 'screens';
    if (CONFIG.VALIDATION.PATTERNS.CONTEXT.test(name)) return 'contexts';
    if (CONFIG.VALIDATION.PATTERNS.HOOK.test(name)) return 'hooks';
    if (CONFIG.VALIDATION.PATTERNS.UTIL.test(name)) return 'utils';
    if (CONFIG.VALIDATION.PATTERNS.SERVICE.test(name)) return 'services';
    if (CONFIG.VALIDATION.PATTERNS.TYPE.test(name) || name.endsWith('.d.ts')) return 'types';
    if (name.endsWith('.tsx')) return 'components';
    if (name.endsWith('.ts')) return 'utils';
  } catch (e) {
    log('WARN', 'getSrcFolderForFile failed', { filename, err: String(e) });
  }
  return null;
};

// Validierungs-Helfer (gekürzt für Übersicht - bestehende Logik bleibt)
const validateFileStructure = (file: ProjectFile, index: number): string[] => {
  const errors: string[] = [];
  const fileNum = `Datei ${index + 1}`;
  if (!file?.path || typeof file.content === 'undefined') {
    errors.push(`${fileNum}: Ungültige Struktur`);
    logError('Ungültige Struktur');
  }
  const normalized = normalizePath(file?.path || '');
  if (!normalized) {
    errors.push(`${file?.path || 'undefined'}: Ungültiger Pfad`);
    logError('Ungültiger Pfad');
  }
  return errors;
};

const validateDuplicatePaths = (file: ProjectFile, seenPaths: Set<string>): string[] => {
  const errors: string[] = [];
  const p = normalizePath(file?.path || '');
  if (!p) return errors;
  if (seenPaths.has(p)) {
    errors.push(`${p}: DUPLIKAT!`);
    logError('Duplikat-Pfad');
  }
  return errors;
};

const validateDuplicatePatterns = (file: ProjectFile): string[] => {
  const errors: string[] = [];
  const p = normalizePath(file?.path || '');
  if (!p) return errors;
  if (CONFIG.VALIDATION.PATTERNS.DUPLICATE.test(p)) {
    errors.push(`${p}: Verbotenes Duplikat-Pattern`);
    logError('Duplikat-Pattern');
  }
  return errors;
};

// 💥 KORRIGIERT: Validiert nun die flache Struktur ohne 'src/' Präfix.
const validateSrcFolder = (file: ProjectFile): string[] => {
  const errors: string[] = [];
  if (!file || !file.path) return errors;
  const normalizedPath = normalizePath(file.path);
  if (!normalizedPath) {
    errors.push(`${file.path}: Ungültiger Pfad`);
    logError('Ungültiger Pfad');
    return errors;
  }
  const code = isCodeFile(normalizedPath);
  const isRootFile = CONFIG.PATHS.ALLOWED_ROOT.includes(normalizedPath);

  if (code && !isRootFile) {
    const pathParts = normalizedPath.split('/');

    if (pathParts.length < 2) {
      const content = ensureStringContent(file.content);
      const suggestedFolder = getSrcFolderForFile(normalizedPath, content) ||
                             (normalizedPath.endsWith('.tsx') ? 'components' : 'utils');
      errors.push(`${normalizedPath}: ❌ MUSS in einem Ordner sein! Vorschlag: ${suggestedFolder}/${normalizedPath}`);
      logError('Kein Ordner');
      return errors;
    }

    const topFolder = pathParts[0];
    if (!CONFIG.PATHS.SRC_FOLDERS.includes(topFolder)) {
      errors.push(`${normalizedPath}: Ungültiger Ordner "${topFolder}". Erlaubt: ${CONFIG.PATHS.SRC_FOLDERS.join(', ')}`);
      logError('Ungültiger Hauptordner');
    }
  }
  return errors;
};

const validatePlaceholders = (file: ProjectFile): string[] => {
  const errors: string[] = [];
  const content = ensureStringContent(file?.content);
  CONFIG.VALIDATION.CONTENT_PATTERNS.PLACEHOLDERS.forEach(pattern => {
    if (content.includes(pattern)) {
      errors.push(`${file?.path}: PLATZHALTER gefunden: "${pattern}"`);
      logError(`Platzhalter: ${pattern}`);
    }
  });
  return errors;
};

const validateMinLines = (file: ProjectFile): string[] => {
  const errors: string[] = [];
  if (!file || !file.path) return errors;
  const normalizedPath = normalizePath(file.path);
  if (!normalizedPath) {
    errors.push(`${file.path}: Ungültiger Pfad`);
    logError('Ungültiger Pfad');
    return errors;
  }
  const code = isCodeFile(normalizedPath);
  const isNotConfig = !CONFIG.VALIDATION.PATTERNS.CONFIG_FILES.test(normalizedPath);

  if (code && isNotConfig) {
    const content = ensureStringContent(file.content);
    const lines = getCodeLineCount(content);
    const minLines = normalizedPath.endsWith('.tsx') ? CONFIG.VALIDATION.MIN_LINES_TSX : CONFIG.VALIDATION.MIN_LINES_TS;
    if (lines < minLines) {
      errors.push(`${normalizedPath}: Zu kurz (${lines} Zeilen Code, MIN ${minLines})`);
      logError('Zu wenige Zeilen');
    }
  }
  return errors;
};

const validateImportsExports = (file: ProjectFile): string[] => {
  const errors: string[] = [];
  if (!file || !file.path) return errors;
  const normalizedPath = normalizePath(file.path);
  if (!normalizedPath) return errors;
  const code = isCodeFile(normalizedPath);
  const isNotConfig = !CONFIG.VALIDATION.PATTERNS.CONFIG_FILES.test(normalizedPath);
  if (code && isNotConfig) {
    const content = ensureStringContent(file.content);
    const hasImports = /(^|\\n)\\s*import\\s+/m.test(content) ||
                      /module\\.exports/m.test(content) ||
                      /export\\s+(default|const|function|class|\\{)/m.test(content);
    if (!hasImports && content.length > 120) {
      errors.push(`${normalizedPath}: Keine erkennbaren Imports/Exports - verdächtig`);
      logError('Keine Imports/Exports');
    }
  }
  return errors;
};

const validateStyleSheet = (file: ProjectFile): string[] => {
  const errors: string[] = [];
  if (!file || !file.path) return errors;
  const normalizedPath = normalizePath(file.path);
  if (!normalizedPath) return errors;
  const content = ensureStringContent(file.content);
  if (normalizedPath.endsWith('.tsx') && content.includes('StyleSheet.create')) {
    if (/StyleSheet\\.create\\(\\s*\\{\\s*\\}\\s*\\)/.test(content)) {
      errors.push(`${normalizedPath}: Leeres StyleSheet - unvollständig`);
      logError('Leeres StyleSheet');
    }
  }
  return errors;
};

// Haupt-Validierungsfunktion
export const validateProjectFiles = (files: ProjectFile[]): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const seenPaths = new Set<string>();
  if (!Array.isArray(files) || files.length === 0) {
    return { valid: true, errors: [] };
  }

  files.forEach((file, idx) => {
    errors.push(...validateFileStructure(file, idx));
    errors.push(...validateDuplicatePaths(file, seenPaths));
    errors.push(...validateDuplicatePatterns(file));
    errors.push(...validateSrcFolder(file));
    errors.push(...validatePlaceholders(file));
    errors.push(...validateMinLines(file));
    errors.push(...validateImportsExports(file));
    errors.push(...validateStyleSheet(file));
    const n = normalizePath(file.path);
    if (n) seenPaths.add(n);
  });

  if (errors.length > 0) {
    log('INFO', `Validation errors: ${JSON.stringify(errorStats)}`);
  }

  return { valid: errors.length === 0, errors };
};

// JSON Reparatur Utilities (unverändert)
const fixUnquotedKeys = (json: string): string => {
  let inString = false;
  let result = '';
  let i = 0;

  while (i < json.length) {
    if (json[i] === '"') {
      inString = !inString;
      result += json[i];
      i++;
    } else if (!inString && json[i] === ':' && i > 0) {
      let keyStart = i - 1;
      while (keyStart >= 0 && /[\\w-]/.test(json[keyStart])) keyStart--;
      keyStart++;
      const key = json.slice(keyStart, i);
      if (key && !json[keyStart - 1]?.match(/["']/)) {
        result = result.slice(0, -key.length) + `"\${key}"`.replace('${key}', key);
      }
      result += ':';
      i++;
    } else {
      result += json[i];
      i++;
    }
  }
  return result;
};

export const tryParseJsonWithRepair = (jsonString: string): ProjectFile[] | null => {
  if (!jsonString || typeof jsonString !== 'string') {
    log('ERROR', 'Ungültiger JSON-String', { inputLength: (jsonString as any)?.length || 0 });
    logError('Ungültiger JSON-String');
    return null;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    log('WARN', 'JSON Parse Error, versuche jsonrepair...', { err: String(e) });
    try {
      const repaired = jsonrepair(jsonString);
      parsed = JSON.parse(repaired);
      log('INFO', 'JSON mit jsonrepair repariert');
    } catch (repairError) {
      log('WARN', 'jsonrepair failed, versuche konservative fixes', { err: String(repairError) });
      let r = jsonString.replace(/^\\uFEFF/, '');
      r = r.replace(/,\\s*([}\\]])/g, '$1');
      r = fixUnquotedKeys(r);
      try {
        parsed = JSON.parse(r);
        log('INFO', 'JSON konservativ repariert');
      } catch (e3) {
        log('ERROR', `JSON Reparatur fehlgeschlagen: ${e3}`);
        logError('JSON Reparatur fehlgeschlagen');
        return null;
      }
    }
  }

  if (!Array.isArray(parsed)) {
    log('ERROR', 'Kein Array empfangen');
    logError('Kein Array empfangen');
    return null;
  }

  if (parsed.length === 0) {
    log('INFO', 'Leeres Array (Agent-Ablehnung)');
    return [];
  }

  const makeUniquePath = (basePath: string, used: Set<string>): string => {
    if (!used.has(basePath)) return basePath;
    const dot = basePath.lastIndexOf('.');
    const ext = dot !== -1 ? basePath.slice(dot) : '';
    const base = dot !== -1 ? basePath.slice(0, dot) : basePath;
    let i = 1;
    let candidate = `${base}-${i}${ext}`;
    while (used.has(candidate)) {
      i++;
      candidate = `${base}-${i}${ext}`;
    }
    return candidate;
  };

  const seen = new Set<string>();
  const files: ProjectFile[] = parsed.map((file: any) => {
    let correctedPath = normalizePath(file.path);
    if (!correctedPath) {
      const fallback = `src/utils/unknown_${Date.now()}.ts`;
      log('WARN', 'Ungültiger Pfad, Fallback verwendet', { original: file.path, fallback });
      logError('Ungültiger Pfad Fallback');
      correctedPath = fallback;
    }

    if (correctedPath.startsWith('src/') && !CONFIG.PATHS.ALLOWED_ROOT.includes(correctedPath)) {
      const pathAfterSrc = correctedPath.substring(4);
      const folder = pathAfterSrc.split('/')[0];
      if (CONFIG.PATHS.SRC_FOLDERS.includes(folder)) {
        correctedPath = pathAfterSrc;
        log('INFO', `Entferne 'src/' Präfix: ${file.path} → ${correctedPath}`);
      }
    }

    if (correctedPath.startsWith('src/src/')) {
      correctedPath = correctedPath.replace('src/src/', 'src/');
      log('INFO', `Doppeltes src/ entfernt: ${correctedPath}`);
    }

    const content = ensureStringContent(file.content);
    const unique = makeUniquePath(correctedPath, seen);
    seen.add(unique);
    return { ...file, path: unique, content } as ProjectFile;
  });

  const validation = validateProjectFiles(files);
  if (!validation.valid) {
    log('ERROR', 'VALIDIERUNG FEHLGESCHLAGEN:');
    validation.errors.forEach((err, idx) => {
      log('ERROR', `${idx + 1}. ${err}`);
    });
    return null;
  }

  log('INFO', `Validierung OK: ${files.length} Dateien`);
  return files;
};

export const extractJsonArray = (text: string): string | null => {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/```json\\s*(\[\\s\\S]*\)\\s*```|(\\[[\\s\\S]*\\])/);
  if (!match) return null;

  const jsonString = match[1] || match[2];
  if (jsonString) {
    log('INFO', `JSON gefunden (${jsonString.length} chars)`);
    return jsonString;
  }
  return null;
};

export const getErrorStats = () => ({ ...errorStats });
