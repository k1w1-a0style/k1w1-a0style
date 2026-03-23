// supabase/functions/save_preview/helpers.ts
// Extracted from index.ts

import {
  createPreviewEdgeErrorPayload,
  PREVIEW_EDGE_ERROR_STATUS,
  PREVIEW_ERROR_HEADER,
  type PreviewEdgeErrorCode,
} from "../../../shared/previewErrorContract.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

export type SnackFiles = Record<string, { type?: string; contents: string }>;
type SnackFileInput = { type?: unknown; contents?: unknown };
export type Payload = {
  projectId?: string;
  name?: string;
  files: SnackFiles;
  dependencies?: Record<string, string>;
  meta?: Record<string, unknown>;
};

export const MAX_FILES_COUNT = 250;
export const MAX_PAYLOAD_BYTES = 1_500_000;

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sanitizePath(raw: string): string | null {
  let p = String(raw ?? "")
    .trim()
    .replace(/\\/g, "/");
  if (!p) return null;
  if (p.length > 300) return null;
  if (p.includes("\0")) return null;

  const segs = p.split("/").filter(Boolean);
  if (segs.some((s) => s === "..")) return null;

  p = p.replace(/\/+/g, "/");
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}

export function sanitizeFiles(files: SnackFiles): SnackFiles {
  const out: SnackFiles = {};
  let total = 0;
  let count = 0;

  for (const [rawPath, val] of Object.entries(files)) {
    count++;
    if (count > MAX_FILES_COUNT) throw new Error("Too many files");

    const key = sanitizePath(rawPath);
    if (!key) continue;

    const file = val as SnackFileInput;
    const contents = String(file.contents ?? "");
    total += contents.length;
    if (total > MAX_PAYLOAD_BYTES) throw new Error("Payload too large");

    out[key] = {
      type: typeof file.type === "string" ? file.type : undefined,
      contents,
    };
  }

  if (!Object.keys(out).length) throw new Error("No valid files");
  return out;
}

export function corsHeaders(origin: string | null) {
  return getCorsHeaders(origin);
}

export function previewErrorHeaders(
  origin: string | null,
  code: PreviewEdgeErrorCode,
  extraHeaders?: HeadersInit,
): HeadersInit {
  return {
    ...corsHeaders(origin),
    [PREVIEW_ERROR_HEADER]: code,
    ...(extraHeaders ?? {}),
  };
}

export function json(res: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(res), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export function jsonPreviewError(params: {
  origin: string | null;
  code: PreviewEdgeErrorCode;
  status?: number;
  message?: string;
}) {
  const status = params.status ?? PREVIEW_EDGE_ERROR_STATUS[params.code];
  return json(createPreviewEdgeErrorPayload(params.code, params.message), {
    status,
    headers: previewErrorHeaders(params.origin, params.code),
  });
}

export function classifySavePreviewPayloadError(message: string): PreviewEdgeErrorCode {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("too large") ||
    normalized.includes("zu groß") ||
    normalized.includes("zu gross") ||
    normalized.includes("too many files")
  ) {
    return "preview_payload_too_large";
  }
  return "preview_payload_invalid";
}

export function classifySavePreviewUnexpectedError(error: unknown): PreviewEdgeErrorCode {
  const message = String(error instanceof Error ? error.message : error ?? "").toLowerCase();
  if (
    message.includes("postgres") ||
    message.includes("relation ") ||
    message.includes("violates") ||
    message.includes("duplicate key") ||
    message.includes("insert") ||
    message.includes("row-level security") ||
    message.includes("database") ||
    message.includes("db")
  ) {
    return "preview_db_error";
  }
  if (!message) {
    return "preview_unknown_internal_error";
  }
  return "preview_runtime_error";
}

export function randomSecret(lenBytes = 24): string {
  const bytes = new Uint8Array(lenBytes);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function approxSize(obj: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(obj)).length;
  } catch {
    return 0;
  }
}
