// lib/normalizer.ts
// Macht aus der KI-/Handler-Antwort ein sauberes Array von { path, content }.
// Erkennt verschiedene Response-Formate und validiert dann über chatUtils.

import {
  normalizePath,
  safeJsonParse,
  normalizeAndValidateFiles,
  ensureStringContent,
  extractJsonArray,
  isJsonTruncated,
  NormalizedValidationResult,
} from '../utils/chatUtils';
import { ProjectFile } from '../contexts/types';

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
    const candidates = ['files', 'data', 'json', 'output', 'result', 'response', 'responses'];
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
export function normalizeAiResponse(raw: any): NormalizedValidationResult {
  if (!raw) {
    return {
      ok: false,
      errors: ['KI-Antwort war leer – keine Dateien zum Verarbeiten.'],
    };
  }

  let parsed: any = null;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    
    // Check if response appears truncated
    if (isJsonTruncated(trimmed)) {
      console.log('[Normalizer] ⚠️ Response appears to be truncated (incomplete JSON)');
      return {
        ok: false,
        errors: [
          'Die KI-Antwort wurde abgeschnitten (Token-Limit erreicht).',
          'Bitte stelle eine kürzere Anfrage oder frage nur nach wenigen Dateien.',
        ],
      };
    }
    
    const extracted = extractJsonArray(trimmed);
    const candidate = extracted || trimmed;

    parsed = safeJsonParse(candidate);

    if (!parsed && extracted) {
      parsed = safeJsonParse(extracted);
    }
  } else if (typeof raw === 'object') {
    parsed = raw;
  } else {
    return {
      ok: false,
      errors: ['KI-Antwort konnte nicht interpretiert werden (unbekanntes Format).'],
    };
  }

  if (!parsed) {
    return {
      ok: false,
      errors: [
        'KI-Antwort enthielt kein valides JSON-Array.',
        'Möglicherweise wurde die Antwort abgeschnitten – versuche eine einfachere Anfrage.',
      ],
    };
  }

  const fileArray = extractFileArray(parsed);
  if (!fileArray || !Array.isArray(fileArray) || fileArray.length === 0) {
    console.log('[Normalizer] ❌ Keine gültige File-Liste im Handler-Output gefunden');
    return {
      ok: false,
      errors: ['In der KI-Antwort wurden keine Dateien gefunden.'],
    };
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
    (f) => (f.content || '').toString().trim().length > 0,
  );

  if (nonEmpty.length === 0) {
    return {
      ok: false,
      errors: ['Alle gelieferten Dateien waren leer oder ungültig.'],
    };
  }

  const validationResult = normalizeAndValidateFiles(
    nonEmpty.map<ProjectFile>((f) => ({
      path: f.path as string,
      content: f.content,
    })),
  );

  if (!validationResult.ok) {
    console.log('[Normalizer] ❌ Validation failed oder leeres Ergebnis', {
      errors: validationResult.errors,
    });
    return validationResult;
  }

  console.log('[Normalizer] ✅ Dateien normalisiert:', validationResult.files.length);
  return validationResult;
}
