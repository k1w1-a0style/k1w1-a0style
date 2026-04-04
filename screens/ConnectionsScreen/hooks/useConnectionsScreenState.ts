import { STORAGE_KEYS } from "../../../lib/storageKeys";
import {
  buildRepoOkLine,
  resolvePersistedEasState,
  type PersistableEntry,
} from "./useConnectionsScreenHelpers";

export type HydrationLightsInput = {
  ghOk: string | null;
  ghUserStored: string | null;
  ghScopesStored: string | null;
  sbOk: string | null;
  sbRefStored: string | null;
  exOk: string | null;
  exUserStored: string | null;
  easOkStored: string | null;
  easStateStored: string | null;
  easLastVerifiedStored: string | null;
  repoOkStored: string | null;
  repoSlug: string | null;
  repoBranch: string | null;
  easProjectId: string;
};

export type HydrationLightsState = {
  githubOk: boolean;
  githubUser: string;
  githubScopes: string;
  supabaseOk: boolean;
  supabaseRef: string;
  expoOk: boolean;
  expoUser: string;
  easOk: boolean;
  easState: ReturnType<typeof resolvePersistedEasState>;
  easLastVerifiedAt: string | null;
  repoOk: boolean;
  repoOkLine: string;
};

export const resolveHydrationLightsState = (
  input: HydrationLightsInput,
): HydrationLightsState => {
  const repoOkLine = buildRepoOkLine(input.repoSlug, input.repoBranch);
  return {
    githubOk: input.ghOk === "true",
    githubUser: input.ghUserStored || "",
    githubScopes: input.ghScopesStored || "",
    supabaseOk: input.sbOk === "true",
    supabaseRef: input.sbRefStored || "",
    expoOk: input.exOk === "true",
    expoUser: input.exUserStored || "",
    easOk: input.easOkStored === "true",
    easState: resolvePersistedEasState({
      state: input.easStateStored,
      easProjectId: input.easProjectId,
      lastVerifiedAt: input.easLastVerifiedStored,
    }),
    easLastVerifiedAt: input.easLastVerifiedStored || null,
    repoOk: input.repoOkStored === "true",
    repoOkLine: input.repoSlug ? repoOkLine : "",
  };
};

export const githubClearedPersistence = (): {
  writes: PersistableEntry[];
  removes: string[];
} => ({
  writes: [
    [STORAGE_KEYS.CONN_GITHUB_OK, "false"],
    [STORAGE_KEYS.CONN_REPO_OK, "false"],
    [STORAGE_KEYS.CONN_EAS_OK, "false"],
    [STORAGE_KEYS.CONN_EAS_STATE, "missing"],
  ],
  removes: [
    STORAGE_KEYS.CONN_GITHUB_USER,
    STORAGE_KEYS.CONN_GITHUB_SCOPES,
    STORAGE_KEYS.CONN_REPO_SLUG,
    STORAGE_KEYS.CONN_REPO_BRANCH,
    STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT,
  ],
});

export const expoClearedPersistence = (): {
  writes: PersistableEntry[];
  removes: string[];
} => ({
  writes: [[STORAGE_KEYS.CONN_EXPO_OK, "false"]],
  removes: [STORAGE_KEYS.CONN_EXPO_USER],
});

export const easClearedPersistence = (): {
  writes: PersistableEntry[];
  removes: string[];
} => ({
  writes: [
    [STORAGE_KEYS.CONN_EAS_OK, "false"],
    [STORAGE_KEYS.CONN_EAS_STATE, "missing"],
  ],
  removes: [STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT],
});

export const supabaseClearedPersistence = (): {
  writes: PersistableEntry[];
  removes: string[];
} => ({
  writes: [[STORAGE_KEYS.CONN_SUPABASE_OK, "false"]],
  removes: [STORAGE_KEYS.CONN_SUPABASE_REF],
});
