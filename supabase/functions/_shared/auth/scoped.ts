import { errorResponse } from "../cors.ts";
import { getAdminKeyHeader } from "./admin.ts";
import { getBearerToken } from "./jwt.ts";
import { getStrictEnvSecret } from "./runtime.ts";
import { timingSafeSecretEqual } from "./timingSafe.ts";

export type ScopedEdgeAuthConfig = {
  scope: string;
  allowAdmin: boolean;
  adminSecretEnv?: string;
};

export function requireScopedEdgeAuth(req: Request, cfg: ScopedEdgeAuthConfig): Response | null {
  const { scope, allowAdmin, adminSecretEnv } = cfg;

  if (!allowAdmin) {
    return errorResponse("Auth misconfiguration: no auth mode enabled for this route.", req, 500, { scope });
  }

  const adminSecret = allowAdmin ? getStrictEnvSecret(adminSecretEnv) : null;

  const missing: string[] = [];
  if (allowAdmin && !adminSecret) missing.push(String(adminSecretEnv || "<missing adminSecretEnv>"));
  if (missing.length > 0) {
    return errorResponse("Missing required auth secrets for this Edge Function.", req, 500, { scope, missing });
  }

  const hasAuthHeader = req.headers.has("authorization") || req.headers.has("Authorization");
  const bearerToken = getBearerToken(req);
  const adminHeader = getAdminKeyHeader(req);

  if (hasAuthHeader && !bearerToken) {
    return errorResponse("Unauthorized: invalid Authorization header format.", req, 401, {
      scope,
      required: "Authorization: Bearer <token>",
    });
  }


  if (adminHeader) {
    if (!allowAdmin || !adminSecret) {
      return errorResponse("Unauthorized: admin key auth is not accepted on this route.", req, 401, { scope });
    }
    if (timingSafeSecretEqual(adminHeader, adminSecret)) return null;
    return errorResponse("Unauthorized: invalid admin key.", req, 401, { scope, required: "x-k1w1-admin-key" });
  }

  if (hasAuthHeader) {
    return errorResponse("Unauthorized: bearer auth on this route always requires x-k1w1-admin-key.", req, 401, {
      scope,
      required: ["x-k1w1-admin-key", "Authorization: Bearer <jwt>"],
    });
  }

  const accepted: string[] = [];
  if (allowAdmin) accepted.push("x-k1w1-admin-key");

  return errorResponse("Unauthorized: missing authentication header.", req, 401, { scope, accepted });
}


export type OwnerOrJwtAuthResult = {
  guard: Response | null;
  actor: string | null;
  via: "admin_key" | "jwt" | null;
};

export async function requireOwnerOrJwtAuth(
  req: Request,
  cfg: { scope: string; adminSecretEnv: string; requireJwtRoleWithVerifiedActor?: (req: Request, scope: string) => Promise<{ guard: Response | null; actor: string | null }>; },
): Promise<OwnerOrJwtAuthResult> {
  const hasAdminHeader = !!getAdminKeyHeader(req);
  if (hasAdminHeader) {
    const bearerToken = getBearerToken(req);
    const anonKey = getStrictEnvSecret("K1W1_SUPABASE_ANON_KEY") ?? getStrictEnvSecret("SUPABASE_ANON_KEY");
    if (!anonKey) {
      return {
        guard: errorResponse("Missing required auth secrets for this Edge Function.", req, 500, { scope: cfg.scope, missing: ["SUPABASE_ANON_KEY"] }),
        actor: null,
        via: null,
      };
    }
    if (!bearerToken) {
      return {
        guard: errorResponse("Unauthorized: owner fallback requires anon bearer + admin key.", req, 401, {
          scope: cfg.scope,
          required: ["Authorization: Bearer <anon key>", "x-k1w1-admin-key"],
        }),
        actor: null,
        via: null,
      };
    }
    if (!timingSafeSecretEqual(bearerToken, anonKey)) {
      return {
        guard: errorResponse("Unauthorized: owner fallback requires configured Supabase anon bearer.", req, 401, {
          scope: cfg.scope,
          required: "Authorization: Bearer <anon key>",
        }),
        actor: null,
        via: null,
      };
    }
    const adminRes = requireScopedEdgeAuth(req, {
      scope: cfg.scope,
      allowAdmin: true,
      adminSecretEnv: cfg.adminSecretEnv,
    });
    if (adminRes === null) return { guard: null, actor: "scoped_admin", via: "admin_key" };
    return { guard: adminRes, actor: null, via: null };
  }

  const hasBearer = !!getBearerToken(req);
  if (!hasBearer) {
    return {
      guard: errorResponse("Unauthorized: Owner/Admin-Key oder Login erforderlich.", req, 401, {
        scope: cfg.scope,
        accepted: ["x-k1w1-admin-key", "Authorization: Bearer <jwt>"],
      }),
      actor: null,
      via: null,
    };
  }

  if (!cfg.requireJwtRoleWithVerifiedActor) {
    return {
      guard: errorResponse("Unauthorized: bearer auth is not enabled for this route.", req, 401, {
        scope: cfg.scope,
        required: "x-k1w1-admin-key",
      }),
      actor: null,
      via: null,
    };
  }

  const jwt = await cfg.requireJwtRoleWithVerifiedActor(req, cfg.scope);
  if (jwt.guard) return { guard: jwt.guard, actor: null, via: null };
  if (!jwt.actor || !jwt.actor.trim()) {
    return {
      guard: errorResponse("Unauthorized: verified JWT actor missing.", req, 401, { scope: cfg.scope }),
      actor: null,
      via: null,
    };
  }
  return { guard: null, actor: jwt.actor, via: "jwt" };
}
