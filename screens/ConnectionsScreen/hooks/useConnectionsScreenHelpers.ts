import type { VerificationContractState } from "../../../lib/status/verificationContract";

export type ExpoProjectResponse = {
  data?: {
    id?: string;
    slug?: string;
    name?: string;
    project?: {
      id?: string;
      slug?: string;
    };
  };
};

const EAS_STATES: VerificationContractState[] = [
  "verified",
  "missing",
  "unknown",
  "auth_error",
  "stale",
];

export const isPersistedEasState = (value: string | null): value is VerificationContractState => {
  if (!value) return false;
  return EAS_STATES.includes(value as VerificationContractState);
};

export const resolvePersistedEasState = (params: {
  state: string | null;
  easProjectId: string;
  lastVerifiedAt: string | null;
}): VerificationContractState | null => {
  const { state, easProjectId, lastVerifiedAt } = params;
  if (isPersistedEasState(state)) {
    return state;
  }

  if (easProjectId.trim() || lastVerifiedAt) {
    return lastVerifiedAt ? "verified" : "stale";
  }

  return null;
};

export const buildRepoOkLine = (repoSlug: string | null, repoBranch: string | null): string => {
  const slug = String(repoSlug ?? "").trim();
  const branch = String(repoBranch ?? "").trim();
  if (slug && branch) return `${slug} (${branch})`;
  if (slug) return slug;
  return "";
};

export const hasExpoProject = (payload: ExpoProjectResponse | null): boolean => {
  return Boolean(
    payload?.data?.id ||
      payload?.data?.project?.id ||
      payload?.data?.project?.slug ||
      payload?.data?.slug ||
      payload?.data?.name,
  );
};

export const resolveEasProjectVerification = (
  payload: ExpoProjectResponse | null,
  nowIso: string,
): {
  ok: boolean;
  state: VerificationContractState;
  verifiedAt: string | null;
  hasProject: boolean;
} => {
  const hasProject = hasExpoProject(payload);
  return {
    ok: hasProject,
    state: hasProject ? "verified" : "unknown",
    verifiedAt: hasProject ? nowIso : null,
    hasProject,
  };
};

export const deriveSupabaseRefFromUrl = (url: string): string => {
  const host = url.replace(/^https?:\/\//, "").split("/")[0] || "";
  return host.endsWith(".supabase.co") ? host.split(".")[0] || "" : "";
};

export type StorageLike = {
  multiSet: (entries: Array<[string, string]>) => Promise<unknown>;
  multiRemove: (keys: string[]) => Promise<unknown>;
  setItem: (key: string, value: string) => Promise<unknown>;
  removeItem: (key: string) => Promise<unknown>;
};

export const persistEntriesWithFallback = async (
  storage: StorageLike,
  entries: Array<[string, string]>,
): Promise<void> => {
  if (!entries.length) return;
  await storage.multiSet(entries).catch(async () => {
    await Promise.all(entries.map(([key, value]) => storage.setItem(key, value).catch(() => {})));
  });
};

export const removeEntriesWithFallback = async (
  storage: StorageLike,
  keys: string[],
): Promise<void> => {
  if (!keys.length) return;
  await storage.multiRemove(keys).catch(async () => {
    await Promise.all(keys.map((key) => storage.removeItem(key).catch(() => {})));
  });
};
