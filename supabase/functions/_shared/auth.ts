// Shared auth helpers for Supabase Edge Functions
// Intended for internal tooling (wizard + CI).
import { corsHeadersForRequest, errorResponse } from "./cors.ts";

export function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export function getAdminKeyHeader(req: Request): string | null {
  return (
    req.headers.get("x-k1w1-admin-key") ??
    req.headers.get("X-K1W1-Admin-Key") ??
    null
  )?.trim() || null;
}

/**
 * Returns the service role key to use for server-side Supabase operations.
 * Order:
 *  1) Authorization: Bearer <token> (recommended for CI / internal apps)
 *  2) SUPABASE_SERVICE_ROLE_KEY env (if configured as function secret)
 */
export function getServiceRoleKey(req: Request): string | null {
  return getBearerToken(req) || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || null;
}

/**
 * Verify x-k1w1-admin-key against SIGNING_ADMIN_KEY secret.
 * Returns Response on failure, null on success (backwards compatible).
 */
export function requireAdminKey(req: Request): Response | null {
  const expected = Deno.env.get("SIGNING_ADMIN_KEY");
  if (!expected) {
    return errorResponse(
      500,
      "SIGNING_ADMIN_KEY is not configured for this Edge Function. Set it as a function secret.",
      { missing: ["SIGNING_ADMIN_KEY"] }
    );
  }
  const got = getAdminKeyHeader(req);
  if (!got || got !== expected) {
    return new Response(
      JSON.stringify({ error: "unauthorized", hint: "invalid admin key" }),
      {
        status: 401,
        headers: { ...corsHeadersForRequest(req), "content-type": "application/json" },
      }
    );
  }
  return null;
}

/**
 * Tiny in-memory rate limiter (best-effort, per edge instance).
 * key: a logical bucket e.g. "android-keystore-generate"
 * max: allowed calls within windowMs for an IP
 */
const rl = new Map<string, { t: number; c: number }>();
export function rateLimit(
  req: Request,
  key: string,
  max = 10,
  windowMs = 10_000
): Response | null {
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for") ||
    "unknown";
  const k = `${key}:${ip}`;
  const now = Date.now();
  const v = rl.get(k);
  if (!v || now - v.t > windowMs) {
    rl.set(k, { t: now, c: 1 });
    return null;
  }
  v.c += 1;
  if (v.c > max) {
    return errorResponse(429, "rate_limited", { windowMs, max });
  }
  return null;
}
