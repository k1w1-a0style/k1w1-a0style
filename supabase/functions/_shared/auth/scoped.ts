import { errorResponse } from "../cors.ts";
import { getAdminKeyHeader } from "./admin.ts";
import { getBearerToken } from "./jwt.ts";
import { getStrictEnvSecret } from "./runtime.ts";

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
    if (adminHeader === adminSecret) return null;
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
