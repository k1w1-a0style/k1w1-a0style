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
  const expected = Deno.env.get("SIGNING_ADMIN_KEY") ?? null;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? null;

  const gotHeader = req.headers.get("x-k1w1-admin-key") ?? "";
  const bearer = getBearerToken(req);

  // Allow either:
  // 1) x-k1w1-admin-key == SIGNING_ADMIN_KEY (strict admin secret), OR
  // 2) Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> (CI/internal automation)
  const okByHeader = !!expected && gotHeader.length > 0 && gotHeader === expected;
  const okByServiceRole = !!serviceRole && !!bearer && bearer === serviceRole;

  if (okByHeader || okByServiceRole) return null;

  if (!expected && !serviceRole) {
    return errorResponse(
      500,
      "Missing admin auth secrets for this Edge Function. Set SIGNING_ADMIN_KEY and/or SUPABASE_SERVICE_ROLE_KEY as function secrets.",
      { missing: ["SIGNING_ADMIN_KEY", "SUPABASE_SERVICE_ROLE_KEY"] },
      req
    );
  }

  return errorResponse(
    401,
    "Unauthorized: missing or invalid admin credentials.",
    {
      required:
        "Either x-k1w1-admin-key (SIGNING_ADMIN_KEY) OR Authorization: Bearer (SUPABASE_SERVICE_ROLE_KEY)",
    },
    req
  );
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
