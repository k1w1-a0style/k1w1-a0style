
type RuntimeGlobals = {
  Deno?: { env?: { get?: (key: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

export const getRuntimeEnv = (key: string): string | undefined => {
  const runtime = globalThis as typeof globalThis & RuntimeGlobals;
  const deno = runtime.Deno;
  const denoVal = deno?.env?.get?.(key);
  if (typeof denoVal === "string") return denoVal;
  const proc = runtime.process;
  const nodeVal = proc?.env?.[key];
  return typeof nodeVal === "string" ? nodeVal : undefined;
};

export const getAdminSecret = (): string | null => getRuntimeEnv("K1W1_EDGE_ADMIN_KEY") ?? null;
export const getSigningAdminSecret = (): string | null => getRuntimeEnv("SIGNING_ADMIN_KEY") ?? null;
export const getServiceRoleSecret = (): string | null => getRuntimeEnv("K1W1_SUPABASE_SERVICE_ROLE_KEY") ?? getRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY") ?? null;
export const getSupabaseUrlSecret = (): string | null => getRuntimeEnv("K1W1_SUPABASE_URL") ?? getRuntimeEnv("SUPABASE_URL") ?? null;
export const getPreviewSupabaseUrlSecret = (): string | null => getRuntimeEnv("PREVIEW_SUPABASE_URL") ?? null;
export const getPreviewServiceRoleSecret = (): string | null => getRuntimeEnv("PREVIEW_SERVICE_ROLE_KEY") ?? null;
export const getSigningMasterKeySecret = (): string | null => getRuntimeEnv("SIGNING_MASTER_KEY") ?? null;

export function getStrictEnvSecret(key: string | undefined): string | null {
  if (!key) return null;
  const value = getRuntimeEnv(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

