// lib/normalizer.ts
// Normalisiert KI/Handler-Antwort -> Array { path, content }
// ✅ Fix: kein "konnte nicht verarbeiten", weil wir bei strenger Validation notfalls lenient zurückgeben
// ✅ Fix: silent parsing + balanced JSON extraction via chatUtils

import {
  normalizePath,
  safeJsonParseSilent,
  normalizeAndValidateFiles,
  ensureStringContent,
  extractJsonArray,
  hasValidExtension,
  hasInvalidPattern,
  isPathAllowed,
} from '../utils/chatUtils';

type RawFile = {
  path?: string;
  filename?: string;
  content?: any;
  contents?: any;
  text?: any;
  code?: any;
  [key: string]: any;
};

function pickContent(f: RawFile): string {
  const v = f.content ?? f.contents ?? f.text ?? f.code ?? '';
  return ensureStringContent(v);
}

function extractFileArray(parsed: any): RawFile[] | null {
  if (!parsed) return null;

  if (Array.isArray(parsed)) return parsed as RawFile[];

  if (typeof parsed === 'object') {
    const candidates = ['files', 'data', 'json', 'output', 'result'];
    for (const key of candidates) {
      const value = (parsed as any)[key];
      if (Array.isArray(value)) return value as RawFile[];
    }

    // Map form: { files: { "a.ts": "..." } }
    if (parsed.files && typeof parsed.files === 'object' && !Array.isArray(parsed.files)) {
      return Object.entries(parsed.files).map(([path, content]) => ({ path, content }));
    }
  }

  return null;
}

function unwrapToParsable(raw: any): any {
  if (!raw) return null;

  // OrchestratorResult { text: "..." }
  if (typeof raw === 'object' && typeof raw.text === 'string') {
    const s = raw.text;
    const jsonBlock = extractJsonArray(s) ?? s;
    return safeJsonParseSilent(jsonBlock) ?? raw;
  }

  // OpenAI responses { output_text: "..." }
  if (typeof raw === 'object' && typeof raw.output_text === 'string') {
    const s = raw.output_text;
    const jsonBlock = extractJsonArray(s) ?? s;
    return safeJsonParseSilent(jsonBlock) ?? raw;
  }

  // raw string
  if (typeof raw === 'string') {
    const jsonBlock = extractJsonArray(raw) ?? raw;
    return safeJsonParseSilent(jsonBlock);
  }

  return raw;
}

export function normalizeAiResponse(raw: any): Array<{ path: string; content: string }> | null {
  const parsed = unwrapToParsable(raw);
  if (!parsed) return null;

  const fileArray = extractFileArray(parsed);
  if (!fileArray || fileArray.length === 0) return null;

  const cleaned = fileArray
    .map((f) => {
      const path = normalizePath(f.path || f.filename || '');
      const content = pickContent(f).replace(/^\uFEFF/, '').replace(/\x00/g, '');
      return { path, content };
    })
    .filter((f) => !!f.path && f.content.trim().length > 0);

  if (cleaned.length === 0) return null;

  // dedupe
  const seen = new Set<string>();
  const unique = cleaned.filter((f) => {
    if (seen.has(f.path)) return false;
    seen.add(f.path);
    return true;
  });

  if (unique.length === 0) return null;

  // 1) Streng validieren (silent)
  const strict = normalizeAndValidateFiles(unique as any, { silent: true });
  if (strict && Array.isArray(strict) && strict.length > 0) {
    return strict as any;
  }

  // 2) Lenient fallback (damit Caller nicht permanent "konnte nicht verarbeiten" meldet)
  const lenient = unique.filter((f) => {
    const p = f.path;
    if (!p) return false;
    if (!hasValidExtension(p)) return false;
    if (hasInvalidPattern(p)) return false;
    if (!isPathAllowed(p)) return false;
    return true;
  });

  return lenient.length > 0 ? lenient : null;
}
