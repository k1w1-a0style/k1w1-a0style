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
  null;

const getSigningAdminSecret = (): string | null =>
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
  app_metadata?: { role?: unknown; [key: string]: unknown };
  [key: string]: unknown;
};

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = atob(`${normalized}${pad}`);
    const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
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

export const WORKFLOW_OPERATOR_ALLOWED_ROLES = ["service_role", "build_admin"] as const;

export async function requireWorkflowOperatorJwtRole(req: Request, scope: string): Promise<Response | null> {
  return requireJwtRole(req, {
    scope,
    allowedRoles: [...WORKFLOW_OPERATOR_ALLOWED_ROLES],
  });
}

export const PRIVILEGED_OPERATOR_ALLOWED_ROLES = ["service_role", "build_admin"] as const;

export async function requirePrivilegedOperatorJwtRole(req: Request, scope: string): Promise<Response | null> {
  return requireJwtRole(req, {
    scope,
    allowedRoles: [...PRIVILEGED_OPERATOR_ALLOWED_ROLES],
  });
}

type VerifiedJwtUser = {
  id?: unknown;
  role?: unknown;
  app_metadata?: { role?: unknown; [key: string]: unknown };
};

function readNonEmptyRole(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getRoleFromVerifiedContext(user: VerifiedJwtUser | null, payload: JwtPayload | null): string {
  // Primary source of truth: verified JWT claims from the caller token.
  const jwtRole = readNonEmptyRole(payload?.role);
  if (jwtRole) return jwtRole;

  const jwtAppRole = readNonEmptyRole(payload?.app_metadata?.role);
  if (jwtAppRole) return jwtAppRole;

  // Defensive fallback: verified user object from Supabase Auth.
  const userAppRole = readNonEmptyRole(user?.app_metadata?.role);
  if (userAppRole) return userAppRole;

  return readNonEmptyRole(user?.role);
}

type VerifiedJwtLookupResult =
  | { ok: true; user: VerifiedJwtUser }
  | { ok: false; reason: "invalid_or_unverifiable" | "server_misconfigured" };

async function verifyJwtViaSupabaseAuth(req: Request): Promise<VerifiedJwtLookupResult> {
  const token = getBearerToken(req);
  if (!token) return { ok: false, reason: "invalid_or_unverifiable" };

  const supabaseUrl = getSupabaseUrlSecret();
  const serviceKey = getServiceRoleSecret();
  if (!supabaseUrl || !serviceKey) return { ok: false, reason: "server_misconfigured" };

  try {
    const authUrl = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`;
    const res = await fetch(authUrl, {
      method: "GET",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return { ok: false, reason: "invalid_or_unverifiable" };
    const user = await res.json().catch((): unknown => null);
    if (!user || typeof user !== "object") {
      return { ok: false, reason: "invalid_or_unverifiable" };
    }
    return { ok: true, user: user as VerifiedJwtUser };
  } catch {
    return { ok: false, reason: "invalid_or_unverifiable" };
  }
}

export async function requireJwtRole(req: Request, cfg: JwtRoleGuardConfig): Promise<Response | null> {
  const token = getBearerToken(req);
  if (!token) {
    return errorResponse(
      "Unauthorized: missing bearer token.",
      req,
      401,
      { scope: cfg.scope, required: "Authorization: Bearer <jwt>" },
    );
  }

  const verified = await verifyJwtViaSupabaseAuth(req);
  if (verified.ok === false) {
    if (verified.reason === "server_misconfigured") {
      return errorResponse(
        "JWT verification is unavailable due to server auth misconfiguration.",
        req,
        500,
        { scope: cfg.scope },
      );
    }
    return errorResponse(
      "Unauthorized: missing or unverifiable JWT.",
      req,
      401,
      { scope: cfg.scope },
    );
  }

  const role = getRoleFromVerifiedContext(verified.user, getJwtPayload(req));
  if (!role || !cfg.allowedRoles.includes(role)) {
    return errorResponse(
      "Forbidden: verified JWT role is not allowed for this route.",
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
 * Verify x-k1w1-admin-key against the generic legacy edge admin secret only.
 * Important: SIGNING_ADMIN_KEY is intentionally not accepted here.
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
      { missing: ["K1W1_EDGE_ADMIN_KEY"] },
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
 * Verify x-k1w1-admin-key against SIGNING_ADMIN_KEY only.
 * Use this helper only for signing-specific routes/contracts.
 */
export function requireSigningAdminKey(req: Request): Response | null {
  const expected = getSigningAdminSecret();
  const got = getAdminKeyHeader(req) ?? "";

  if (!expected) {
    return errorResponse(
      "Missing signing admin auth secret for this Edge Function.",
      req,
      500,
      { missing: ["SIGNING_ADMIN_KEY"] },
    );
  }

  if (got && got === expected) return null;

  return errorResponse(
    "Unauthorized: missing or invalid signing admin key.",
    req,
    401,
    { required: "x-k1w1-admin-key" },
  );
}

export type ScopedEdgeAuthConfig = {
  scope: string;
  allowAdmin: boolean;
  allowJwtAuthHeaderWithAdmin?: boolean;
  adminSecretEnv?: string;
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
    allowJwtAuthHeaderWithAdmin = false,
    adminSecretEnv,
  } = cfg;

  if (!allowAdmin) {
    return errorResponse(
      "Auth misconfiguration: no auth mode enabled for this route.",
      req,
      500,
      { scope },
    );
  }

  const adminSecret = allowAdmin ? getStrictEnvSecret(adminSecretEnv) : null;

  const missing: string[] = [];
  if (allowAdmin && !adminSecret) missing.push(String(adminSecretEnv || "<missing adminSecretEnv>"));

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
    return errorResponse(
      "Unauthorized: bearer auth requires x-k1w1-admin-key on this route.",
      req,
      401,
      { scope, required: "x-k1w1-admin-key" },
    );
  }

  const accepted: string[] = [];
  if (allowAdmin) accepted.push("x-k1w1-admin-key");

  return errorResponse(
    "Unauthorized: missing authentication header.",
    req,
    401,
    { scope, accepted },
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
    return errorResponse("rate_limited", req, 429, { windowMs, max, mode: "local_best_effort" });
  }
  return null;
}

export type DurableRateLimitConfig = {
  scope: string;
  subject: string;
  max: number;
  windowMs: number;
};

export async function requireDurableRateLimit(
  req: Request,
  cfg: DurableRateLimitConfig,
): Promise<Response | null> {
  const supabaseUrl = getSupabaseUrlSecret();
  const serviceKey = getServiceRoleSecret();
  if (!supabaseUrl || !serviceKey) {
    return errorResponse(
      "Rate-limit misconfiguration: missing durable store secrets.",
      req,
      500,
      { scope: cfg.scope, missing: ["K1W1_SUPABASE_URL|SUPABASE_URL", "K1W1_SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY"] },
    );
  }

  const nowIso = new Date().toISOString();
  const windowStartIso = new Date(Date.now() - cfg.windowMs).toISOString();
  const restBase = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/edge_rate_limit_events`;

  try {
    const insertRes = await fetch(restBase, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify({
        scope: cfg.scope,
        subject: cfg.subject,
        created_at: nowIso,
      }),
    });

    if (!insertRes.ok) {
      return errorResponse("Durable rate-limit write failed.", req, 500, { scope: cfg.scope });
    }

    const countUrl = `${restBase}?scope=eq.${encodeURIComponent(cfg.scope)}&subject=eq.${encodeURIComponent(cfg.subject)}&created_at=gte.${encodeURIComponent(windowStartIso)}&select=id`;
    const countRes = await fetch(countUrl, {
      method: "GET",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        range: "0-0",
        prefer: "count=exact",
      },
    });

    if (!countRes.ok) {
      return errorResponse("Durable rate-limit read failed.", req, 500, { scope: cfg.scope });
    }

    const countHeader = countRes.headers.get("content-range") || "";
    const totalStr = countHeader.split("/")[1];
    const total = Number(totalStr);
    if (Number.isFinite(total) && total > cfg.max) {
      return errorResponse("rate_limited", req, 429, {
        scope: cfg.scope,
        max: cfg.max,
        windowMs: cfg.windowMs,
        mode: "durable",
      });
    }

    return null;
  } catch {
    return errorResponse("Durable rate-limit unavailable.", req, 500, { scope: cfg.scope });
  }
}
