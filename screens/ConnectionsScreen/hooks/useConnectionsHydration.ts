import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../../lib/storageKeys";
import {
  getAndroidKeystoreExportAdminKey,
  getExpoToken,
  getGitHubToken,
  getWorkflowAdminKey,
} from "../../../infra/github/githubService";
import { getSupabaseAnonKey } from "../../../lib/supabaseAnonKeyStorage";
import { runCleanupTask } from "../../../lib/safeCleanup";
import { normalizeStoredSupabaseRaw } from "../utils/validation";
import {
  loadHydrationSnapshot,
  resolveHydrationLightsState,
  type HydrationSnapshot,
} from "./useConnectionsScreenState";
import type { VerificationContractState } from "../../../lib/status/verificationContract";

type Params = {
  selectedRepo?: string | null;
  expoToken: string;
  setGithubToken: (value: string) => void;
  setExpoToken: (value: string) => void;
  setWorkflowAdminKey: (value: string) => void;
  setAndroidKeystoreExportAdminKey: (value: string) => void;
  setSupabaseRaw: (value: string) => void;
  setSupabaseUrl: (value: string) => void;
  setSupabaseAnonKey: (value: string) => void;
  setEasProjectId: (value: string) => void;
  setGithubOk: (value: boolean) => void;
  setGithubUser: (value: string) => void;
  setGithubScopes: (value: string) => void;
  setSupabaseOk: (value: boolean) => void;
  setSupabaseRef: (value: string) => void;
  setExpoOk: (value: boolean) => void;
  setExpoUser: (value: string) => void;
  setRepoOk: (value: boolean) => void;
  setRepoOkLine: (value: string) => void;
  applyEasConnectionState: (payload: {
    ok: boolean;
    state: VerificationContractState;
    verifiedAt: string | null;
  }) => void;
  persistConnLights: (entries: Array<[string, string]>) => Promise<void>;
  removeConnLights: (keys: string[]) => Promise<void>;
};

export function useConnectionsHydration(params: Params) {
  const {
    selectedRepo,
    expoToken,
    setGithubToken,
    setExpoToken,
    setWorkflowAdminKey,
    setAndroidKeystoreExportAdminKey,
    setSupabaseRaw,
    setSupabaseUrl,
    setSupabaseAnonKey,
    setEasProjectId,
    setGithubOk,
    setGithubUser,
    setGithubScopes,
    setSupabaseOk,
    setSupabaseRef,
    setExpoOk,
    setExpoUser,
    setRepoOk,
    setRepoOkLine,
    applyEasConnectionState,
    persistConnLights,
    removeConnLights,
  } = params;
  const [hydrated, setHydrated] = useState(false);
  const didAutoTestEas = useRef(false);

  const applyHydrationSnapshotState = useCallback(
    (snapshot: HydrationSnapshot, normalizedSupabaseRaw: string) => {
      setGithubToken(snapshot.githubToken);
      setExpoToken(snapshot.expoToken);
      setWorkflowAdminKey(snapshot.workflowAdminKey);
      setAndroidKeystoreExportAdminKey(snapshot.androidKeystoreExportAdminKey);
      setSupabaseRaw(normalizedSupabaseRaw);
      setSupabaseUrl(snapshot.supabaseUrl);
      setSupabaseAnonKey(snapshot.supabaseAnonKey);
      setEasProjectId(snapshot.easProjectId);

      const restored = resolveHydrationLightsState(snapshot.lights);
      setGithubOk(restored.githubOk);
      setGithubUser(restored.githubUser);
      setGithubScopes(restored.githubScopes);
      setSupabaseOk(restored.supabaseOk);
      setSupabaseRef(restored.supabaseRef);
      setExpoOk(restored.expoOk);
      setExpoUser(restored.expoUser);
      applyEasConnectionState({
        ok: restored.easOk,
        state: restored.easState ?? "missing",
        verifiedAt: restored.easLastVerifiedAt,
      });
      setRepoOk(restored.repoOk);
      setRepoOkLine(restored.repoOkLine);
      setHydrated(true);
    },
    [
      setGithubToken,
      setExpoToken,
      setWorkflowAdminKey,
      setAndroidKeystoreExportAdminKey,
      setSupabaseRaw,
      setSupabaseUrl,
      setSupabaseAnonKey,
      setEasProjectId,
      setGithubOk,
      setGithubUser,
      setGithubScopes,
      setSupabaseOk,
      setSupabaseRef,
      setExpoOk,
      setExpoUser,
      applyEasConnectionState,
      setRepoOk,
      setRepoOkLine,
    ],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const snapshot = await loadHydrationSnapshot(AsyncStorage, {
        getGitHubToken,
        getExpoToken,
        getWorkflowAdminKey,
        getAndroidKeystoreExportAdminKey,
        getSupabaseAnonKey,
      }, selectedRepo);

      const normalizedStoredSupabaseRaw = normalizeStoredSupabaseRaw(
        snapshot.supabaseRaw,
        snapshot.supabaseUrl,
      );
      if (snapshot.supabaseRaw !== normalizedStoredSupabaseRaw) {
        void runCleanupTask(
          () => persistConnLights([[STORAGE_KEYS.SUPABASE_RAW, normalizedStoredSupabaseRaw]]),
          `[ConnectionsScreen] normalize persisted supabase raw failed for key=${STORAGE_KEYS.SUPABASE_RAW}`,
        );
      }

      if (!mounted) return;
      applyHydrationSnapshotState(snapshot, normalizedStoredSupabaseRaw);
    })();

    return () => {
      mounted = false;
    };
  }, [applyHydrationSnapshotState, persistConnLights, selectedRepo]);

  useEffect(() => {
    if (!hydrated) return;
    if (!expoToken.trim()) {
      setExpoOk(false);
      setExpoUser("");
      void runCleanupTask(
        () => persistConnLights([[STORAGE_KEYS.CONN_EXPO_OK, "false"]]),
        `[ConnectionsScreen] persist expo-off flag failed for key=${STORAGE_KEYS.CONN_EXPO_OK}`,
      );
      void runCleanupTask(
        () => removeConnLights([STORAGE_KEYS.CONN_EXPO_USER]),
        `[ConnectionsScreen] remove persisted expo-user failed for key=${STORAGE_KEYS.CONN_EXPO_USER}`,
      );
    }
  }, [hydrated, expoToken, setExpoOk, setExpoUser, persistConnLights, removeConnLights]);

  return {
    hydrated,
    didAutoTestEas,
  };
}
