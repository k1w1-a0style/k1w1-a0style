// supabase/functions/_shared/cors.ts
// ✅ SEC-009: CORS Hardening

// NOTE: Supabase Edge (Deno) bundler requires explicit file extensions for local imports.
import { sanitizeErrorText, sanitizeUnknownForTransport } from "./errorSanitization.ts";

// NOTE: Supabase Edge runs on Deno, but our repo `tsc`/Jest runs on Node.
// Avoid direct `Deno` references so local typecheck/tests don't fail.
type RuntimeGlobals = {
  Deno?: { env?: { get?: (key: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

const getRuntimeEnv = (key: string): string | undefined => {
  const runtime = globalThis as typeof globalThis & RuntimeGlobals;
  const deno = runtime.Deno;
  const denoVal = deno?.env?.get?.(key);
  if (typeof denoVal === "string") return denoVal;
  // Node/Jest fallback
  const proc = runtime.process;
  const nodeVal = proc?.env?.[key];
  return typeof nodeVal === "string" ? nodeVal : undefined;
};

/**
 * Erlaubte Origins für CORS
 * In Produktion: Nur spezifische Domains erlauben
 * In Entwicklung: Localhost und Expo-Dev-Server erlauben
 */
const DEFAULT_PRODUCTION_ORIGIN = "https://k1w1.app";

const ALLOWED_ORIGINS = [
  // Produktion
  DEFAULT_PRODUCTION_ORIGIN,
  "https://www.k1w1.app",
];

/**
 * Prüft ob eine Origin erlaubt ist
 */
function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;

  // Entwicklungsmodus: Erlaube alle localhost und Expo-Origins
  const isDev = (getRuntimeEnv("ENVIRONMENT") ?? "production").trim().toLowerCase() === "development";
  if (isDev) {
    if (origin.startsWith("http://localhost:")) return true;
    if (origin.startsWith("http://192.168.")) return true; // Lokales Netzwerk für Expo
    if (origin.startsWith("exp://")) return true;
  }

  return ALLOWED_ORIGINS.some((allowed) => {
    if (allowed.endsWith("//")) {
      // Prefix match (z.B. exp://)
      return origin.startsWith(allowed);
    }
    return origin === allowed;
  });
}

/**
 * Generiert CORS-Header basierend auf der Origin
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? origin : DEFAULT_PRODUCTION_ORIGIN;

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-k1w1-admin-key",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Max-Age": "86400", // Cache preflight für 24h
    "Content-Type": "application/json",
    // Security Headers
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
  };
}

// Helper: compute CORS headers for the given request (avoids using wildcard headers).
export function corsHeadersForRequest(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  return getCorsHeaders(origin);
}

/**
 * Legacy: Standard CORS Headers (für Entwicklung)
 * @deprecated Verwende getCorsHeaders(origin) für produktionsreife CORS
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": DEFAULT_PRODUCTION_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-k1w1-admin-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Content-Type": "application/json",
};

/**
 * Behandelt CORS Preflight Requests
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    return new Response("ok", { headers: getCorsHeaders(origin) });
  }
  return null;
}

/**
 * Erstellt eine JSON Response mit korrekten CORS-Headern
 */
export function jsonResponse(
  data: unknown,
  req: Request,
  status: number = 200,
  options?: { noStore?: boolean },
): Response {
  const origin = req.headers.get("origin");
  const headers = getCorsHeaders(origin);
  if (options?.noStore) {
    headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
    headers.Pragma = "no-cache";
    headers.Expires = "0";
  }
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

/**
 * Erstellt eine Error Response mit korrekten CORS-Headern.
 *
 * Vertrag: strukturierte Zusatzdaten werden unter `details` serialisiert.
 * Beispiel: `errorResponse("Unhandled error", req, 500, { code: "internal_error" })`
 * ergibt `{ ok:false, error:"Unhandled error", details:{ code:"internal_error" } }`.
 */
export function errorResponse(
  error: string,
  req: Request,
  status: number = 400,
  details?: unknown,
  options?: { noStore?: boolean },
): Response {
  const safeError = sanitizeErrorText(error);
  const safeDetails = details === undefined ? undefined : sanitizeUnknownForTransport(details);
  return jsonResponse(
    {
      ok: false,
      error: safeError,
      ...(safeDetails !== undefined && { details: safeDetails }),
    },
    req,
    status,
    options,
  );
}
