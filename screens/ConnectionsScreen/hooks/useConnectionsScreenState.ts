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

export type HydrationSnapshot = {
  githubToken: string;
  expoToken: string;
  workflowAdminKey: string;
  androidKeystoreExportAdminKey: string;
  supabaseRaw: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  easProjectId: string;
  lights: HydrationLightsInput;
};

export type HydrationLoaders = {
  getGitHubToken: () => Promise<string | null>;
  getExpoToken: () => Promise<string | null>;
  getWorkflowAdminKey: () => Promise<string | null>;
  getAndroidKeystoreExportAdminKey: () => Promise<string | null>;
  getSupabaseAnonKey: () => Promise<string | null>;
};

export type HydrationStorage = {
  getItem: (key: string) => Promise<string | null>;
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

export const loadHydrationSnapshot = async (
  storage: HydrationStorage,
  loaders: HydrationLoaders,
): Promise<HydrationSnapshot> => {
  const [gh, ex, workflowKey, keystoreKey] = await Promise.all([
    loaders.getGitHubToken().catch(() => ""),
    loaders.getExpoToken().catch(() => ""),
    loaders.getWorkflowAdminKey().catch(() => ""),
    loaders.getAndroidKeystoreExportAdminKey().catch(() => ""),
  ]);

  const [raw, url, anon, eas] = await Promise.all([
    storage.getItem(STORAGE_KEYS.SUPABASE_RAW).catch(() => ""),
    storage.getItem(STORAGE_KEYS.SUPABASE_URL).catch(() => ""),
    loaders.getSupabaseAnonKey().catch(() => ""),
    storage.getItem(STORAGE_KEYS.EAS_PROJECT_ID).catch(() => ""),
  ]);

  const [ghOk, ghUserStored, ghScopesStored, sbOk, sbRefStored, exOk, exUserStored, easOkStored, easStateStored, easLastVerifiedStored, repoOkStored, repoSlug, repoBranch] = await Promise.all([
    storage.getItem(STORAGE_KEYS.CONN_GITHUB_OK).catch(() => null),
    storage.getItem(STORAGE_KEYS.CONN_GITHUB_USER).catch(() => null),
    storage.getItem(STORAGE_KEYS.CONN_GITHUB_SCOPES).catch(() => null),
    storage.getItem(STORAGE_KEYS.CONN_SUPABASE_OK).catch(() => null),
    storage.getItem(STORAGE_KEYS.CONN_SUPABASE_REF).catch(() => null),
    storage.getItem(STORAGE_KEYS.CONN_EXPO_OK).catch(() => null),
    storage.getItem(STORAGE_KEYS.CONN_EXPO_USER).catch(() => null),
    storage.getItem(STORAGE_KEYS.CONN_EAS_OK).catch(() => null),
    storage.getItem(STORAGE_KEYS.CONN_EAS_STATE).catch(() => null),
    storage.getItem(STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT).catch(() => null),
    storage.getItem(STORAGE_KEYS.CONN_REPO_OK).catch(() => null),
    storage.getItem(STORAGE_KEYS.CONN_REPO_SLUG).catch(() => null),
    storage.getItem(STORAGE_KEYS.CONN_REPO_BRANCH).catch(() => null),
  ]);

  return {
    githubToken: gh || "",
    expoToken: ex || "",
    workflowAdminKey: workflowKey || "",
    androidKeystoreExportAdminKey: keystoreKey || "",
    supabaseRaw: raw || "",
    supabaseUrl: url || "",
    supabaseAnonKey: anon || "",
    easProjectId: eas || "",
    lights: {
      ghOk,
      ghUserStored,
      ghScopesStored,
      sbOk,
      sbRefStored,
      exOk,
      exUserStored,
      easOkStored,
      easStateStored,
      easLastVerifiedStored,
      repoOkStored,
      repoSlug,
      repoBranch,
      easProjectId: eas || "",
    },
  };
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
