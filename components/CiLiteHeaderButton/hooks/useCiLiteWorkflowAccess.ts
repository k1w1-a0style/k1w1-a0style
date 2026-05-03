import { ensureSupabaseClient } from "../../../lib/supabase";
import { logger } from "../../../lib/logger";
import { getWorkflowAdminKey } from "../../../infra/github/githubService";
import { SecureTokenReadError } from "../../../infra/github/tokenStore";
import { isLikelyWellFormedAdminKeyForUiPrecheck } from "../../../lib/security/isLikelyWellFormedAdminKeyForUiPrecheck";
import { normalizeCiLiteWorkflowError } from "./ciLiteWorkflowErrors";

export type CiLiteAccessContext = "artifact" | "lookup" | "dispatch";
type OperatorJwtReadReason = "ok" | "missing" | "session_unreadable" | "supabase_init_failed";
type OperatorJwtReadResult =
  | { jwt: string; reason: "ok" }
  | { jwt: null; reason: Exclude<OperatorJwtReadReason, "ok"> };

export async function readOperatorJwtResult(context: CiLiteAccessContext): Promise<OperatorJwtReadResult> {
  const supabase = await ensureSupabaseClient().catch((error: unknown) => {
    logger.warn("[CiLiteWorkflow] ensureSupabaseClient failed while reading operator jwt", { context, error });
    return null;
  });
  if (!supabase) return { jwt: null, reason: "supabase_init_failed" };

  const session = await supabase.auth.getSession().catch((error: unknown) => {
    logger.warn("[CiLiteWorkflow] auth.getSession failed while reading operator jwt", { context, error });
    return null;
  });
  if (!session) return { jwt: null, reason: "session_unreadable" };

  const jwt = String(session?.data?.session?.access_token ?? "").trim();
  if (!jwt) return { jwt: null, reason: "missing" };
  return { jwt, reason: "ok" };
}

export async function readOperatorJwt(context: CiLiteAccessContext): Promise<string | null> {
  const result = await readOperatorJwtResult(context);
  return result.reason === "ok" ? result.jwt : null;
}

export async function resolveOperatorAccess(context: Exclude<CiLiteAccessContext, "lookup">): Promise<{ adminKey: string; userJwt: string | null }> {
  const userJwt = await readOperatorJwt(context);
  if (userJwt) {
    return {
      adminKey: "",
      userJwt,
    };
  }

  const adminKey = await getWorkflowAdminKey().catch((error: unknown) => {
    logger.warn("[CiLiteWorkflow] getWorkflowAdminKey failed while resolving operator access", { context, error });
    if (error instanceof SecureTokenReadError) {
      throw new Error("Lokaler Workflow-Admin-Key ist derzeit nicht lesbar (SecureStore unreadable).");
    }
    return null;
  });
  const trimmedAdminKey = String(adminKey ?? "").trim();
  if (!trimmedAdminKey || !isLikelyWellFormedAdminKeyForUiPrecheck(trimmedAdminKey)) {
    const normalized = normalizeCiLiteWorkflowError({
      context,
      adminKey,
    });
    throw new Error(normalized.userMessage);
  }

  return {
    adminKey: trimmedAdminKey,
    userJwt: null,
  };
}
