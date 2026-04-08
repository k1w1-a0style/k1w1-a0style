// Shared auth helpers for Supabase Edge Functions
// Intended for internal tooling (wizard + CI).

export {
  getRuntimeEnv,
} from "./auth/runtime.ts";

export {
  getBearerToken,
  getJwtPayload,
  requireVerifiedJwt,
  requireJwtRole,
  requireWorkflowOperatorJwtRole,
  requirePrivilegedOperatorJwtRole,
  requireAiOperatorJwtRole,
  WORKFLOW_OPERATOR_ALLOWED_ROLES,
  PRIVILEGED_OPERATOR_ALLOWED_ROLES,
  AI_OPERATOR_ALLOWED_ROLES,
} from "./auth/jwt.ts";
export type { JwtPayload, JwtRoleGuardConfig } from "./auth/jwt.ts";

export {
  getAdminKeyHeader,
  hasAdminKeySecretConfigured,
  getServiceRoleKey,
  getSupabaseUrl,
  getPreviewSupabaseUrl,
  getPreviewServiceRoleKey,
  getSigningMasterKey,
  requireAdminKey,
  requireSigningAdminKey,
} from "./auth/admin.ts";

export {
  requireScopedEdgeAuth,
} from "./auth/scoped.ts";
export type { ScopedEdgeAuthConfig } from "./auth/scoped.ts";

export {
  getRequestClientIp,
  getRequestRateLimitSubject,
  __resetLocalRateLimitForTests,
  rateLimit,
  requireDurableRateLimit,
} from "./auth/rateLimit.ts";
export type { DurableRateLimitConfig } from "./auth/rateLimit.ts";
