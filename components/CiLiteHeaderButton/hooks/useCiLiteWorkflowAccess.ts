import { ensureSupabaseClient } from "../../../lib/supabase";
import { logger } from "../../../lib/logger";
import { getWorkflowAdminKey } from "../../../infra/github/githubService";
import { isLikelyWellFormedAdminKeyForUiPrecheck } from "../../../lib/security/isLikelyWellFormedAdminKeyForUiPrecheck";
import { normalizeCiLiteWorkflowError } from "./ciLiteWorkflowErrors";
import { resolveCiLiteMissingJwtMessage } from "./useCiLiteWorkflowContracts";

export type CiLiteAccessContext = "artifact" | "lookup" | "dispatch";

export async function readOperatorJwt(context: CiLiteAccessContext): Promise<string | null> {
  const supabase = await ensureSupabaseClient().catch((error: unknown) => {
    logger.warn("[CiLiteWorkflow] ensureSupabaseClient failed while reading operator jwt", { context, error });
    return null;
  });
  if (!supabase) return null;

  const session = await supabase.auth.getSession().catch((error: unknown) => {
    logger.warn("[CiLiteWorkflow] auth.getSession failed while reading operator jwt", { context, error });
    return null;
  });
  const jwt = String(session?.data?.session?.access_token ?? "").trim();
  return jwt || null;
}

export async function resolveOperatorAccess(context: Exclude<CiLiteAccessContext, "lookup">): Promise<{ adminKey: string; userJwt: string }> {
  const adminKey = await getWorkflowAdminKey().catch((error: unknown) => {
    logger.warn("[CiLiteWorkflow] getWorkflowAdminKey failed while resolving operator access", { context, error });
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

  const userJwt = await readOperatorJwt(context);
  if (!userJwt) {
    throw new Error(resolveCiLiteMissingJwtMessage(context));
  }

  return {
    adminKey: trimmedAdminKey,
    userJwt,
  };
}
