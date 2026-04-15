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
import { normalizeStoredSupabaseRaw, validateBeforeSave } from "../utils/validation";
import { resolveConnectionsSavePlan } from "./useConnectionsScreenHelpers";

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
    githubToken: string;
    expoToken: string;
    workflowAdminKey: string;
    androidKeystoreExportAdminKey: string;
    supabaseRaw: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    easProjectId: string;
  };

  const CONNECTIONS_SAVE_JOURNAL_KEY = "connections_save_recoverable_journal_v1";

  const readCurrentSnapshot = useCallback(async (): Promise<ConnectionsSnapshot> => {
    const [githubToken, expoToken, workflowAdminKey, androidKeystoreExportAdminKey, supabaseRaw, supabaseUrl, supabaseAnonKey, easProjectId] =
      await Promise.all([
        getGitHubToken().then((value) => (value ?? "").trim()),
        getExpoToken().then((value) => (value ?? "").trim()),
        getWorkflowAdminKey().then((value) => (value ?? "").trim()),
        getAndroidKeystoreExportAdminKey().then((value) => (value ?? "").trim()),
        AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_RAW).then((value) => (value ?? "").trim()),
        AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL).then((value) => (value ?? "").trim()),
        getSupabaseAnonKey().then((value) => (value ?? "").trim()),
        readScopedEasProjectId(effectiveRepo).then((value) => (value ?? "").trim()),
      ]);

    return {
      githubToken,
      expoToken,
      workflowAdminKey,
      androidKeystoreExportAdminKey,
      supabaseRaw,
      supabaseUrl,
      supabaseAnonKey,
      easProjectId,
    };
  }, [effectiveRepo]);

  const persistSupabaseSavePlan = useCallback(
    async (plan: ReturnType<typeof resolveConnectionsSavePlan>) => {
      const normalizedSupabaseRaw = normalizeStoredSupabaseRaw(plan.supabaseRaw, plan.supabaseUrl);
      await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_RAW, normalizedSupabaseRaw);
      await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, plan.supabaseUrl);
      await persistOptionalSecret({
        value: plan.supabaseAnonKey,
        save: saveSupabaseAnonKey,
        remove: deleteSupabaseAnonKey,
      });
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
      const plan = resolveConnectionsSavePlan(snapshot);
      await persistTokenSavePlan(plan);
      await persistSupabaseSavePlan(plan);
      await persistSelectedEasProjectId(plan.easProjectId, effectiveRepo);
      if (plan.shouldClearEasConnection) {
        await clearEasConnectionState();
      }
      if (plan.shouldClearSupabaseConnection) {
        await clearSupabaseConnectionState();
      }
    },
    [
      persistTokenSavePlan,
      persistSupabaseSavePlan,
      persistSelectedEasProjectId,
      effectiveRepo,
      clearEasConnectionState,
      clearSupabaseConnectionState,
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
        await recoverFromPendingJournal<ConnectionsSnapshot>({
          journalKey: CONNECTIONS_SAVE_JOURNAL_KEY,
          flow: "connections_save",
          restoreSnapshot,
        });
        const rollbackSnapshot = await readCurrentSnapshot();
        const plan = resolveConnectionsSavePlan(secrets);

        await runRecoverableCommit({
          journalKey: CONNECTIONS_SAVE_JOURNAL_KEY,
          flow: "connections_save",
          snapshot: rollbackSnapshot,
          apply: async () => {
            await persistTokenSavePlan(plan);
            await persistSupabaseSavePlan(plan);
            await persistSelectedEasProjectId(plan.easProjectId, effectiveRepo);

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
