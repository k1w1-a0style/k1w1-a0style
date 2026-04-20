import { useCallback } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../../lib/storageKeys";
import {
  getAndroidKeystoreExportAdminKey,
  getExpoToken,
  getGitHubToken,
  getWorkflowAdminKey,
  deleteAndroidKeystoreExportAdminKey,
  deleteExpoToken,
  deleteGitHubToken,
  deleteWorkflowAdminKey,
  saveAndroidKeystoreExportAdminKey,
  saveExpoToken,
  saveGitHubToken,
  saveWorkflowAdminKey,
} from "../../../infra/github/githubService";
import { deleteSupabaseAnonKey, saveSupabaseAnonKey } from "../../../lib/supabaseAnonKeyStorage";
import { getSupabaseAnonKey } from "../../../lib/supabaseAnonKeyStorage";
import { readScopedEasProjectId } from "../../../lib/easProjectIdScope";
import { recoverFromPendingJournal, runRecoverableCommit } from "../../../lib/recoverableCommit";
import { resetSupabaseClient } from "../../../lib/supabase";
import { normalizeStoredSupabaseRaw, validateBeforeSave } from "../utils/validation";
import { isPersistedEasState, resolveConnectionsSavePlan } from "./useConnectionsScreenHelpers";
import type { VerificationContractState } from "../../../lib/status/verificationContract";

type Params = {
  hydrated: boolean;
  runGuardedAction: (params: {
    defaultTitle: string;
    task: () => Promise<void>;
    onNonBusyError?: (error: unknown) => Promise<void> | void;
  }) => Promise<void>;
  secrets: {
    githubToken: string;
    expoToken: string;
    workflowAdminKey: string;
    androidKeystoreExportAdminKey: string;
    supabaseRaw: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    easProjectId: string;
  };
  persistSelectedEasProjectId: (projectId: string, repoFullName?: string | null) => Promise<void>;
  effectiveRepo: string | null;
  clearGithubConnectionState: () => Promise<void>;
  clearExpoConnectionState: () => Promise<void>;
  clearEasConnectionState: () => Promise<void>;
  clearSupabaseConnectionState: () => Promise<void>;
  applyEasConnectionState: (status: {
    ok: boolean;
    state: VerificationContractState;
    verifiedAt: string | null;
  }) => void;
  setGitHubConnectionState: (status: { ok: boolean; user: string; scopes: string }) => void;
  setExpoConnectionState: (status: { ok: boolean; user: string }) => void;
  setRepoConnectionState: (status: { ok: boolean; line: string }) => void;
  setSupabaseConnectionState: (status: { ok: boolean; ref: string }) => void;
};

