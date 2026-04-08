import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";

import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { useGitHub } from "../../../contexts/GitHubContext";
import { useProject } from "../../../contexts/ProjectContext";
import { resolveRepoBranchSelection } from "../../../lib/selection/repoBranch";
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
import {
  deleteSupabaseAnonKey,
  saveSupabaseAnonKey,
} from "../../../lib/supabaseAnonKeyStorage";
import { debugLog } from "../../../lib/debugOverlay";
import { redactSecrets, truncateWithMarker } from "../../../lib/secretRedaction";
import {
  deriveSupabaseUrl,
  safeAlertText,
  validateBeforeSave,
  normalizeStoredSupabaseRaw,
} from "../utils/validation";
import {
  applyPersistenceDelta,
  persistEntriesWithFallback,
  removeEntriesWithFallback,
  resolveConnectionsSavePlan,
  resolveConnectionsStatusFlags,
  resolveEasProjectIdPersistenceAction,
  resolveEasStatusPersistence,
  resolveExpoConnectionPersistence,
  resolveGitHubConnectionPersistence,
  resolveSupabaseConnectionPersistence,
} from "./useConnectionsScreenHelpers";
import {
  easClearedPersistence,
  expoClearedPersistence,
  githubClearedPersistence,
  supabaseClearedPersistence,
} from "./useConnectionsScreenState";
import { useConnectionsBusyAction } from "./useConnectionsBusyAction";
import { useConnectionsEasLink } from "./useConnectionsEasLink";
import { useConnectionsHydration } from "./useConnectionsHydration";
import { useConnectionsProviderTests } from "./useConnectionsProviderTests";
import { useConnectionsSecretsState } from "./useConnectionsSecretsState";
import type { ConnectionPersistenceDelta, UseConnectionsScreenReturn } from "./connections.contracts";
import {
  type VerificationContractState,
} from "../../../lib/status/verificationContract";

