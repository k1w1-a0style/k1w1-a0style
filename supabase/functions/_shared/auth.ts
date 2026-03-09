// Shared auth helpers for Supabase Edge Functions
// Intended for internal tooling (wizard + CI).
import { errorResponse } from "./cors.ts";

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

export function hasAdminKeySecretConfigured(): boolean {
  return !!(
    Deno.env.get("K1W1_EDGE_ADMIN_KEY") ||
    Deno.env.get("SIGNING_ADMIN_KEY")
  );
}

export function hasServiceRoleSecretConfigured(): boolean {
  return !!(
    Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );
}

/**
 * Returns the server-side service role key to use for Supabase operations.
 * Important: this is looked up only from Edge Function secrets and never from
 * the caller's Authorization header.
 */
export function getServiceRoleKey(_req: Request): string | null {
  return (
    Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    null
  );
}

/**
 * Verify x-k1w1-admin-key against K1W1_EDGE_ADMIN_KEY / SIGNING_ADMIN_KEY.
 * Returns Response on failure, null on success.
 */
export function requireAdminKey(req: Request): Response | null {
  const expected =
    Deno.env.get("K1W1_EDGE_ADMIN_KEY") ??
    Deno.env.get("SIGNING_ADMIN_KEY") ??
    null;
  const got = getAdminKeyHeader(req) ?? "";

  if (!expected) {
    return errorResponse(
      "Missing admin auth secret for this Edge Function.",
      req,
      500,
      { missing: ["K1W1_EDGE_ADMIN_KEY|SIGNING_ADMIN_KEY"] },
    );
  }

  if (got && got === expected) return null;

  return errorResponse(
    "Unauthorized: missing or invalid admin key.",
    req,
    401,
    { required: "x-k1w1-admin-key" },
  );
}

/**
 * Verify Authorization: Bearer <service-role-secret> for CI/internal callers.
 * This is a caller-auth gate only. It does not supply the server-side DB key.
 */
export function requireServiceRoleBearer(req: Request): Response | null {
  const expected =
    Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    null;
  const got = getBearerToken(req) ?? "";

  if (!expected) {
    return errorResponse(
      "Missing service-role secret for CI bearer auth.",
      req,
      500,
      { missing: ["K1W1_SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY"] },
    );
  }

  if (got && got === expected) return null;

  return errorResponse(
    "Unauthorized: missing or invalid CI bearer token.",
    req,
    401,
    { required: "Authorization: Bearer <service-role-secret>" },
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
  windowMs = 10_000,
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
    return errorResponse("rate_limited", req, 429, { windowMs, max });
  }
  return null;
}
