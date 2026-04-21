import { errorResponse } from "../cors.ts";
import {
  getAdminSecret,
  getPreviewServiceRoleSecret,
  getPreviewSupabaseUrlSecret,
  getServiceRoleSecret,
  getSigningAdminSecret,
  getSigningMasterKeySecret,
  getSupabaseUrlSecret,
} from "./runtime.ts";
import { timingSafeSecretEqual } from "./timingSafe.ts";

export function getAdminKeyHeader(req: Request): string | null {
  return (req.headers.get("x-k1w1-admin-key") ?? req.headers.get("X-K1W1-Admin-Key") ?? null)?.trim() || null;
}

export function hasAdminKeySecretConfigured(): boolean {
  return !!getAdminSecret();
}

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

export function requireAdminKey(req: Request): Response | null {
  const expected = getAdminSecret();
  const got = getAdminKeyHeader(req);

  if (!expected) {
    return errorResponse("Missing admin auth secret for this Edge Function.", req, 500, { missing: ["K1W1_EDGE_ADMIN_KEY"] });
  }
  if (timingSafeSecretEqual(got, expected)) return null;

  return errorResponse("Unauthorized: missing or invalid admin key.", req, 401, { required: "x-k1w1-admin-key" });
}

export function requireSigningAdminKey(req: Request): Response | null {
  const expected = getSigningAdminSecret();
  const got = getAdminKeyHeader(req);

  if (!expected) {
    return errorResponse("Missing signing admin auth secret for this Edge Function.", req, 500, { missing: ["SIGNING_ADMIN_KEY"] });
  }
  if (timingSafeSecretEqual(got, expected)) return null;

  return errorResponse("Unauthorized: missing or invalid signing admin key.", req, 401, { required: "x-k1w1-admin-key" });
}
