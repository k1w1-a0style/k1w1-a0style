// Shared auth helpers for Supabase Edge Functions
// Intended for internal tooling (wizard + CI).

// Legacy contract markers for invariant/ops scripts (implementation moved to auth/* modules):
// export function requireScopedEdgeAuth(req: Request, cfg: ScopedEdgeAuthConfig): Response | null {
// export const WORKFLOW_OPERATOR_ALLOWED_ROLES = ["service_role", "build_admin"] as const;
// export async function requireWorkflowOperatorJwtRole(req: Request, scope: string): Promise<Response | null> {
// export const PRIVILEGED_OPERATOR_ALLOWED_ROLES = ["service_role", "build_admin"] as const;
// export async function requirePrivilegedOperatorJwtRole(req: Request, scope: string): Promise<Response | null> {
// const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
// const payload = JSON.parse(new TextDecoder().decode(bytes));
// const getSigningAdminSecret = (): string | null =>
// export function requireSigningAdminKey(req: Request): Response | null {
// missing: ["K1W1_EDGE_ADMIN_KEY"]
// "Missing required auth secrets for this Edge Function."
// "Unauthorized: send either admin key OR bearer token, not both."
// "Unauthorized: missing authentication header."
// export async function requireVerifiedJwt(req: Request, scope: string): Promise<Response | null> {

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
// export async function requireAiOperatorJwtRole(req: Request, scope: string): Promise<Response | null> {
