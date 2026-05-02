import { errorResponse } from "../cors.ts";
import { getAdminKeyHeader } from "./admin.ts";
import { resolveVerifiedJwtActor } from "./jwt.ts";
import { getStrictEnvSecret } from "./runtime.ts";
import { timingSafeSecretEqual } from "./timingSafe.ts";

export type OwnerOrJwtAuthResult = {
  ok: true;
  actor: string;
  authMode: "admin_key" | "jwt";
} | {
  ok: false;
  response: Response;
};

export async function requireOwnerOrJwtAuth(
  req: Request,
  options: { scope: string; adminSecretEnv: string },
): Promise<OwnerOrJwtAuthResult> {
  const adminSecret = getStrictEnvSecret(options.adminSecretEnv);
  if (!adminSecret) {
    return { ok: false, response: errorResponse("Missing required auth secrets for this Edge Function.", req, 500, { scope: options.scope, missing: [options.adminSecretEnv] }) };
  }

  const adminHeader = getAdminKeyHeader(req);
  if (adminHeader && timingSafeSecretEqual(adminHeader, adminSecret)) {
    return { ok: true, actor: "owner_admin", authMode: "admin_key" };
  }

  const jwt = await resolveVerifiedJwtActor(req, options.scope);
  if (jwt.actor) {
    return { ok: true, actor: jwt.actor, authMode: "jwt" };
  }

  return {
    ok: false,
    response: errorResponse("Unauthorized: owner/admin key or login JWT required.", req, 401, {
      scope: options.scope,
      required: ["x-k1w1-admin-key", "Authorization: Bearer <jwt>"],
    }),
  };
}
