import { errorResponse } from "../cors.ts";
import { getServiceRoleSecret, getSupabaseUrlSecret } from "./runtime.ts";

export type JwtPayload = {
  role?: unknown;
  sub?: unknown;
  aud?: unknown;
  iss?: unknown;
  app_metadata?: { role?: unknown; [key: string]: unknown };
  [key: string]: unknown;
};

export function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

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
export const PRIVILEGED_OPERATOR_ALLOWED_ROLES = ["service_role", "build_admin"] as const;
export const AI_OPERATOR_ALLOWED_ROLES = ["service_role", "build_admin"] as const;

type VerifiedJwtUser = {
  id?: unknown;
  role?: unknown;
  app_metadata?: { role?: unknown; [key: string]: unknown };
};

type VerifiedJwtContext = {
  payload: JwtPayload | null;
  user: VerifiedJwtUser;
};

export type VerifiedJwtActorResult = {
  actor: string;
  source: "verified_user_id" | "verified_payload_sub" | "fallback";
};

export type WorkflowOperatorJwtGuardWithActorResult = {
  guard: Response | null;
  actor: string | null;
};

export type JwtRoleGuardWithActorResult = {
  guard: Response | null;
  actor: string | null;
};

function readNonEmptyRole(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getRoleFromVerifiedContext(ctx: VerifiedJwtContext): string {
  const jwtRole = readNonEmptyRole(ctx.payload?.role);
  if (jwtRole) return jwtRole;
  const jwtAppRole = readNonEmptyRole(ctx.payload?.app_metadata?.role);
  if (jwtAppRole) return jwtAppRole;
  const userAppRole = readNonEmptyRole(ctx.user?.app_metadata?.role);
  if (userAppRole) return userAppRole;
  return readNonEmptyRole(ctx.user?.role);
}

function getActorFromVerifiedContext(ctx: VerifiedJwtContext): string | null {
  const userId = typeof ctx.user?.id === "string" ? ctx.user.id.trim() : "";
  if (userId) return userId;
  const verifiedSub = typeof ctx.payload?.sub === "string" ? ctx.payload.sub.trim() : "";
  if (verifiedSub) return verifiedSub;
  return null;
}

const DEFAULT_EDGE_FETCH_TIMEOUT_MS = 8_000;

async function fetchWithEdgeTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = DEFAULT_EDGE_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

type VerifiedJwtLookupResult =
  | { ok: true; context: VerifiedJwtContext }
  | { ok: false; reason: "invalid_or_unverifiable" | "server_misconfigured" };

async function verifyJwtViaSupabaseAuth(req: Request): Promise<VerifiedJwtLookupResult> {
  const token = getBearerToken(req);
  if (!token) return { ok: false, reason: "invalid_or_unverifiable" };

  const supabaseUrl = getSupabaseUrlSecret();
  const serviceKey = getServiceRoleSecret();
  if (!supabaseUrl || !serviceKey) return { ok: false, reason: "server_misconfigured" };

  try {
    const authUrl = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`;
    const res = await fetchWithEdgeTimeout(authUrl, {
      method: "GET",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return { ok: false, reason: "invalid_or_unverifiable" };
    const user = await res.json().catch((): unknown => null);
    if (!user || typeof user !== "object") return { ok: false, reason: "invalid_or_unverifiable" };
    return {
      ok: true,
      context: {
        payload: decodeJwtPayload(token),
        user: user as VerifiedJwtUser,
      },
    };
  } catch {
    return { ok: false, reason: "invalid_or_unverifiable" };
  }
}

export async function resolveVerifiedJwtActor(
  req: Request,
  fallbackActor = "service_role",
): Promise<VerifiedJwtActorResult> {
  const verified = await verifyJwtViaSupabaseAuth(req);
  if (verified.ok === false) {
    return { actor: fallbackActor, source: "fallback" };
  }

  const userId = typeof verified.context.user?.id === "string"
    ? verified.context.user.id.trim()
    : "";
  if (userId) {
    return { actor: userId, source: "verified_user_id" };
  }

  const verifiedSub = typeof verified.context.payload?.sub === "string"
    ? verified.context.payload.sub.trim()
    : "";
  if (verifiedSub) {
    return { actor: verifiedSub, source: "verified_payload_sub" };
  }

  return { actor: fallbackActor, source: "fallback" };
}

export async function requireVerifiedJwt(req: Request, scope: string): Promise<Response | null> {
  const token = getBearerToken(req);
  if (!token) {
    return errorResponse("Unauthorized: missing bearer token.", req, 401, { scope, required: "Authorization: Bearer <jwt>" });
  }

  const verified = await verifyJwtViaSupabaseAuth(req);
  if (verified.ok === false) {
    if (verified.reason === "server_misconfigured") {
      return errorResponse("JWT verification is unavailable due to server auth misconfiguration.", req, 500, { scope });
    }
    return errorResponse("Unauthorized: missing or unverifiable JWT.", req, 401, { scope });
  }

  return null;
}

export async function requireJwtRole(req: Request, cfg: JwtRoleGuardConfig): Promise<Response | null> {
  const token = getBearerToken(req);
  if (!token) {
    return errorResponse("Unauthorized: missing bearer token.", req, 401, {
      scope: cfg.scope,
      required: "Authorization: Bearer <jwt>",
    });
  }

  const verified = await verifyJwtViaSupabaseAuth(req);
  if (verified.ok === false) {
    if (verified.reason === "server_misconfigured") {
      return errorResponse("JWT verification is unavailable due to server auth misconfiguration.", req, 500, { scope: cfg.scope });
    }
    return errorResponse("Unauthorized: missing or unverifiable JWT.", req, 401, { scope: cfg.scope });
  }

  const role = getRoleFromVerifiedContext(verified.context);
  if (!role || !cfg.allowedRoles.includes(role)) {
    return errorResponse("Forbidden: verified JWT role is not allowed for this route.", req, 403, { scope: cfg.scope, allowedRoles: cfg.allowedRoles });
  }

  return null;
}

export async function requireWorkflowOperatorJwtRole(req: Request, scope: string): Promise<Response | null> {
  return requireJwtRole(req, { scope, allowedRoles: [...WORKFLOW_OPERATOR_ALLOWED_ROLES] });
}

export async function requireWorkflowOperatorJwtRoleWithVerifiedActor(
  req: Request,
  scope: string,
): Promise<WorkflowOperatorJwtGuardWithActorResult> {
  return requireJwtRoleWithVerifiedActor(req, scope, [...WORKFLOW_OPERATOR_ALLOWED_ROLES]);
}

async function requireJwtRoleWithVerifiedActor(
  req: Request,
  scope: string,
  allowedRoles: string[],
): Promise<JwtRoleGuardWithActorResult> {
  const token = getBearerToken(req);
  if (!token) {
    return {
      guard: errorResponse("Unauthorized: missing bearer token.", req, 401, {
        scope,
        required: "Authorization: Bearer <jwt>",
      }),
      actor: null,
    };
  }

  const verified = await verifyJwtViaSupabaseAuth(req);
  if (verified.ok === false) {
    if (verified.reason === "server_misconfigured") {
      return {
        guard: errorResponse("JWT verification is unavailable due to server auth misconfiguration.", req, 500, { scope }),
        actor: null,
      };
    }
    return {
      guard: errorResponse("Unauthorized: missing or unverifiable JWT.", req, 401, { scope }),
      actor: null,
    };
  }

  const role = getRoleFromVerifiedContext(verified.context);
  if (!role || !allowedRoles.includes(role)) {
    return {
      guard: errorResponse("Forbidden: verified JWT role is not allowed for this route.", req, 403, {
        scope,
        allowedRoles,
      }),
      actor: null,
    };
  }

  return { guard: null, actor: getActorFromVerifiedContext(verified.context) };
}

export async function requirePrivilegedOperatorJwtRole(req: Request, scope: string): Promise<Response | null> {
  return requireJwtRole(req, { scope, allowedRoles: [...PRIVILEGED_OPERATOR_ALLOWED_ROLES] });
}

export async function requireAiOperatorJwtRole(req: Request, scope: string): Promise<Response | null> {
  return requireJwtRole(req, { scope, allowedRoles: [...AI_OPERATOR_ALLOWED_ROLES] });
}

export async function requirePrivilegedOperatorJwtRoleWithVerifiedActor(
  req: Request,
  scope: string,
): Promise<JwtRoleGuardWithActorResult> {
  return requireJwtRoleWithVerifiedActor(req, scope, [...PRIVILEGED_OPERATOR_ALLOWED_ROLES]);
}

export async function requireAiOperatorJwtRoleWithVerifiedActor(
  req: Request,
  scope: string,
): Promise<JwtRoleGuardWithActorResult> {
  return requireJwtRoleWithVerifiedActor(req, scope, [...AI_OPERATOR_ALLOWED_ROLES]);
}
