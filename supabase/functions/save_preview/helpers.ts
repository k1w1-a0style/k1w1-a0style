// supabase/functions/save_preview/helpers.ts
// Extracted from index.ts

import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { parseJsonBody } from "../_shared/validation.ts";
// NOTE: Supabase Edge (Deno) bundler requires explicit file extensions for local imports.
import { sanitizeErrorText } from "../_shared/errorSanitization.ts";

export type SnackFiles = Record<string, { type?: string; contents: string }>;
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

    const contents = String((val as any)?.contents ?? "");
    total += contents.length;
    if (total > MAX_PAYLOAD_BYTES) throw new Error("Payload too large");

    out[key] = { type: (val as any)?.type, contents };
  }

  if (!Object.keys(out).length) throw new Error("No valid files");
  return out;
}

export function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-k1w1-admin-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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
