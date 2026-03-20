// Shared auth helpers for Supabase Edge Functions
// Intended for internal tooling (wizard + CI).
import { errorResponse } from "./cors.ts";

type RuntimeGlobals = {
  Deno?: { env?: { get?: (key: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

const getRuntimeEnv = (key: string): string | undefined => {
  const runtime = globalThis as typeof globalThis & RuntimeGlobals;
  const deno = runtime.Deno;
  const denoVal = deno?.env?.get?.(key);
  if (typeof denoVal === "string") return denoVal;

  const proc = runtime.process;
  const nodeVal = proc?.env?.[key];
  return typeof nodeVal === "string" ? nodeVal : undefined;
};

const getAdminSecret = (): string | null =>
  getRuntimeEnv("K1W1_EDGE_ADMIN_KEY") ??
  getRuntimeEnv("SIGNING_ADMIN_KEY") ??
  null;

const getServiceRoleSecret = (): string | null =>
  getRuntimeEnv("K1W1_SUPABASE_SERVICE_ROLE_KEY") ??
  getRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY") ??
  null;

const getSupabaseUrlSecret = (): string | null =>
  getRuntimeEnv("SUPABASE_URL") ??
  null;

const getSigningMasterKeySecret = (): string | null =>
  getRuntimeEnv("SIGNING_MASTER_KEY") ??
  null;

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
  return !!getAdminSecret();
}

export function hasServiceRoleSecretConfigured(): boolean {
  return !!getServiceRoleSecret();
}

/**
 * Returns the server-side service role key to use for Supabase operations.
 * Important: this is looked up only from Edge Function secrets and never from
 * the caller's Authorization header.
 */
export function getServiceRoleKey(_req: Request): string | null {
  return getServiceRoleSecret();
}

export function getSupabaseUrl(): string | null {
  return getSupabaseUrlSecret();
}

export function getSigningMasterKey(): string | null {
  return getSigningMasterKeySecret();
}

/**
 * Verify x-k1w1-admin-key against K1W1_EDGE_ADMIN_KEY / SIGNING_ADMIN_KEY.
 * Returns Response on failure, null on success.
 */
export function requireAdminKey(req: Request): Response | null {
  const expected = getAdminSecret();
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
  const expected = getServiceRoleSecret();
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
 * Accept either the explicit admin key (wizard/manual paths) or the CI
 * service-role bearer token (workflow/internal CI callers). This is only for
 * workflow-facing edge routes that are intentionally callable from CI.
 */
export function requireAdminKeyOrServiceRoleBearer(req: Request): Response | null {
  const hasAdmin = hasAdminKeySecretConfigured();
  const hasCi = hasServiceRoleSecretConfigured();

  if (!hasAdmin && !hasCi) {
    return errorResponse(
      "Missing auth configuration for this Edge Function.",
      req,
      500,
      {
        missing: [
          "K1W1_EDGE_ADMIN_KEY|SIGNING_ADMIN_KEY",
          "K1W1_SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY",
        ],
      },
    );
  }

  const adminAuth = hasAdmin ? requireAdminKey(req) : null;
  const ciAuth = hasCi ? requireServiceRoleBearer(req) : null;
  const adminOk = hasAdmin && adminAuth === null;
  const ciOk = hasCi && ciAuth === null;

  if (adminOk || ciOk) return null;

  if (hasAdmin && !hasCi) return adminAuth;
  if (!hasAdmin && hasCi) return ciAuth;

  return errorResponse(
    "Unauthorized: missing or invalid admin key / CI bearer token.",
    req,
    401,
    {
      accepted: [
        "x-k1w1-admin-key",
        "Authorization: Bearer <service-role-secret>",
      ],
    },
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
