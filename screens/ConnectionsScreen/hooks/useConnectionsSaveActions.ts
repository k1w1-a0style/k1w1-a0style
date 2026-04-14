import { useCallback } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../../lib/storageKeys";
import {
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
        const plan = resolveConnectionsSavePlan(secrets);

        await persistTokenSavePlan(plan);
        await persistSupabaseSavePlan(plan);
        await persistSelectedEasProjectId(plan.easProjectId, effectiveRepo);

        if (plan.shouldClearEasConnection) {
          await clearEasConnectionState();
        }
        if (plan.shouldClearSupabaseConnection) {
          await clearSupabaseConnectionState();
        }
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
  ]);

  return {
    saveAll,
  };
}