export function useConnectionsSaveActions(params: Params) {
  const {
    hydrated,
    runGuardedAction,
    secrets,
    persistSelectedEasProjectId,
    effectiveRepo,
    clearGithubConnectionState,
    clearExpoConnectionState,
    clearEasConnectionState,
    clearSupabaseConnectionState,
    applyEasConnectionState,
    setGitHubConnectionState,
    setExpoConnectionState,
    setRepoConnectionState,
    setSupabaseConnectionState,
  } = params;
  const persistOptionalSecret = useCallback(
    async (input: {
      value: string;
      save: (value: string) => Promise<void>;
      remove: () => Promise<void>;
      onRemoved?: () => Promise<void>;
    }) => {
      const normalizedValue = input.value.trim();
      if (normalizedValue) {
        await input.save(normalizedValue);
        return;
      }
      await input.remove();
      if (input.onRemoved) {
        await input.onRemoved();
      }
    },
    [],
  );

  type ConnectionsSnapshot = {
    repoScope: string | null;
    githubToken: string;
    expoToken: string;
    workflowAdminKey: string;
    androidKeystoreExportAdminKey: string;
    supabaseRaw: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    easProjectId: string;
    sideState: {
      githubOkRaw: string | null;
      githubUserRaw: string | null;
      githubScopesRaw: string | null;
      expoOkRaw: string | null;
      expoUserRaw: string | null;
      repoOkRaw: string | null;
      repoSlugRaw: string | null;
      repoBranchRaw: string | null;
      supabaseOkRaw: string | null;
      supabaseRefRaw: string | null;
      easOkRaw: string | null;
      easStateRaw: string | null;
      easLastVerifiedAtRaw: string | null;
    };
  };

  const CONNECTIONS_SAVE_JOURNAL_KEY = "connections_save_recoverable_journal_v1";

  const readCurrentSnapshot = useCallback(async (
    repoScopeOverride: string | null = effectiveRepo,
  ): Promise<ConnectionsSnapshot> => {
    const [
      githubToken,
      expoToken,
      workflowAdminKey,
      androidKeystoreExportAdminKey,
      supabaseRaw,
      supabaseUrl,
      supabaseAnonKey,
      easProjectId,
      githubOkRaw,
      githubUserRaw,
      githubScopesRaw,
      expoOkRaw,
      expoUserRaw,
      repoOkRaw,
      repoSlugRaw,
      repoBranchRaw,
      supabaseOkRaw,
      supabaseRefRaw,
      easOkRaw,
      easStateRaw,
      easLastVerifiedAtRaw,
    ] =
      await Promise.all([
        getGitHubToken().then((value) => (value ?? "").trim()),
        getExpoToken().then((value) => (value ?? "").trim()),
        getWorkflowAdminKey().then((value) => (value ?? "").trim()),
        getAndroidKeystoreExportAdminKey().then((value) => (value ?? "").trim()),
        AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_RAW).then((value) => (value ?? "").trim()),
        AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL).then((value) => (value ?? "").trim()),
        getSupabaseAnonKey().then((value) => (value ?? "").trim()),
        readScopedEasProjectId(repoScopeOverride).then((value) => (value ?? "").trim()),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_OK),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_USER),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_SCOPES),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_EXPO_OK),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_EXPO_USER),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_REPO_OK),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_REPO_SLUG),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_REPO_BRANCH),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_SUPABASE_OK),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_SUPABASE_REF),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_EAS_OK),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_EAS_STATE),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT),
      ]);

    return {
      repoScope: repoScopeOverride,
      githubToken,
      expoToken,
      workflowAdminKey,
      androidKeystoreExportAdminKey,
      supabaseRaw,
      supabaseUrl,
      supabaseAnonKey,
      easProjectId,
      sideState: {
        githubOkRaw,
        githubUserRaw,
        githubScopesRaw,
        expoOkRaw,
        expoUserRaw,
        repoOkRaw,
        repoSlugRaw,
        repoBranchRaw,
        supabaseOkRaw,
        supabaseRefRaw,
        easOkRaw,
        easStateRaw,
        easLastVerifiedAtRaw,
      },
    };
  }, [effectiveRepo]);

  const restoreConnectionSideState = useCallback(
    async (snapshot: ConnectionsSnapshot): Promise<void> => {
      const writes: Array<[string, string]> = [];
      const removes: string[] = [];

      const persistMaybe = (key: string, value: string | null) => {
        if (value === null) {
          removes.push(key);
          return;
        }
        writes.push([key, value]);
      };

      persistMaybe(STORAGE_KEYS.CONN_SUPABASE_OK, snapshot.sideState.supabaseOkRaw);
      persistMaybe(STORAGE_KEYS.CONN_SUPABASE_REF, snapshot.sideState.supabaseRefRaw);
      persistMaybe(STORAGE_KEYS.CONN_GITHUB_OK, snapshot.sideState.githubOkRaw);
      persistMaybe(STORAGE_KEYS.CONN_GITHUB_USER, snapshot.sideState.githubUserRaw);
      persistMaybe(STORAGE_KEYS.CONN_GITHUB_SCOPES, snapshot.sideState.githubScopesRaw);
      persistMaybe(STORAGE_KEYS.CONN_EXPO_OK, snapshot.sideState.expoOkRaw);
      persistMaybe(STORAGE_KEYS.CONN_EXPO_USER, snapshot.sideState.expoUserRaw);
      persistMaybe(STORAGE_KEYS.CONN_REPO_OK, snapshot.sideState.repoOkRaw);
      persistMaybe(STORAGE_KEYS.CONN_REPO_SLUG, snapshot.sideState.repoSlugRaw);
      persistMaybe(STORAGE_KEYS.CONN_REPO_BRANCH, snapshot.sideState.repoBranchRaw);
      persistMaybe(STORAGE_KEYS.CONN_EAS_OK, snapshot.sideState.easOkRaw);
      persistMaybe(STORAGE_KEYS.CONN_EAS_STATE, snapshot.sideState.easStateRaw);
      persistMaybe(STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT, snapshot.sideState.easLastVerifiedAtRaw);

      if (writes.length > 0) {
        await AsyncStorage.multiSet(writes);
      }
      if (removes.length > 0) {
        await AsyncStorage.multiRemove(removes);
      }

      const supabaseOk = snapshot.sideState.supabaseOkRaw === "true";
      const supabaseRef = (snapshot.sideState.supabaseRefRaw ?? "").trim();
      setSupabaseConnectionState({ ok: supabaseOk, ref: supabaseRef });
      const githubUser = (snapshot.sideState.githubUserRaw ?? "").trim();
      const githubScopes = (snapshot.sideState.githubScopesRaw ?? "").trim();
      setGitHubConnectionState({
        ok: snapshot.sideState.githubOkRaw === "true",
        user: githubUser,
        scopes: githubScopes,
      });
      const expoUser = (snapshot.sideState.expoUserRaw ?? "").trim();
      setExpoConnectionState({
        ok: snapshot.sideState.expoOkRaw === "true",
        user: expoUser,
      });
      const repoOk = snapshot.sideState.repoOkRaw === "true";
      const repoSlug = (snapshot.sideState.repoSlugRaw ?? "").trim();
      const repoBranch = (snapshot.sideState.repoBranchRaw ?? "").trim();
      const repoLine = repoSlug ? `${repoSlug}${repoBranch ? ` (${repoBranch})` : ""}` : "";
      setRepoConnectionState({ ok: repoOk, line: repoLine });

      const rawEasState = (snapshot.sideState.easStateRaw ?? "").trim();
      const easState: VerificationContractState = isPersistedEasState(rawEasState) ? rawEasState : "missing";
      const easOk = snapshot.sideState.easOkRaw === "true";
      const verifiedAt = (() => {
        const trimmed = (snapshot.sideState.easLastVerifiedAtRaw ?? "").trim();
        return trimmed || null;
      })();
      applyEasConnectionState({ ok: easOk, state: easState, verifiedAt });
    },
    [
      applyEasConnectionState,
      setSupabaseConnectionState,
      setGitHubConnectionState,
      setExpoConnectionState,
      setRepoConnectionState,
    ],
  );

  const persistSupabaseSavePlan = useCallback(
    async (
      plan: ReturnType<typeof resolveConnectionsSavePlan>,
      previousSupabaseUrl: string,
    ): Promise<void> => {
      const normalizedSupabaseRaw = normalizeStoredSupabaseRaw(plan.supabaseRaw, plan.supabaseUrl);
      await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_RAW, normalizedSupabaseRaw);
      await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, plan.supabaseUrl);
      await persistOptionalSecret({
        value: plan.supabaseAnonKey,
        save: saveSupabaseAnonKey,
        remove: deleteSupabaseAnonKey,
      });
      if (plan.supabaseUrl !== previousSupabaseUrl) {
        resetSupabaseClient();
      }
    },
    [persistOptionalSecret],
  );

  const persistTokenSavePlan = useCallback(
    async (plan: ReturnType<typeof resolveConnectionsSavePlan>) => {
      await persistOptionalSecret({
        value: plan.githubToken,
        save: saveGitHubToken,
        remove: deleteGitHubToken,
        onRemoved: clearGithubConnectionState,
      });
      await persistOptionalSecret({
        value: plan.expoToken,
        save: saveExpoToken,
        remove: deleteExpoToken,
        onRemoved: clearExpoConnectionState,
      });
      await persistOptionalSecret({
        value: plan.workflowAdminKey,
        save: saveWorkflowAdminKey,
        remove: deleteWorkflowAdminKey,
      });
      await persistOptionalSecret({
        value: plan.androidKeystoreExportAdminKey,
        save: saveAndroidKeystoreExportAdminKey,
        remove: deleteAndroidKeystoreExportAdminKey,
      });
    },
    [persistOptionalSecret, clearExpoConnectionState, clearGithubConnectionState],
  );

  const restoreSnapshot = useCallback(
    async (snapshot: ConnectionsSnapshot): Promise<void> => {
      const plan = resolveConnectionsSavePlan({
        ...snapshot,
        previous: snapshot,
      });
      await persistTokenSavePlan(plan);
      await persistSupabaseSavePlan(plan, snapshot.supabaseUrl);
      await persistSelectedEasProjectId(plan.easProjectId, snapshot.repoScope);
      await restoreConnectionSideState(snapshot);
    },
    [
      persistTokenSavePlan,
      persistSupabaseSavePlan,
      persistSelectedEasProjectId,
      restoreConnectionSideState,
    ],
  );

  const saveAll = useCallback(async () => {
    if (!hydrated) return;
    const v = validateBeforeSave(secrets);
    if (!v.ok) {
      Alert.alert(v.title, v.message);
      return;
    }

    await runGuardedAction({
      defaultTitle: "❌ Speichern fehlgeschlagen",
      task: async () => {
        const repoScopeAtSaveStart = effectiveRepo;
        await recoverFromPendingJournal<ConnectionsSnapshot>({
          journalKey: CONNECTIONS_SAVE_JOURNAL_KEY,
          flow: "connections_save",
          restoreSnapshot,
        });
        const rollbackSnapshot = await readCurrentSnapshot(repoScopeAtSaveStart);
        const plan = resolveConnectionsSavePlan({
          ...secrets,
          previous: rollbackSnapshot,
        });

        await runRecoverableCommit({
          journalKey: CONNECTIONS_SAVE_JOURNAL_KEY,
          flow: "connections_save",
          snapshot: rollbackSnapshot,
          apply: async () => {
            await persistTokenSavePlan(plan);
            await persistSupabaseSavePlan(plan, rollbackSnapshot.supabaseUrl);
            await persistSelectedEasProjectId(plan.easProjectId, repoScopeAtSaveStart);

            if (plan.shouldClearGitHubConnection) {
              await clearGithubConnectionState();
            }
            if (plan.shouldClearExpoConnection) {
              await clearExpoConnectionState();
            }
            if (plan.shouldClearEasConnection) {
              await clearEasConnectionState();
            }
            if (plan.shouldClearSupabaseConnection) {
              await clearSupabaseConnectionState();
            }
          },
          rollback: restoreSnapshot,
        });
        Alert.alert("✅ Gespeichert", "Tokens & Verbindungen wurden gespeichert.");
      },
    });
  }, [
    hydrated,
    secrets,
    runGuardedAction,
    persistTokenSavePlan,
    persistSupabaseSavePlan,
    persistSelectedEasProjectId,
    effectiveRepo,
    clearEasConnectionState,
    clearSupabaseConnectionState,
    readCurrentSnapshot,
    restoreSnapshot,
  ]);

  return {
    saveAll,
  };
}
