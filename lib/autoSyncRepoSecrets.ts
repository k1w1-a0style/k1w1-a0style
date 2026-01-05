import AsyncStorage from "@react-native-async-storage/async-storage";
import { getExpoToken, syncRepoSecrets } from "../contexts/githubService";

const KEY_SUPABASE_PROJECT_ID = "a0style_supabase_project_id";
const KEY_SUPABASE_SERVICE_ROLE_KEY = "a0style_supabase_service_role_key";

export type AutoSyncResult = { updated: string[] } | null;

/**
 * Liest lokal gespeicherte Tokens/Settings (Expo Token + Supabase Project ID + Service Role Key)
 * und schreibt sie als GitHub Repo Secrets ins gewählte Repo.
 *
 * Secrets:
 * - EXPO_TOKEN
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */
export async function autoSyncRepoSecrets(
  repoFullName: string,
): Promise<AutoSyncResult> {
  if (!repoFullName || !repoFullName.includes("/")) return null;

  const [supabaseProjectId, supabaseServiceRoleKey, expoToken] =
    await Promise.all([
      AsyncStorage.getItem(KEY_SUPABASE_PROJECT_ID),
      AsyncStorage.getItem(KEY_SUPABASE_SERVICE_ROLE_KEY),
      getExpoToken(),
    ]);

  const supabaseUrl = supabaseProjectId
    ? `https://${supabaseProjectId}.supabase.co`
    : null;

  const payload = {
    expoToken: expoToken || undefined,
    supabaseUrl: supabaseUrl || undefined,
    supabaseServiceRole: supabaseServiceRoleKey || undefined,
  };

  const hasAny = Boolean(
    payload.expoToken || payload.supabaseUrl || payload.supabaseServiceRole,
  );

  // Nichts gespeichert -> dann auch nichts syncen
  if (!hasAny) return null;

  const { updated } = await syncRepoSecrets(repoFullName, payload);
  return { updated };
}
