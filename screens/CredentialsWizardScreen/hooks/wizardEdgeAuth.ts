import { Alert } from "react-native";

import { ensureSupabaseClient } from "../../../lib/supabase";

export const MISSING_OPERATOR_JWT_TITLE = "Supabase Login fehlt";
export const MISSING_OPERATOR_JWT_MESSAGE =
  "Keystore-Status/Generate benötigen einen Supabase Operator-JWT mit Rolle build_admin (oder service_role fuer Server-Caller) sowie den lokalen Android Keystore Export Admin Key. build_admin wird im Betriebs-/Provisioning-Prozess ausserhalb dieses Repos per Supabase-User-Claim vergeben. Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim sind fuer diesen Operator-Flow fail-closed blockiert.";

export async function requireUserJwtOrAlert(params: {
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

  Alert.alert(MISSING_OPERATOR_JWT_TITLE, MISSING_OPERATOR_JWT_MESSAGE);
  return null;
}
