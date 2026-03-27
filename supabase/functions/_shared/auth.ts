// Shared auth helpers for Supabase Edge Functions
// Intended for internal tooling (wizard + CI).
import { errorResponse } from "./cors.ts";

type RuntimeGlobals = {
  Deno?: { env?: { get?: (key: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

export const getRuntimeEnv = (key: string): string | undefined => {
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
  getRuntimeEnv("K1W1_SUPABASE_URL") ??
  getRuntimeEnv("SUPABASE_URL") ??
  null;

const getPreviewSupabaseUrlSecret = (): string | null =>
  getRuntimeEnv("PREVIEW_SUPABASE_URL") ??
  null;

const getPreviewServiceRoleSecret = (): string | null =>
  getRuntimeEnv("PREVIEW_SERVICE_ROLE_KEY") ??
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

export type JwtPayload = {
  role?: unknown;
  sub?: unknown;
  aud?: unknown;
  iss?: unknown;
  [key: string]: unknown;
};

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(`${normalized}${pad}`));
    if (!payload || typeof payload !== "object") return null;
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

export function getJwtPayload(req: Request): JwtPayload | null {
  const token = getBearerToken(req);
  if (!token) return null;
  return decodeJwtPayload(token);
}

export type JwtRoleGuardConfig = {
  scope: string;
  allowedRoles: string[];
};

export function requireJwtRole(req: Request, cfg: JwtRoleGuardConfig): Response | null {
  const payload = getJwtPayload(req);
  if (!payload) {
    return errorResponse(
      "Unauthorized: missing or invalid JWT payload.",
      req,
      401,
      { scope: cfg.scope },
    );
  }

  const role = typeof payload.role === "string" ? payload.role.trim() : "";
  if (!role || !cfg.allowedRoles.includes(role)) {
    return errorResponse(
      "Forbidden: JWT role is not allowed for this route.",
      req,
      403,
      { scope: cfg.scope, allowedRoles: cfg.allowedRoles },
    );
  }

  return null;
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

export function getPreviewSupabaseUrl(): string | null {
  return getPreviewSupabaseUrlSecret();
}

export function getPreviewServiceRoleKey(): string | null {
  return getPreviewServiceRoleSecret();
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

export type ScopedEdgeAuthConfig = {
  scope: string;
  allowAdmin: boolean;
  allowCiBearer: boolean;
  allowJwtAuthHeaderWithAdmin?: boolean;
  adminSecretEnv?: string;
  ciBearerSecretEnv?: string;
};

function getStrictEnvSecret(key: string | undefined): string | null {
  if (!key) return null;
  const value = getRuntimeEnv(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function requireScopedEdgeAuth(req: Request, cfg: ScopedEdgeAuthConfig): Response | null {
  const {
    scope,
    allowAdmin,
    allowCiBearer,
    allowJwtAuthHeaderWithAdmin = false,
    adminSecretEnv,
    ciBearerSecretEnv,
  } = cfg;

  if (!allowAdmin && !allowCiBearer) {
    return errorResponse(
      "Auth misconfiguration: no auth mode enabled for this route.",
      req,
      500,
      { scope },
    );
  }

  const adminSecret = allowAdmin ? getStrictEnvSecret(adminSecretEnv) : null;
  const ciSecret = allowCiBearer ? getStrictEnvSecret(ciBearerSecretEnv) : null;

  const missing: string[] = [];
  if (allowAdmin && !adminSecret) missing.push(String(adminSecretEnv || "<missing adminSecretEnv>"));
  if (allowCiBearer && !ciSecret) missing.push(String(ciBearerSecretEnv || "<missing ciBearerSecretEnv>"));

  if (missing.length > 0) {
    return errorResponse(
      "Missing required auth secrets for this Edge Function.",
      req,
      500,
      { scope, missing },
    );
  }

  const hasAuthHeader = req.headers.has("authorization") || req.headers.has("Authorization");
  const bearerToken = getBearerToken(req);
  const adminHeader = getAdminKeyHeader(req);

  if (hasAuthHeader && !bearerToken) {
    return errorResponse(
      "Unauthorized: invalid Authorization header format.",
      req,
      401,
      { scope, required: "Authorization: Bearer <token>" },
    );
  }

  if (adminHeader && hasAuthHeader && !allowJwtAuthHeaderWithAdmin) {
    return errorResponse(
      "Unauthorized: send either admin key OR bearer token, not both.",
      req,
      401,
      { scope },
    );
  }

  if (adminHeader) {
    if (!allowAdmin || !adminSecret) {
      return errorResponse(
        "Unauthorized: admin key auth is not accepted on this route.",
        req,
        401,
        { scope },
      );
    }
    if (adminHeader === adminSecret) return null;
    return errorResponse(
      "Unauthorized: invalid admin key.",
      req,
      401,
      { scope, required: "x-k1w1-admin-key" },
    );
  }

  if (hasAuthHeader) {
    if (!allowCiBearer || !ciSecret) {
      return errorResponse(
        "Unauthorized: bearer auth is not accepted on this route.",
        req,
        401,
        { scope },
      );
    }
    if (bearerToken === ciSecret) return null;
    return errorResponse(
      "Unauthorized: invalid CI bearer token.",
      req,
      401,
      { scope, required: "Authorization: Bearer <ci-secret>" },
    );
  }

  const accepted: string[] = [];
  if (allowAdmin) accepted.push("x-k1w1-admin-key");
  if (allowCiBearer) accepted.push("Authorization: Bearer <ci-secret>");

  return errorResponse(
    "Unauthorized: missing authentication header.",
    req,
    401,
    { scope, accepted },
  );
}

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
