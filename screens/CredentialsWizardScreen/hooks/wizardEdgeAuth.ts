import { ensureSupabaseClient } from "../../../lib/supabase";

export type CurrentUserJwtReadReason = "ok" | "missing" | "session_unreadable" | "supabase_init_failed";

export type CurrentUserJwtReadResult =
  | { jwt: string; reason: "ok" }
  | { jwt: null; reason: Exclude<CurrentUserJwtReadReason, "ok"> };

export async function readCurrentUserJwtResult(params: {
  onError: (error: unknown) => void;
}): Promise<CurrentUserJwtReadResult> {
  let client: Awaited<ReturnType<typeof ensureSupabaseClient>> | null = null;
  try {
    client = await ensureSupabaseClient();
  } catch (error) {
    params.onError(error);
    return { jwt: null, reason: "supabase_init_failed" };
  }

  try {
    const sessionResult = await (client as {
      auth?: {
        getSession?: () => Promise<{ data?: { session?: { access_token?: string | null } | null } | null }>;
      };
    })?.auth?.getSession?.();
    const jwt = sessionResult?.data?.session?.access_token?.trim();
    if (jwt) return { jwt, reason: "ok" };
    return { jwt: null, reason: "missing" };
  } catch (error) {
    params.onError(error);
    return { jwt: null, reason: "session_unreadable" };
  }
}

export async function readCurrentUserJwt(params: {
  onError: (error: unknown) => void;
}): Promise<string | null> {
  const result = await readCurrentUserJwtResult(params);
  return result.reason === "ok" ? result.jwt : null;
}