export function useConnectionsScreen(): UseConnectionsScreenReturn {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { activeRepo, activeBranch } = useGitHub();
  const { projectData } = useProject();

  const secrets = useConnectionsSecretsState();
  const { busy, busyRef, runGuardedAction } = useConnectionsBusyAction();

  const [githubOk, setGithubOk] = useState(false);
  const [githubUser, setGithubUser] = useState("");
  const [githubScopes, setGithubScopes] = useState("");
  const [supabaseOk, setSupabaseOk] = useState(false);
  const [supabaseRef, setSupabaseRef] = useState("");
  const [expoOk, setExpoOk] = useState(false);
  const [expoUser, setExpoUser] = useState("");
  const [easOk, setEasOk] = useState(false);
  const [easState, setEasState] = useState<VerificationContractState>("missing");
  const [easLastVerifiedAt, setEasLastVerifiedAt] = useState<string | null>(null);
  const [repoOk, setRepoOk] = useState(false);
  const [repoOkLine, setRepoOkLine] = useState("");

  const applyEasConnectionState = useCallback((status: {
    ok: boolean;
    state: VerificationContractState;
    verifiedAt: string | null;
  }): void => {
    setEasOk(status.ok);
    setEasState(status.state);
    setEasLastVerifiedAt(status.verifiedAt);
  }, []);

  const persistConnLights = useCallback(async (entries: Array<[string, string]>) => {
    await persistEntriesWithFallback(AsyncStorage, entries);
  }, []);

  const removeConnLights = useCallback(async (keys: string[]) => {
    await removeEntriesWithFallback(AsyncStorage, keys);
  }, []);

  const applyConnectionPersistence = useCallback(
    async (params: { persistence: ConnectionPersistenceDelta; applyState: () => void }) => {
      params.applyState();
      await applyPersistenceDelta({
        writes: params.persistence.writes,
        removes: params.persistence.removes,
        persist: persistConnLights,
        remove: removeConnLights,
      });
    },
    [persistConnLights, removeConnLights],
  );

  const logConnectionFailure = useCallback((params: { channel: string; message: string; error: unknown }) => {
    debugLog(params.channel, params.message, {
      error: redactSecrets(truncateWithMarker(safeAlertText(params.error), 800)),
    });
  }, []);

  const applyClearedConnectionState = useCallback(
    async (params: { resetState: () => void; persistence: ConnectionPersistenceDelta }) => {
      params.resetState();
      await applyPersistenceDelta({
        writes: params.persistence.writes,
        removes: params.persistence.removes,
        persist: persistConnLights,
        remove: removeConnLights,
      });
    },
    [persistConnLights, removeConnLights],
  );

  const saveConnEasStatus = useCallback(
    async (params: { ok: boolean; state: VerificationContractState; verifiedAt?: string | null }) => {
      const verifiedAt = params.verifiedAt ?? null;
      applyEasConnectionState({ ok: params.ok, state: params.state, verifiedAt });
      const persistence = resolveEasStatusPersistence({ ok: params.ok, state: params.state, verifiedAt });
      await applyPersistenceDelta({
        writes: persistence.writes,
        removes: persistence.removes,
        persist: persistConnLights,
        remove: removeConnLights,
      });
    },
    [applyEasConnectionState, persistConnLights, removeConnLights],
  );

  const clearGithubConnectionState = useCallback(async () => {
    await applyClearedConnectionState({
      resetState: () => {
        setGithubOk(false);
        setGithubUser("");
        setGithubScopes("");
        setRepoOk(false);
        setRepoOkLine("");
        applyEasConnectionState({ ok: false, state: "missing", verifiedAt: null });
      },
      persistence: githubClearedPersistence(),
    });
  }, [applyClearedConnectionState, applyEasConnectionState]);

  const clearExpoConnectionState = useCallback(async () => {
    await applyClearedConnectionState({
      resetState: () => {
        setExpoOk(false);
        setExpoUser("");
      },
      persistence: expoClearedPersistence(),
    });
  }, [applyClearedConnectionState]);

  const clearEasConnectionState = useCallback(async () => {
    await applyClearedConnectionState({
      resetState: () => applyEasConnectionState({ ok: false, state: "missing", verifiedAt: null }),
      persistence: easClearedPersistence(),
    });
  }, [applyClearedConnectionState, applyEasConnectionState]);

  const clearSupabaseConnectionState = useCallback(async () => {
    await applyClearedConnectionState({
      resetState: () => {
        setSupabaseOk(false);
        setSupabaseRef("");
      },
      persistence: supabaseClearedPersistence(),
    });
  }, [applyClearedConnectionState]);

  const selection = useMemo(
    () => resolveRepoBranchSelection({ projectData, activeRepo, activeBranch }),
    [projectData, activeRepo, activeBranch],
  );
  const repoLine = selection.repoLine;
  const effectiveRepo = selection.repo || null;
  const effectiveBranch = selection.branch || null;
  const selectionSource = selection.source;

  const persistSelectedEasProjectId = useCallback(async (projectId: string) => {
    const persistence = resolveEasProjectIdPersistenceAction(projectId);
    if (persistence.mode === "set") {
      await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, persistence.value);
      return;
    }
    await AsyncStorage.removeItem(STORAGE_KEYS.EAS_PROJECT_ID);
  }, []);

  const { hydrated, didAutoTestEas } = useConnectionsHydration({
    expoToken: secrets.expoToken,
    setGithubToken: secrets.setGithubToken,
    setExpoToken: secrets.setExpoToken,
    setWorkflowAdminKey: secrets.setWorkflowAdminKey,
    setAndroidKeystoreExportAdminKey: secrets.setAndroidKeystoreExportAdminKey,
    setSupabaseRaw: secrets.setSupabaseRaw,
    setSupabaseUrl: secrets.setSupabaseUrl,
    setSupabaseAnonKey: secrets.setSupabaseAnonKey,
    setEasProjectId: secrets.setEasProjectId,
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
  });

  const applyGitHubPersistence = useCallback(
    async (persistence: ReturnType<typeof resolveGitHubConnectionPersistence>) => {
      await applyConnectionPersistence({
        persistence,
        applyState: () => {
          setGithubOk(persistence.ok);
          setGithubUser(persistence.login);
          setGithubScopes(persistence.scopes);
        },
      });
    },
    [applyConnectionPersistence],
  );

  const applyExpoPersistence = useCallback(
    async (persistence: ReturnType<typeof resolveExpoConnectionPersistence>) => {
      await applyConnectionPersistence({
        persistence,
        applyState: () => {
          setExpoOk(persistence.ok);
          setExpoUser(persistence.username);
        },
      });
    },
    [applyConnectionPersistence],
  );

  const applySupabasePersistence = useCallback(
    async (persistence: ReturnType<typeof resolveSupabaseConnectionPersistence>) => {
      await applyConnectionPersistence({
        persistence,
        applyState: () => {
          setSupabaseOk(persistence.ok);
          setSupabaseRef(persistence.ref);
        },
      });
    },
    [applyConnectionPersistence],
  );

  const { testGitHub, testExpo, testSupabase, testEas, isTestingEas } = useConnectionsProviderTests({
    hydrated,
    githubToken: secrets.githubToken,
    expoToken: secrets.expoToken,
    supabaseUrl: secrets.supabaseUrl,
    supabaseAnonKey: secrets.supabaseAnonKey,
    easProjectId: secrets.easProjectId,
    runGuardedAction,
    logConnectionFailure,
    applyGitHubPersistence,
    applyExpoPersistence,
    applySupabasePersistence,
    saveConnEasStatus,
  });

  const { isEasInitRunning, onLinkExisting, onCreateAndLink } = useConnectionsEasLink({
    hydrated,
    easProjectId: secrets.easProjectId,
    githubToken: secrets.githubToken,
    effectiveRepo,
    effectiveBranch,
    busyRef,
    persistSelectedEasProjectId,
    persistConnLights,
    removeConnLights,
    applyEasConnectionState,
    setRepoOk,
    setRepoOkLine,
  });

  useEffect(() => {
    if (!hydrated) return;
    if (didAutoTestEas.current) return;
    if (!secrets.expoToken.trim()) return;
    if (!secrets.easProjectId.trim()) return;
    didAutoTestEas.current = true;
    void testEas();
  }, [hydrated, didAutoTestEas, secrets.expoToken, secrets.easProjectId, testEas]);

  useEffect(() => {
    const d = deriveSupabaseUrl(secrets.supabaseRaw);
    if (d.url) secrets.setSupabaseUrl(d.url);
  }, [secrets.supabaseRaw, secrets.setSupabaseUrl]);

  const persistOptionalSecret = useCallback(
    async (params: {
      value: string;
      save: (value: string) => Promise<void>;
      remove: () => Promise<void>;
      onRemoved?: () => Promise<void>;
    }) => {
      const normalizedValue = params.value.trim();
      if (normalizedValue) {
        await params.save(normalizedValue);
        return;
      }
      await params.remove();
      if (params.onRemoved) {
        await params.onRemoved();
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
    [persistOptionalSecret, clearGithubConnectionState, clearExpoConnectionState],
  );

  const saveAll = useCallback(async () => {
    if (!hydrated) return;
    const v = validateBeforeSave({
      githubToken: secrets.githubToken,
      expoToken: secrets.expoToken,
      workflowAdminKey: secrets.workflowAdminKey,
      androidKeystoreExportAdminKey: secrets.androidKeystoreExportAdminKey,
      supabaseUrl: secrets.supabaseUrl,
      supabaseAnonKey: secrets.supabaseAnonKey,
      easProjectId: secrets.easProjectId,
    });
    if (!v.ok) {
      Alert.alert(v.title, v.message);
      return;
    }

    await runGuardedAction({
      defaultTitle: "❌ Speichern fehlgeschlagen",
      task: async () => {
        const plan = resolveConnectionsSavePlan({
          githubToken: secrets.githubToken,
          expoToken: secrets.expoToken,
          workflowAdminKey: secrets.workflowAdminKey,
          androidKeystoreExportAdminKey: secrets.androidKeystoreExportAdminKey,
          supabaseRaw: secrets.supabaseRaw,
          supabaseUrl: secrets.supabaseUrl,
          supabaseAnonKey: secrets.supabaseAnonKey,
          easProjectId: secrets.easProjectId,
        });

        await persistTokenSavePlan(plan);
        await persistSupabaseSavePlan(plan);
        await persistSelectedEasProjectId(plan.easProjectId);

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
    clearEasConnectionState,
    clearSupabaseConnectionState,
  ]);

  const status = useMemo(
    () =>
      resolveConnectionsStatusFlags({
        githubToken: secrets.githubToken,
        expoToken: secrets.expoToken,
        workflowAdminKey: secrets.workflowAdminKey,
        androidKeystoreExportAdminKey: secrets.androidKeystoreExportAdminKey,
        supabaseUrl: secrets.supabaseUrl,
        supabaseAnonKey: secrets.supabaseAnonKey,
        linkedRepo: projectData?.linkedRepo,
        activeRepo,
        easProjectId: secrets.easProjectId,
      }),
    [
      secrets.githubToken,
      secrets.expoToken,
      secrets.workflowAdminKey,
      secrets.androidKeystoreExportAdminKey,
      secrets.supabaseUrl,
      secrets.supabaseAnonKey,
      secrets.easProjectId,
      projectData?.linkedRepo,
      activeRepo,
    ],
  );

  const githubConnected = !!secrets.githubToken.trim();

  return {
    navigation,
    busy,
    hydrated,
    githubConnected,
    isEasInitRunning,
    activeRepo: effectiveRepo,
    onLinkExisting,
    onCreateAndLink,
    githubOk,
    githubUser,
    githubScopes,
    supabaseOk,
    expoOk,
    expoUser,
    repoOk,
    repoOkLine,
    supabaseRef,
    status,
    repoLine,
    selectionSource,
    supabaseUrl: secrets.supabaseUrl,
    githubToken: secrets.githubToken,
    setGithubToken: secrets.setGithubToken,
    expoToken: secrets.expoToken,
    setExpoToken: secrets.setExpoToken,
    workflowAdminKey: secrets.workflowAdminKey,
    setWorkflowAdminKey: secrets.setWorkflowAdminKey,
    androidKeystoreExportAdminKey: secrets.androidKeystoreExportAdminKey,
    setAndroidKeystoreExportAdminKey: secrets.setAndroidKeystoreExportAdminKey,
    showGitHub: secrets.showGitHub,
    setShowGitHub: secrets.setShowGitHub,
    showExpo: secrets.showExpo,
    setShowExpo: secrets.setShowExpo,
    showWorkflowAdmin: secrets.showWorkflowAdmin,
    setShowWorkflowAdmin: secrets.setShowWorkflowAdmin,
    showKeystoreAdmin: secrets.showKeystoreAdmin,
    setShowKeystoreAdmin: secrets.setShowKeystoreAdmin,
    showSupabaseAnon: secrets.showSupabaseAnon,
    setShowSupabaseAnon: secrets.setShowSupabaseAnon,
    supabaseRaw: secrets.supabaseRaw,
    setSupabaseRaw: secrets.setSupabaseRaw,
    setSupabaseUrl: secrets.setSupabaseUrl,
    supabaseAnonKey: secrets.supabaseAnonKey,
    setSupabaseAnonKey: secrets.setSupabaseAnonKey,
    easOk,
    easState,
    easLastVerifiedAt,
    easProjectId: secrets.easProjectId,
    setEasProjectId: secrets.setEasProjectId,
    saveAll,
    testGitHub,
    testSupabase,
    testExpo,
    testEas,
    isTestingEas,
  };
}
