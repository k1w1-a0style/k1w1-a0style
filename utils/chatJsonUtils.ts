// utils/chatJsonUtils.ts
// JSON parsing and extraction utilities.

import { jsonrepair } from "jsonrepair";
import type { ProjectFile } from "../shared/types/project";
import { isCodeFile, log, logError, validateProjectFiles } from "./chatValidation";
import { normalizePath } from "./url";

export type SafeJsonOpts = { silent?: boolean };

export const extractBalanced = (text: string, open: string, close: string): string | null => {
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


function ensureStringContent(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
