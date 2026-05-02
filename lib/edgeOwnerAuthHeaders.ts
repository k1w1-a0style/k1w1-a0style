import { readSupabaseRuntimeConfigDetailed } from "./supabaseRuntimeConfig";

function trim(v: string | null | undefined): string {
  return String(v ?? "").trim();
}

export async function buildEdgeOwnerAuthHeaders(params: {
  action: string;
  userJwt?: string | null;
  adminKey?: string | null;
  contentType?: string;
}): Promise<Record<string, string>> {
  const userJwt = trim(params.userJwt);
  const adminKey = trim(params.adminKey);
  const contentType = params.contentType ?? "application/json";

  if (!userJwt && !adminKey) {
    throw new Error(`${params.action} blockiert: Entweder Supabase-Login-JWT oder lokaler Admin-Key wird benötigt.`);
  }

  const headers: Record<string, string> = {
    "Content-Type": contentType,
  };

  if (userJwt) {
    headers.Authorization = `Bearer ${userJwt}`;
    if (adminKey) headers["x-k1w1-admin-key"] = adminKey;
    return headers;
  }

  const runtimeConfig = await readSupabaseRuntimeConfigDetailed();
  const anonKey = trim(runtimeConfig.anonKey);
  if (!anonKey) {
    throw new Error(`${params.action} blockiert: Lokaler Admin-Key vorhanden, aber Supabase-Anon-Key fehlt oder ist nicht lesbar.`);
  }

  headers.Authorization = `Bearer ${anonKey}`;
  headers["x-k1w1-admin-key"] = adminKey;
  return headers;
}
