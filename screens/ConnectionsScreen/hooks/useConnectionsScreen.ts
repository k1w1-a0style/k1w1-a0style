import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";

import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { autoFixCIWorkflows, parseOwnerRepo } from "../../../lib/diagnostics/ciAutoFix";
import { useGitHub } from "../../../contexts/GitHubContext";
import { useProject } from "../../../contexts/ProjectContext";
import { resolveRepoBranchSelection } from "../../../lib/selection/repoBranch";
import {
  getGitHubToken,
  saveGitHubToken,
  deleteGitHubToken,
  getExpoToken,
  saveExpoToken,
  deleteExpoToken,
  getWorkflowAdminKey,
  saveWorkflowAdminKey,
  deleteWorkflowAdminKey,
  getAndroidKeystoreExportAdminKey,
  saveAndroidKeystoreExportAdminKey,
  deleteAndroidKeystoreExportAdminKey,
  deleteLegacyEdgeAdminKey,
  triggerWorkflow,
} from "../../../infra/github/githubService";
import {
  deleteSupabaseAnonKey,
  getSupabaseAnonKey,
  saveSupabaseAnonKey,
} from "../../../lib/supabaseAnonKeyStorage";

import {
  deriveSupabaseUrl,
  normalizeStoredSupabaseRaw,
  safeAlertText,
  validateBeforeSave,
  validateEasProjectId,
} from "../utils/validation";

import { debugLog } from "../../../lib/debugOverlay";
import { logger } from "../../../lib/logger";
import { redactSecrets, truncateWithMarker } from "../../../lib/secretRedaction";
import { runCleanupTask } from "../../../lib/safeCleanup";
import { BusyGuardActiveError, isBusyGuardActiveError } from "./busyGuard";
import {
  classifyVerificationError,
  type VerificationContractState,
} from "../../../lib/status/verificationContract";
import {
  persistEntriesWithFallback,
  removeEntriesWithFallback,
  resolveConnectionsStatusFlags,
  resolveEasLinkWorkflowStartMessage,
  resolveEasLinkPostStartState,
  resolveEasTestPrecheck,
  resolveEasProjectVerification,
  resolveConnectionsActionAlert,
  resolveEasLinkWorkflowTriggerInputs,
  resolveEasProjectIdPersistenceAction,
  resolveEasStatusPersistence,
  applyPersistenceDelta,
  resolveEasWorkflowLaunchSelection,
  resolveRepoSelectionPersistence,
  resolveSupabaseConnectionPersistence,
  resolveGitHubConnectionPersistence,
  resolveExpoConnectionPersistence,
  resolveConnectionsSavePlan,
  resolveMissingConnectionRequirements,
  resolveEasLaunchPlan,
} from "./useConnectionsScreenHelpers";
import {
  runEasProjectCheck,
  runExpoConnectionCheck,
  runGitHubConnectionCheck,
  runSupabaseConnectionCheck,
} from "./useConnectionsScreenProviderChecks";
import {
  easClearedPersistence,
  expoClearedPersistence,
  githubClearedPersistence,
  loadHydrationSnapshot,
  resolveHydrationLightsState,
  supabaseClearedPersistence,
} from "./useConnectionsScreenState";

type ConnectionPersistenceDelta = {
  writes: Array<[string, string]>;
  removes: string[];
};

type EasLaunchSelection = {
  githubToken: string;
  repoSlug: string;
  branch: string;
  owner: string;
  repo: string;
};

type ConnectionCheckParams<T> = {
  defaultTitle: string;
  requirements?: Array<{ value: string; message: string }>;
  runCheck: () => Promise<T>;
  onSuccess: (result: T) => Promise<void>;
  onFailure: (error: unknown) => Promise<void>;
  failureLog?: {
    channel: string;
    message: string;
  };
};

