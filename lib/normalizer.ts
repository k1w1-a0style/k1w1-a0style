// lib/normalizer.ts
// Normalisiert KI/Handler-Antwort -> Array { path, content }
// Ziel: robustes Parsing, aber nur "softes" Path-Handling.
// Harte Sicherheitsregeln passieren in lib/validators/fileWriter/Zip-Import.

import { jsonrepair } from 'jsonrepair';
import { normalizePath } from './validators';

// ---- Typen ----
export type RawFile = {
  path?: string;
  filename?: string;
  content?: unknown;
  contents?: unknown;
  text?: unknown;
  code?: unknown;
  [key: string]: unknown;
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  typeof value === 'object' && value !== null ? (value as UnknownRecord) : null;

const getRecordString = (value: unknown, key: string): string | null => {
  const rec = asRecord(value);
  const v = rec?.[key];
  return typeof v === 'string' ? v : null;
};

// ---- Parser / Fallbacks ----
function extractJsonFallback(input: string): string | null {
  if (!input) return null;

  const s = String(input);

  const jsonFence = s.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonFence?.[1] != null) return jsonFence[1];

  const genericFence = s.match(/```\s*([\s\S]*?)\s*```/);
  if (genericFence?.[1] != null) return genericFence[1];

  const firstBrace = s.indexOf("{");
  const firstBracket = s.indexOf("[");

  let start = -1;
  let open = "";
  let close = "";

  if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
    start = firstBrace;
    open = "{";
    close = "}";
  } else if (firstBracket >= 0) {
    start = firstBracket;
    open = "[";
    close = "]";
  } else {
    return null;
  }

  let depth = 0;
  let inStr = false;
  let esc = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }

    if (ch === '"') {
      inStr = true;
      continue;
    }

    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }

  return null;
}

function safeJsonParseSilent<T = unknown>(input: unknown): T | null {
  try {
    if (input == null) return null;
    if (typeof input === 'object') return input as T;
    const repaired = jsonrepair(String(input));
    return JSON.parse(repaired) as T;
  } catch {
    return null;
  }
}

function ensureStringContent(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function pickContent(f: RawFile): string {
  const v = f.content ?? f.contents ?? f.text ?? f.code ?? '';
  return ensureStringContent(v);
}

function extractFileArray(parsed: unknown): RawFile[] | null {
  if (!parsed) return null;
  if (Array.isArray(parsed)) return parsed as RawFile[];

  const obj = asRecord(parsed);
  if (obj) {
    const candidates = ['files', 'data', 'json', 'output', 'result'];
    for (const key of candidates) {
      const value = obj?.[key];
      if (Array.isArray(value)) return value as RawFile[];
    }

    // Map-Form: { files: { "path": "content" } }
    const filesValue = obj.files;
    const filesRecord = asRecord(filesValue);
    if (filesRecord && !Array.isArray(filesValue)) {
      return Object.entries(filesRecord).map(([path, content]) => ({ path, content }));
    }
  }

  return null;
}

function unwrapToParsable(raw: unknown): unknown {
  if (!raw) return null;

  const text = getRecordString(raw, 'text');
  if (text) {
    const s = String(text);
    const jsonBlock = extractJsonFallback(s) ?? s;
    return safeJsonParseSilent(jsonBlock) ?? raw;
  }

  const outputText = getRecordString(raw, 'output_text');
  if (outputText) {
    const s = String(outputText);
    const jsonBlock = extractJsonFallback(s) ?? s;
    return safeJsonParseSilent(jsonBlock) ?? raw;
  }

  if (typeof raw === 'string') {
    const jsonBlock = extractJsonFallback(raw) ?? raw;
    return safeJsonParseSilent(jsonBlock);
  }

  return raw;
}


export type NormalizeAiResponseResult = {
  files: Array<{ path: string; content: string }>;
  parseError?: string;
  responseText?: string;
};

// ---- Hauptfunktion ----
export function normalizeAiResponseDetailed(raw: unknown): NormalizeAiResponseResult | null {
  const parsed = unwrapToParsable(raw);
  const rawText = getRecordString(raw, 'text');
  const rawOutputText = getRecordString(raw, 'output_text');
  const responseText =
    typeof raw === 'string'
      ? raw
      : typeof rawText === 'string'
        ? String(rawText)
        : typeof rawOutputText === 'string'
          ? String(rawOutputText)
          : undefined;

  if (!parsed) {
    return responseText && responseText.trim().length > 0
      ? { files: [], parseError: 'no_json_detected', responseText }
      : null;
  }

  const fileArray = extractFileArray(parsed);
  if (!fileArray || fileArray.length === 0) {
    return responseText && responseText.trim().length > 0
      ? { files: [], parseError: 'no_file_array_detected', responseText }
      : null;
  }

  const out: Array<{ path: string; content: string }> = [];
  const seen = new Set<string>();

  for (const f of fileArray) {
    const rawPath = String(f?.path ?? f?.filename ?? '').trim();
    const content = pickContent(f).replace(/^\uFEFF/, '').replace(/\x00/g, '');

    if (!rawPath) continue;
    if (!content || content.trim().length === 0) continue;

    const normalizedPath = normalizePath(rawPath);
    if (!normalizedPath) continue;

    if (seen.has(normalizedPath)) continue;
    seen.add(normalizedPath);

    out.push({ path: normalizedPath, content });
  }

  if (out.length === 0) {
    return responseText && responseText.trim().length > 0
      ? { files: [], parseError: 'no_valid_files_after_normalization', responseText }
      : null;
  }

  return { files: out };
}

export function normalizeAiResponse(raw: unknown): Array<{ path: string; content: string }> | null {
  const files = normalizeAiResponseDetailed(raw)?.files;
  return files && files.length > 0 ? files : null;
}
