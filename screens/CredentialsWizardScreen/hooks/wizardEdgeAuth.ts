import { ensureSupabaseClient } from "../../../lib/supabase";

export async function readCurrentUserJwt(params: {
  onError: (error: unknown) => void;
}): Promise<string | null> {
  try {
    const client = await ensureSupabaseClient();
    const sessionResult = await (client as {
      auth?: {
        getSession?: () => Promise<{ data?: { session?: { access_token?: string | null } | null } | null }>;
      };
    })?.auth?.getSession?.();
    const jwt = sessionResult?.data?.session?.access_token?.trim();
    if (jwt) return jwt;
  } catch (error) {
    params.onError(error);
  }
  return null;
}
