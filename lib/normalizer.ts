// lib/normalizer.ts
// Macht aus der KI-/Handler-Antwort ein sauberes Array von { path, content }.
// Erkennt verschiedene Response-Formate und validiert dann über chatUtils.

import {
  normalizePath,
  safeJsonParse,
  normalizeAndValidateFiles,
  ensureStringContent,
} from '../utils/chatUtils';

// Minimale Struktur, die wir erwarten
interface RawFile {
  path?: string;
  content?: any;
  [key: string]: any;
}

/**
 * Versucht, aus beliebigem JSON die tatsächliche File-Liste zu extrahieren.
 *
 * Unterstützte Formen:
 * - [ { path, content }, ... ]
 * - { files: [ { path, content }, ... ] }
 * - { data: [ { path, content }, ... ] }
 * - { json: [ { path, content }, ... ] }
 * - { output: [ { path, content }, ... ] }
 * - { result: [ { path, content }, ... ] }
 */
function extractFileArray(parsed: any): RawFile[] | null {
  if (!parsed) return null;

  if (Array.isArray(parsed)) {
    return parsed as RawFile[];
  }

  if (typeof parsed === 'object') {
    const candidates = ['files', 'data', 'json', 'output', 'result'];
    for (const key of candidates) {
      const value = (parsed as any)[key];
      if (Array.isArray(value)) {
        return value as RawFile[];
      }
    }
  }

  return null;
}

/**
 * Normalizer für KI-/Handlerantworten
 * - akzeptiert string oder object
 * - extrahiert das File-Array
 * - bereinigt Pfade und Inhalte
 * - ruft am Ende normalizeAndValidateFiles() aus chatUtils
 */
export function normalizeAiResponse(raw: any): any[] | null {
  if (!raw) return null;

  let parsed: any = null;

  if (typeof raw === 'string') {
    parsed = safeJsonParse(raw);
  } else if (typeof raw === 'object') {
    parsed = raw;
  } else {
    return null;
  }

  const fileArray = extractFileArray(parsed);
  if (!fileArray || !Array.isArray(fileArray) || fileArray.length === 0) {
    console.log(
      '[Normalizer] ❌ Keine gültige File-Liste im Handler-Output gefunden'
    );
    return null;
  }

  // BOM / Control Cleanup + sicheres String-Handling
  const cleaned: RawFile[] = fileArray.map((f) => {
    const path = normalizePath(f.path || '');
    const rawContent = ensureStringContent(f.content ?? '');
    const content = rawContent
      .replace(/^\uFEFF/, '') // BOM entfernen
      .replace(/\x00/g, ''); // Nullbytes entfernen

    return { ...f, path, content };
  });

  // Duplikate entfernen
  const seen = new Set<string>();
  const unique: RawFile[] = [];

  for (const f of cleaned) {
    if (!f.path) continue;
    if (!seen.has(f.path)) {
      seen.add(f.path);
      unique.push(f);
    }
  }

  // Leere Inhalte raus
  const nonEmpty = unique.filter(
    (f) => (f.content || '').toString().trim().length > 0
  );

  const validated = normalizeAndValidateFiles(
    nonEmpty.map((f) => ({
      path: f.path as string,
      content: f.content,
    })) as any
  );

  if (!validated || !Array.isArray(validated) || validated.length === 0) {
    console.log('[Normalizer] ❌ Validation failed oder leeres Ergebnis');
    return null;
  }

  console.log('[Normalizer] ✅ Dateien normalisiert:', validated.length);
  return validated;
}
