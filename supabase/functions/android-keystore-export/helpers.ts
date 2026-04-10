// supabase/functions/android-keystore-export/helpers.ts
// Extracted from index.ts

// supabase/functions/android-keystore-export/index.ts
// Endpoint exports decrypted Android keystore + passwords.
// Access control is enforced in index.ts via scoped header-secret auth.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  decryptKeystorePayload,
} from "../_shared/androidKeystoreCrypto.ts";
import { isSafeGitHubRepoFullName } from "../_shared/validation.ts";
import { isAllowedGithubRepo } from "../_shared/github.ts";
export { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
export {
  getJwtPayload,
  getRequestClientIp,
  getRequestRateLimitSubject,
  requireJwtRole,
  rateLimit,
  requireDurableRateLimit,
  requireAdminKey,
  requireScopedEdgeAuth,
  hasAdminKeySecretConfigured,
  getServiceRoleKey,
  getSigningMasterKey,
  getSupabaseUrl,
} from "../_shared/auth.ts";

export type Mode = "development" | "preview" | "production";

export function resolveMode(v: unknown): Mode {
  const s = typeof v === "string" ? v.trim() : "";
  const lower = s.toLowerCase();
  if (lower === "dev") return "development";
  if (lower === "development" || lower === "preview" || lower === "production") return lower as Mode;
  return "production";
}


export function safeString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function repoOk(repo: string): boolean {
  return isSafeGitHubRepoFullName(repo);
}

export { decryptKeystorePayload };
export { isAllowedGithubRepo };