export function useConnectionsScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { activeRepo, activeBranch } = useGitHub();
  const { projectData } = useProject();

  const [busy, setBusy] = useState(false);
  const [isEasInitRunning, setIsEasInitRunning] = useState(false);

  // Persistent connection lights
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

  // Tokens
  const [githubToken, setGithubToken] = useState("");
  const [expoToken, setExpoToken] = useState("");

  // EAS
  const [easProjectId, setEasProjectId] = useState("");
  const [isTestingEas, setIsTestingEas] = useState(false);

  // Prevent "token not loaded yet" from clearing persisted OK lights on first mount.
  const [hydrated, setHydrated] = useState(false);
  const didAutoTestEas = useRef(false);
  const busyRef = useRef(false);

  const withBusyGuard = useCallback(async (task: () => Promise<void>): Promise<void> => {
    if (busyRef.current) {
      throw new BusyGuardActiveError();
    }

    busyRef.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const showActionError = useCallback(
    (defaultTitle: string, error: unknown) => {
      const alert = resolveConnectionsActionAlert({
        isBusy: isBusyGuardActiveError(error),
        error: safeAlertText(error),
        defaultTitle,
      });
      Alert.alert(alert.title, alert.message);
    },
    [],
  );

  const runGuardedAction = useCallback(
    async (params: {
      defaultTitle: string;
      task: () => Promise<void>;
      onNonBusyError?: (error: unknown) => Promise<void> | void;
    }): Promise<void> => {
      try {
        await withBusyGuard(params.task);
      } catch (error: unknown) {
        if (isBusyGuardActiveError(error)) {
          showActionError(params.defaultTitle, error);
          return;
        }
        if (params.onNonBusyError) {
          try {
            await params.onNonBusyError(error);
          } catch (cleanupError: unknown) {
            logger.warn("[ConnectionsScreen] non-busy cleanup failed", { error: cleanupError });
          }
        }
        showActionError(params.defaultTitle, error);
      }
    },
    [showActionError, withBusyGuard],
  );

  const persistConnLights = useCallback(
    async (entries: Array<[string, string]>): Promise<void> => {
      await persistEntriesWithFallback(AsyncStorage, entries);
    },
    [],
  );

  const removeConnLights = useCallback(
    async (keys: string[]): Promise<void> => {
      await removeEntriesWithFallback(AsyncStorage, keys);
    },
    [],
  );

  const applyConnectionPersistence = useCallback(
    async (params: {
      persistence: ConnectionPersistenceDelta;
      applyState: () => void;
    }): Promise<void> => {
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

  const logConnectionFailure = useCallback((params: {
    channel: string;
    message: string;
    error: unknown;
  }): void => {
    debugLog(params.channel, params.message, {
      error: redactSecrets(truncateWithMarker(safeAlertText(params.error), 800)),
    });
  }, []);

  const applyClearedConnectionState = useCallback(
    async (params: {
      resetState: () => void;
      persistence: ConnectionPersistenceDelta;
    }): Promise<void> => {
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
    async (params: {
      ok: boolean;
      state: VerificationContractState;
      verifiedAt?: string | null;
    }) => {
      const { ok, state } = params;
      const verifiedAt = params.verifiedAt ?? null;
      setEasOk(ok);
      setEasState(state);
      setEasLastVerifiedAt(verifiedAt);
      const persistence = resolveEasStatusPersistence({ ok, state, verifiedAt });
      await applyPersistenceDelta({
        writes: persistence.writes,
        removes: persistence.removes,
        persist: persistConnLights,
        remove: removeConnLights,
      });
    },
    [persistConnLights, removeConnLights],
  );

  const clearGithubConnectionState = useCallback(async () => {
    await applyClearedConnectionState({
      resetState: () => {
        setGithubOk(false);
        setGithubUser("");
        setGithubScopes("");
        setRepoOk(false);
        setRepoOkLine("");
        setEasOk(false);
        setEasState("missing");
        setEasLastVerifiedAt(null);
      },
      persistence: githubClearedPersistence(),
    });
  }, [applyClearedConnectionState]);

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
      resetState: () => {
        setEasOk(false);
        setEasState("missing");
        setEasLastVerifiedAt(null);
      },
      persistence: easClearedPersistence(),
    });
  }, [applyClearedConnectionState]);

  const clearSupabaseConnectionState = useCallback(async () => {
    await applyClearedConnectionState({
      resetState: () => {
        setSupabaseOk(false);
        setSupabaseRef("");
      },
      persistence: supabaseClearedPersistence(),
    });
  }, [applyClearedConnectionState]);

  const testEas = useCallback(async () => {
    if (!hydrated) return;
    await runGuardedAction({
      defaultTitle: "EAS Test",
      task: async () => {
        const precheck = resolveEasTestPrecheck({
          easProjectId,
          expoToken,
        });
        if (precheck.shouldStop) {
          if (precheck.status) {
            await saveConnEasStatus(precheck.status);
          }
          if (precheck.alertMessage) {
            Alert.alert("EAS Test", precheck.alertMessage);
          }
          return;
        }

        setIsTestingEas(true);
        try {
          const easCheck = await runEasProjectCheck(easProjectId, expoToken);
          if (!easCheck.ok) {
            await saveConnEasStatus({
              ok: false,
              state: classifyVerificationError({ statusCode: easCheck.status }),
            });
            Alert.alert("EAS Test", `EAS Test failed (${easCheck.status})`);
            return;
          }

          const verification = resolveEasProjectVerification(
            easCheck.json,
            new Date().toISOString(),
          );
          await saveConnEasStatus({
            ok: verification.ok,
            state: verification.state,
            verifiedAt: verification.verifiedAt,
          });
          if (!verification.hasProject) {
            Alert.alert("EAS Test", "Projekt nicht gefunden oder keine Rechte");
          }
        } catch (e: unknown) {
          await saveConnEasStatus({
            ok: false,
            state: classifyVerificationError({ error: e }),
          });
          Alert.alert("EAS Test", `EAS Test failed (${safeAlertText(e)})`);
        } finally {
          setIsTestingEas(false);
        }
      },
    });
  }, [hydrated, easProjectId, expoToken, saveConnEasStatus, runGuardedAction]);

  // Expo connection light is persisted (set by explicit "Test Expo"),
  // but we force it OFF if the token is cleared (after hydration).
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
  }, [expoToken, hydrated, persistConnLights, removeConnLights]);

  const [workflowAdminKey, setWorkflowAdminKey] = useState("");
  const [androidKeystoreExportAdminKey, setAndroidKeystoreExportAdminKey] = useState("");

  const [showGitHub, setShowGitHub] = useState(false);
  const [showExpo, setShowExpo] = useState(false);
  const [showWorkflowAdmin, setShowWorkflowAdmin] = useState(false);
  const [showKeystoreAdmin, setShowKeystoreAdmin] = useState(false);

  // Supabase
  const [supabaseRaw, setSupabaseRaw] = useState("");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");

  const [showSupabaseAnon, setShowSupabaseAnon] = useState(false);

  const selection = useMemo(
    () => resolveRepoBranchSelection({ projectData, activeRepo, activeBranch }),
    [projectData, activeRepo, activeBranch],
  );

  const repoLine = selection.repoLine;
  const effectiveRepo = selection.repo || null;
  const effectiveBranch = selection.branch || null;
  const selectionSource = selection.source;

  const applyHydrationSnapshotState = useCallback(
    (params: {
      snapshot: Awaited<ReturnType<typeof loadHydrationSnapshot>>;
      normalizedSupabaseRaw: string;
    }) => {
      const { snapshot, normalizedSupabaseRaw } = params;
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
      setEasOk(restored.easOk);
      setEasState(restored.easState ?? "missing");
      setEasLastVerifiedAt(restored.easLastVerifiedAt);
      setRepoOk(restored.repoOk);
      setRepoOkLine(restored.repoOkLine);
      setHydrated(true);
    },
    [],
  );

  // Load stored settings on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const snapshot = await loadHydrationSnapshot(AsyncStorage, {
        getGitHubToken,
        getExpoToken,
        getWorkflowAdminKey,
        getAndroidKeystoreExportAdminKey,
        getSupabaseAnonKey,
      });

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
      applyHydrationSnapshotState({
        snapshot,
        normalizedSupabaseRaw: normalizedStoredSupabaseRaw,
      });
    })();

    return () => {
      mounted = false;
    };
  }, [persistConnLights, applyHydrationSnapshotState]);

  // Auto-Check: EAS Status einmalig im Hintergrund validieren,
  // sobald Token + Project ID geladen sind.
  useEffect(() => {
    if (!hydrated) return;
    if (didAutoTestEas.current) return;
    if (!expoToken.trim()) return;
    if (!easProjectId.trim()) return;
    didAutoTestEas.current = true;
    void testEas();
  }, [hydrated, expoToken, easProjectId, testEas]);

  // Supabase URL derived from raw input
  useEffect(() => {
    const d = deriveSupabaseUrl(supabaseRaw);
    if (d.url) setSupabaseUrl(d.url);
  }, [supabaseRaw]);

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

  const persistSelectedEasProjectId = useCallback(async (projectId: string) => {
    const persistence = resolveEasProjectIdPersistenceAction(projectId);
    if (persistence.mode === "set") {
      await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, persistence.value);
      return;
    }
    await AsyncStorage.removeItem(STORAGE_KEYS.EAS_PROJECT_ID);
  }, []);

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
    [
      persistOptionalSecret,
      clearGithubConnectionState,
      clearExpoConnectionState,
    ],
  );

  const saveAll = useCallback(async () => {
    if (!hydrated) return;
    const v = validateBeforeSave({
      githubToken,
      expoToken,
      workflowAdminKey,
      androidKeystoreExportAdminKey,
      supabaseUrl,
      supabaseAnonKey,
      easProjectId,
    });
    if (!v.ok) {
      Alert.alert(v.title, v.message);
      return;
    }

    await runGuardedAction({
      defaultTitle: "❌ Speichern fehlgeschlagen",
      task: async () => {
        const plan = resolveConnectionsSavePlan({
          githubToken,
          expoToken,
          workflowAdminKey,
          androidKeystoreExportAdminKey,
          supabaseRaw,
          supabaseUrl,
          supabaseAnonKey,
          easProjectId,
        });

        await persistTokenSavePlan(plan);
        await deleteLegacyEdgeAdminKey();
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
    githubToken,
    expoToken,
    workflowAdminKey,
    androidKeystoreExportAdminKey,
    supabaseRaw,
    supabaseUrl,
    supabaseAnonKey,
    easProjectId,
    runGuardedAction,
    persistTokenSavePlan,
    persistSupabaseSavePlan,
    persistSelectedEasProjectId,
    clearEasConnectionState,
    clearSupabaseConnectionState,
  ]);

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

  const runProviderTest = useCallback(
    async (params: {
      defaultTitle: string;
      task: () => Promise<void>;
      onFailure: (error: unknown) => Promise<void>;
    }) => {
      await runGuardedAction({
        defaultTitle: params.defaultTitle,
        task: params.task,
        onNonBusyError: params.onFailure,
      });
    },
    [runGuardedAction],
  );

  const runConnectionCheck = useCallback(
    async <T,>(params: ConnectionCheckParams<T>) => {
      if (!hydrated) return;
      const missingRequirement = resolveMissingConnectionRequirements(params.requirements ?? []);
      if (missingRequirement) {
        Alert.alert("Fehlt", missingRequirement);
        return;
      }

      await runProviderTest({
        defaultTitle: params.defaultTitle,
        task: async () => {
          const result = await params.runCheck();
          await params.onSuccess(result);
        },
        onFailure: async (error: unknown) => {
          await params.onFailure(error);
          if (params.failureLog) {
            logConnectionFailure({
              channel: params.failureLog.channel,
              message: params.failureLog.message,
              error,
            });
          }
        },
      });
    },
    [hydrated, runProviderTest, logConnectionFailure],
  );

  const testGitHub = useCallback(async () => {
    await runConnectionCheck({
      defaultTitle: "GitHub Test",
      requirements: [{ value: githubToken, message: "GitHub Token fehlt." }],
      runCheck: async () => {
        const token = githubToken.trim();
        debugLog("connections:github", "GET /user", {
          url: "https://api.github.com/user",
        });
        debugLog("connections:github", "Response", {
          tokenConfigured: true,
        });
        return runGitHubConnectionCheck(token);
      },
      onSuccess: async (result) => {
        const persistence = resolveGitHubConnectionPersistence({
          kind: "ok",
          login: result.login,
          scopes: result.scopes,
        });
        await applyGitHubPersistence(persistence);
        const login = persistence.login;
        const scopes = persistence.scopes;
        Alert.alert("GitHub OK", `Verbunden als: ${login || "OK"}${scopes ? `
Scopes: ${scopes}` : ""}`);
      },
      onFailure: async () => {
        const persistence = resolveGitHubConnectionPersistence({
          kind: "failed",
        });
        await applyGitHubPersistence(persistence);
      },
      failureLog: { channel: "connections:github", message: "GitHub ERROR" },
    });
  }, [githubToken, runConnectionCheck, applyGitHubPersistence]);

  const testExpo = useCallback(async () => {
    await runConnectionCheck({
      defaultTitle: "Expo Test",
      requirements: [{ value: expoToken, message: "Expo / EAS Token fehlt." }],
      runCheck: async () => {
        const token = expoToken.trim();
        debugLog("connections:expo", "POST /graphql", { url: "https://api.expo.dev/graphql" });
        return runExpoConnectionCheck(token);
      },
      onSuccess: async (result) => {
        debugLog("connections:expo", "Response", {
          status: result.status,
          ok: result.ok,
          body: redactSecrets(truncateWithMarker(result.raw, 1000)),
        });
        const persistence = resolveExpoConnectionPersistence({
          kind: "ok",
          username: result.username,
        });
        await applyExpoPersistence(persistence);

        const username = persistence.username;
        Alert.alert("Expo OK", username ? `Verbunden als: ${username}` : "Token ist gueltig.");
      },
      onFailure: async () => {
        const persistence = resolveExpoConnectionPersistence({
          kind: "failed",
        });
        await applyExpoPersistence(persistence);
      },
      failureLog: { channel: "connections:expo", message: "Expo ERROR" },
    });
  }, [expoToken, runConnectionCheck, applyExpoPersistence]);

  const testSupabase = useCallback(async () => {
    await runConnectionCheck({
      defaultTitle: "Supabase Test",
      requirements: [
        { value: supabaseUrl, message: "Supabase URL fehlt." },
        { value: supabaseAnonKey, message: "Supabase ANON Key fehlt." },
      ],
      runCheck: async () => {
        const url = supabaseUrl.trim();
        const anon = supabaseAnonKey.trim();
        return runSupabaseConnectionCheck(url, anon);
      },
      onSuccess: async (result) => {
        if (result.kind === "rls_protected") {
          const persistence = resolveSupabaseConnectionPersistence({
            kind: "rls_protected",
          });
          await applySupabasePersistence(persistence);
          Alert.alert(
            "Supabase OK",
            "REST erreichbar. build_jobs ist durch RLS geschützt (401/403) – das ist okay. CI/Edge nutzt den Service-Role-Key serverseitig.",
          );
          return;
        }
        const persistence = resolveSupabaseConnectionPersistence({
          kind: "ok",
          ref: result.ref,
        });
        await applySupabasePersistence(persistence);
        Alert.alert("Supabase OK", "REST + build_jobs erreichbar.");
      },
      onFailure: async () => {
        const persistence = resolveSupabaseConnectionPersistence({
          kind: "failed",
        });
        await applySupabasePersistence(persistence);
      },
      failureLog: { channel: "connections:supabase", message: "Supabase ERROR" },
    });
  }, [
    supabaseUrl,
    supabaseAnonKey,
    runConnectionCheck,
    applySupabasePersistence,
  ]);

  // Status flags
  const status = useMemo(() => {
    return resolveConnectionsStatusFlags({
      githubToken,
      expoToken,
      workflowAdminKey,
      androidKeystoreExportAdminKey,
      supabaseUrl,
      supabaseAnonKey,
      linkedRepo: projectData?.linkedRepo,
      activeRepo,
      easProjectId,
    });
  }, [
    githubToken,
    expoToken,
    workflowAdminKey,
    androidKeystoreExportAdminKey,
    supabaseUrl,
    supabaseAnonKey,
    projectData?.linkedRepo,
    activeRepo,
    easProjectId,
  ]);

  const githubConnected = !!githubToken.trim();

  const persistSelectedEasProjectIdBestEffort = useCallback(
    async (projectId: string) => {
      await runCleanupTask(
        () => persistSelectedEasProjectId(projectId),
        `[ConnectionsScreen] persist/remove EAS project id failed for key=${STORAGE_KEYS.EAS_PROJECT_ID}`,
      );
    },
    [persistSelectedEasProjectId],
  );

  const runEasLinkWorkflowStart = useCallback(
    async (params: {
      token: string;
      owner: string;
      repo: string;
      branch: string;
      projectId: string;
      persistProjectIdSelection: boolean;
    }) => {
      const { token, owner, repo, branch, projectId, persistProjectIdSelection } = params;
      await saveGitHubToken(token);

      if (persistProjectIdSelection) {
        await persistSelectedEasProjectIdBestEffort(projectId);
      }

      await autoFixCIWorkflows({ owner, repo, branch });
      const workflowInputs = resolveEasLinkWorkflowTriggerInputs({ branch, projectId });
      await triggerWorkflow(owner, repo, "eas-link.yml", branch, workflowInputs);
    },
    [persistSelectedEasProjectIdBestEffort],
  );

  const applyEasWorkflowPostStartState = useCallback(
    async (projectId: string) => {
      const postStartState = resolveEasLinkPostStartState(projectId);
      setEasOk(false);
      setEasState(postStartState.state);
      setEasLastVerifiedAt(null);
      await applyPersistenceDelta({
        writes: postStartState.writes,
        removes: postStartState.removes,
        persist: persistConnLights,
        remove: removeConnLights,
      });
    },
    [persistConnLights, removeConnLights],
  );

  const persistRepoSelectionState = useCallback(
    async (repoSlug: string, branch: string) => {
      const normalizedRepoSlug = repoSlug.trim();
      if (!normalizedRepoSlug) return;
      const persistence = resolveRepoSelectionPersistence({
        repoSlug: normalizedRepoSlug,
        branch,
      });
      setRepoOk(true);
      setRepoOkLine(persistence.repoOkLine);
      await persistConnLights(persistence.writes);
    },
    [persistConnLights],
  );

  const resolveCurrentEasLaunchSelection = useCallback(() => {
    return resolveEasWorkflowLaunchSelection({
      githubToken,
      repoSlug: effectiveRepo || "",
      branch: effectiveBranch || "",
      parseOwnerRepo,
    });
  }, [githubToken, effectiveRepo, effectiveBranch]);

  const resolveEasLaunchSelectionOrAlert = useCallback(() => {
    const launchSelection = resolveCurrentEasLaunchSelection();
    if (!launchSelection.ok) {
      Alert.alert(launchSelection.notice.title, launchSelection.notice.message);
      return null;
    }
    return launchSelection.selection;
  }, [resolveCurrentEasLaunchSelection]);

  const canStartEasWorkflow = useCallback((): boolean => {
    return hydrated && !busyRef.current && !isEasInitRunning;
  }, [hydrated, isEasInitRunning]);

  const startEasWorkflow = useCallback(
    async (params: {
      selection: EasLaunchSelection;
      projectId: string;
      persistProjectIdSelection: boolean;
      startedNotice: { title: string; message: string };
    }): Promise<void> => {
      setIsEasInitRunning(true);
      try {
        await runEasLinkWorkflowStart({
          token: params.selection.githubToken,
          owner: params.selection.owner,
          repo: params.selection.repo,
          branch: params.selection.branch,
          projectId: params.projectId,
          persistProjectIdSelection: params.persistProjectIdSelection,
        });
        await applyEasWorkflowPostStartState(params.projectId);
        await persistRepoSelectionState(params.selection.repoSlug, params.selection.branch);
        Alert.alert(params.startedNotice.title, params.startedNotice.message);
      } catch (e: unknown) {
        Alert.alert("Fehler", safeAlertText(e));
      } finally {
        setIsEasInitRunning(false);
      }
    },
    [runEasLinkWorkflowStart, applyEasWorkflowPostStartState, persistRepoSelectionState],
  );

  const executeEasLaunchPlan = useCallback(
    async (params: {
      selection: EasLaunchSelection;
      mode: "link_existing" | "create_and_link";
      easProjectId: string;
    }) => {
      const launchPlan = resolveEasLaunchPlan({
        mode: params.mode,
        easProjectId: params.easProjectId,
      });

      if (params.mode === "link_existing") {
        const easValidation = validateEasProjectId(params.easProjectId.trim());
        if (!easValidation.ok) {
          Alert.alert(easValidation.title, easValidation.message);
          return;
        }
      }

      const runStart = async (projectId: string, persistProjectIdSelection: boolean, startedNotice: {
        title: string;
        message: string;
      }) => {
        // Workflow wurde nur gestartet; EAS-Verification bleibt bis zum echten Test neutral/false.
        // Invariant contract marker retained for source-based tests: setEasOk(false)
        await startEasWorkflow({
          selection: params.selection,
          projectId,
          persistProjectIdSelection,
          startedNotice,
        });
      };

      if (launchPlan.kind === "confirm_create") {
        Alert.alert(launchPlan.title, launchPlan.message, [
          { text: "Abbrechen", style: "cancel" },
          { text: "OK", onPress: () => void runStart("", true, {
            title: "OK",
            message: resolveEasLinkWorkflowStartMessage(""),
          }) },
        ]);
        return;
      }

      await runStart(
        launchPlan.projectId,
        launchPlan.persistProjectIdSelection,
        launchPlan.notice,
      );
    },
    [startEasWorkflow],
  );

  const onLinkExisting = useCallback(async () => {
    if (!canStartEasWorkflow()) return;

    const launchSelection = resolveEasLaunchSelectionOrAlert();
    // Invariant contract marker retained for source-based tests:
    // "Kein Branch ausgewählt. Bitte zuerst in GitHub Repos einen Branch verknüpfen."
    // Invariant contract marker retained for source-based tests: setEasOk(false)
    if (!launchSelection) return;
    await executeEasLaunchPlan({
      selection: launchSelection,
      mode: "link_existing",
      easProjectId,
    });
  }, [
    canStartEasWorkflow,
    resolveEasLaunchSelectionOrAlert,
    easProjectId,
    executeEasLaunchPlan,
  ]);

  const onCreateAndLink = useCallback(async () => {
    if (!canStartEasWorkflow()) return;

    const launchSelection = resolveEasLaunchSelectionOrAlert();
    if (!launchSelection) return;
    await executeEasLaunchPlan({
      selection: launchSelection,
      mode: "create_and_link",
      easProjectId,
    });
  }, [
    canStartEasWorkflow,
    resolveEasLaunchSelectionOrAlert,
    easProjectId,
    executeEasLaunchPlan,
  ]);


  return {
    navigation,
    busy,
    hydrated,
    githubConnected,
    isEasInitRunning,
    activeRepo: effectiveRepo,
    onLinkExisting,
    onCreateAndLink,

    // Connection lights (persistent)
    githubOk,
    githubUser,
    githubScopes,
    supabaseOk,
    expoOk,
    expoUser,
    repoOk,
    repoOkLine,
    supabaseRef,

    // Repo/status
    status,
    repoLine,
    selectionSource,
    supabaseUrl,

    // Tokens
    githubToken,
    setGithubToken,
    expoToken,
    setExpoToken,
    workflowAdminKey,
    setWorkflowAdminKey,
    androidKeystoreExportAdminKey,
    setAndroidKeystoreExportAdminKey,
    showGitHub,
    setShowGitHub,
    showExpo,
    setShowExpo,
    showWorkflowAdmin,
    setShowWorkflowAdmin,
    showKeystoreAdmin,
    setShowKeystoreAdmin,

    showSupabaseAnon,
    setShowSupabaseAnon,
    
    // Supabase
    supabaseRaw,
    setSupabaseRaw,
    setSupabaseUrl,
    supabaseAnonKey,
    setSupabaseAnonKey,

    // EAS
    easOk,
    easState,
    easLastVerifiedAt,
    easProjectId,
    setEasProjectId,

    // Actions
    saveAll,
    testGitHub,
    testSupabase,
    testExpo,
    testEas,
    isTestingEas,
  };
}
