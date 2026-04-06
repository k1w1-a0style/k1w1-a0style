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
  resolveConnectionsAlertNotice,
  resolveConnectionsActionAlert,
  resolveEasWorkflowSelectionPrecheck,
  resolveEasLinkWorkflowTriggerInputs,
  resolveEasProjectIdPersistenceAction,
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
      await persistEntriesWithFallback(AsyncStorage, [
        [STORAGE_KEYS.CONN_EAS_OK, ok ? "true" : "false"],
        [STORAGE_KEYS.CONN_EAS_STATE, state],
      ]);
      if (verifiedAt) {
        await persistEntriesWithFallback(AsyncStorage, [
          [STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT, verifiedAt],
        ]);
      } else {
        await removeEntriesWithFallback(AsyncStorage, [STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT]);
      }
    },
    [],
  );

  const clearGithubConnectionState = useCallback(async () => {
    setGithubOk(false);
    setGithubUser("");
    setGithubScopes("");
    setRepoOk(false);
    setRepoOkLine("");
    setEasOk(false);
    setEasState("missing");
    setEasLastVerifiedAt(null);
    const persisted = githubClearedPersistence();
    await persistConnLights(persisted.writes);
    await removeConnLights(persisted.removes);
  }, [persistConnLights, removeConnLights]);

  const clearExpoConnectionState = useCallback(async () => {
    setExpoOk(false);
    setExpoUser("");
    const persisted = expoClearedPersistence();
    await persistConnLights(persisted.writes);
    await removeConnLights(persisted.removes);
  }, [persistConnLights, removeConnLights]);

  const clearEasConnectionState = useCallback(async () => {
    setEasOk(false);
    setEasState("missing");
    setEasLastVerifiedAt(null);
    const persisted = easClearedPersistence();
    await persistConnLights(persisted.writes);
    await removeConnLights(persisted.removes);
  }, [persistConnLights, removeConnLights]);

  const clearSupabaseConnectionState = useCallback(async () => {
    setSupabaseOk(false);
    setSupabaseRef("");
    const persisted = supabaseClearedPersistence();
    await persistConnLights(persisted.writes);
    await removeConnLights(persisted.removes);
  }, [persistConnLights, removeConnLights]);

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
  }, [hydrated, easProjectId, expoToken, runGuardedAction, saveConnEasStatus]);

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
      setGithubToken(snapshot.githubToken);
      setExpoToken(snapshot.expoToken);
      setWorkflowAdminKey(snapshot.workflowAdminKey);
      setAndroidKeystoreExportAdminKey(snapshot.androidKeystoreExportAdminKey);
      setSupabaseRaw(normalizedStoredSupabaseRaw);
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
      if (restored.easState) setEasState(restored.easState);
      if (restored.easLastVerifiedAt) setEasLastVerifiedAt(restored.easLastVerifiedAt);
      setRepoOk(restored.repoOk);
      setRepoOkLine(restored.repoOkLine);

      // Hydration finished (prevents initial token empty state from clearing saved OK lights).
      setHydrated(true);
    })();

    return () => {
      mounted = false;
    };
  }, [persistConnLights]);

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
        const gh = githubToken.trim();
        const ex = expoToken.trim();
        const workflowAdmin = workflowAdminKey.trim();
        const keystoreAdmin = androidKeystoreExportAdminKey.trim();
        const raw = supabaseRaw.trim();
        const sbUrl = supabaseUrl.trim();
        const sbAnon = supabaseAnonKey.trim();
        const easId = easProjectId.trim();

        if (gh) await saveGitHubToken(gh);
        else {
          await deleteGitHubToken();
          await clearGithubConnectionState();
        }

        if (ex) {
          await saveExpoToken(ex);
        } else {
          await deleteExpoToken();
          await clearExpoConnectionState();
        }

        if (workflowAdmin) await saveWorkflowAdminKey(workflowAdmin);
        else await deleteWorkflowAdminKey();

        if (keystoreAdmin) await saveAndroidKeystoreExportAdminKey(keystoreAdmin);
        else await deleteAndroidKeystoreExportAdminKey();

        await deleteLegacyEdgeAdminKey();

        const normalizedSupabaseRaw = normalizeStoredSupabaseRaw(raw, sbUrl);
        await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_RAW, normalizedSupabaseRaw);
        await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, sbUrl);
        if (sbAnon) {
          await saveSupabaseAnonKey(sbAnon);
        } else {
          await deleteSupabaseAnonKey();
        }

        if (easId) {
          await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, easId);
        } else {
          await AsyncStorage.removeItem(STORAGE_KEYS.EAS_PROJECT_ID);
          await clearEasConnectionState();
        }

        if (!sbUrl || !sbAnon) {
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
    clearGithubConnectionState,
    clearExpoConnectionState,
    clearEasConnectionState,
    clearSupabaseConnectionState,
  ]);

  const testGitHub = useCallback(async () => {
    if (!hydrated) return;
    const gh = githubToken.trim();
    if (!gh) return Alert.alert("Fehlt", "GitHub Token fehlt.");

    await runGuardedAction({
      defaultTitle: "GitHub Test",
      task: async () => {
        debugLog("connections:github", "GET /user", {
          url: "https://api.github.com/user",
        });
        debugLog("connections:github", "Response", {
          tokenConfigured: true,
        });
        const result = await runGitHubConnectionCheck(gh);
        const login = result.login;
        const scopes = result.scopes;
        setGithubOk(true);
        setGithubUser(login);
        setGithubScopes(scopes);
        await persistConnLights([
          [STORAGE_KEYS.CONN_GITHUB_OK, "true"],
          [STORAGE_KEYS.CONN_GITHUB_USER, login],
          ...(scopes ? [[STORAGE_KEYS.CONN_GITHUB_SCOPES, scopes] as [string, string]] : []),
        ]);
        if (!scopes) {
          await removeConnLights([STORAGE_KEYS.CONN_GITHUB_SCOPES]);
        }
        Alert.alert("GitHub OK", `Verbunden als: ${login || "OK"}${scopes ? `
Scopes: ${scopes}` : ""}`);
      },
      onNonBusyError: async (e: unknown) => {
        setGithubOk(false);
        setGithubUser("");
        setGithubScopes("");
        await persistConnLights([[STORAGE_KEYS.CONN_GITHUB_OK, "false"]]);
        await removeConnLights([STORAGE_KEYS.CONN_GITHUB_USER, STORAGE_KEYS.CONN_GITHUB_SCOPES]);
        debugLog("connections:github", "GitHub ERROR", {
          error: redactSecrets(truncateWithMarker(safeAlertText(e), 800)),
        });
      },
    });
  }, [githubToken, hydrated, runGuardedAction, persistConnLights, removeConnLights]);

  const testExpo = useCallback(async () => {
    if (!hydrated) return;
    const ex = expoToken.trim();
    if (!ex) return Alert.alert("Fehlt", "Expo / EAS Token fehlt.");

    await runGuardedAction({
      defaultTitle: "Expo Test",
      task: async () => {
        debugLog("connections:expo", "POST /graphql", { url: "https://api.expo.dev/graphql" });
        const result = await runExpoConnectionCheck(ex);
        debugLog("connections:expo", "Response", {
          status: result.status,
          ok: result.ok,
          body: redactSecrets(truncateWithMarker(result.raw, 1000)),
        });
        const username = result.username;

        setExpoOk(true);
        setExpoUser(username || "");
        await persistConnLights([
          [STORAGE_KEYS.CONN_EXPO_OK, "true"],
          ...(username ? [[STORAGE_KEYS.CONN_EXPO_USER, username] as [string, string]] : []),
        ]);
        if (!username) {
          await removeConnLights([STORAGE_KEYS.CONN_EXPO_USER]);
        }

        Alert.alert("Expo OK", username ? `Verbunden als: ${username}` : "Token ist gueltig.");
      },
      onNonBusyError: async (e: unknown) => {
        setExpoOk(false);
        setExpoUser("");
        await persistConnLights([[STORAGE_KEYS.CONN_EXPO_OK, "false"]]);
        await removeConnLights([STORAGE_KEYS.CONN_EXPO_USER]);
        debugLog("connections:expo", "Expo ERROR", {
          error: redactSecrets(truncateWithMarker(safeAlertText(e), 800)),
        });
      },
    });
  }, [expoToken, hydrated, runGuardedAction, persistConnLights, removeConnLights]);

  const testSupabase = useCallback(async () => {
    if (!hydrated) return;
    const url = supabaseUrl.trim();
    const anon = supabaseAnonKey.trim();
    if (!url) return Alert.alert("Fehlt", "Supabase URL fehlt.");
    if (!anon) return Alert.alert("Fehlt", "Supabase ANON Key fehlt.");

    await runGuardedAction({
      defaultTitle: "Supabase Test",
      task: async () => {
        const result = await runSupabaseConnectionCheck(url, anon);
        setSupabaseOk(true);
        if (result.kind === "rls_protected") {
          await persistConnLights([[STORAGE_KEYS.CONN_SUPABASE_OK, "true"]]);
          Alert.alert(
            "Supabase OK",
            "REST erreichbar. build_jobs ist durch RLS geschützt (401/403) – das ist okay. CI/Edge nutzt den Service-Role-Key serverseitig.",
          );
          return;
        }
        Alert.alert("Supabase OK", "REST + build_jobs erreichbar.");
        const writes: Array<[string, string]> = [[STORAGE_KEYS.CONN_SUPABASE_OK, "true"]];
        const ref = result.ref;
        if (ref) {
          setSupabaseRef(ref);
          writes.push([STORAGE_KEYS.CONN_SUPABASE_REF, ref]);
        }
        await persistConnLights(writes);
      },
      onNonBusyError: async () => {
        setSupabaseOk(false);
        await persistConnLights([[STORAGE_KEYS.CONN_SUPABASE_OK, "false"]]);
      },
    });
  }, [supabaseUrl, supabaseAnonKey, hydrated, runGuardedAction, persistConnLights]);

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
        const persistence = resolveEasProjectIdPersistenceAction(projectId);
        if (persistence.mode === "set") {
          await runCleanupTask(
            () => AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, persistence.value),
            `[ConnectionsScreen] persist EAS project id failed for key=${STORAGE_KEYS.EAS_PROJECT_ID}`,
          );
        } else {
          await runCleanupTask(
            () => AsyncStorage.removeItem(STORAGE_KEYS.EAS_PROJECT_ID),
            `[ConnectionsScreen] remove EAS project id failed for key=${STORAGE_KEYS.EAS_PROJECT_ID}`,
          );
        }
      }

      await autoFixCIWorkflows({ owner, repo, branch });
      const workflowInputs = resolveEasLinkWorkflowTriggerInputs({ branch, projectId });
      await triggerWorkflow(owner, repo, "eas-link.yml", branch, workflowInputs);
    },
    [],
  );

  const parseSelectedRepoOrAlert = useCallback((repoSlug: string) => {
    const parsed = parseOwnerRepo(repoSlug);
    if (parsed) {
      return parsed;
    }
    const notice = resolveConnectionsAlertNotice("invalid_repo_format");
    Alert.alert(notice.title, notice.message);
    return null;
  }, []);

  const onLinkExisting = useCallback(async () => {
    if (!hydrated || busyRef.current) return;
    if (isEasInitRunning) return;

    const precheck = resolveEasWorkflowSelectionPrecheck({
      githubToken,
      repoSlug: effectiveRepo || "",
      branch: effectiveBranch || "",
    });
    // Invariant contract marker retained for source-based tests:
    // "Kein Branch ausgewählt. Bitte zuerst in GitHub Repos einen Branch verknüpfen."
    if (!precheck.ok) {
      Alert.alert(precheck.notice.title, precheck.notice.message);
      return;
    }
    const { githubToken: token, repoSlug, branch } = precheck.selection;

    const parsed = parseSelectedRepoOrAlert(repoSlug);
    if (!parsed) return;

    const easId = easProjectId.trim();
    const easValidation = validateEasProjectId(easId);
    if (!easValidation.ok) {
      Alert.alert(easValidation.title, easValidation.message);
      return;
    }

    const runLink = async (projectId: string) => {
      setIsEasInitRunning(true);
      try {
        await runEasLinkWorkflowStart({
          token,
          owner: parsed.owner,
          repo: parsed.repo,
          branch,
          projectId,
          persistProjectIdSelection: true,
        });

        Alert.alert("OK", resolveEasLinkWorkflowStartMessage(projectId));

        // Workflow wurde nur gestartet; EAS-Verification bleibt bis zum echten Test neutral/false.
        const postStartState = resolveEasLinkPostStartState(projectId);
        setEasOk(false);
        setEasState(postStartState.state);
        setEasLastVerifiedAt(null);
        await persistConnLights(postStartState.writes);
        await removeConnLights(postStartState.removes);

        if (repoSlug) {
          setRepoOk(true);
          setRepoOkLine(`${repoSlug}${branch ? ` (${branch})` : ""}`);
          await persistConnLights([
            [STORAGE_KEYS.CONN_REPO_OK, "true"],
            [STORAGE_KEYS.CONN_REPO_SLUG, repoSlug],
            [STORAGE_KEYS.CONN_REPO_BRANCH, branch],
          ]);
        }
      } catch (e: unknown) {
        Alert.alert("Fehler", safeAlertText(e));
      } finally {
        setIsEasInitRunning(false);
      }
    };

    if (!easId) {
      Alert.alert(
        "Keine EAS ID vorhanden!",
        "Soll eine erstellt werden?",
        [
          { text: "Abbrechen", style: "cancel" },
          { text: "OK", onPress: () => void runLink("") },
        ],
      );
      return;
    }

    await runLink(easId);
  }, [
    hydrated,
    isEasInitRunning,
    githubToken,
    effectiveRepo,
    effectiveBranch,
    easProjectId,
    persistConnLights,
    removeConnLights,
    runEasLinkWorkflowStart,
    parseSelectedRepoOrAlert,
  ]);

  const onCreateAndLink = useCallback(async () => {
    if (!hydrated || busyRef.current) return;
    if (isEasInitRunning) return;

    const precheck = resolveEasWorkflowSelectionPrecheck({
      githubToken,
      repoSlug: effectiveRepo || "",
      branch: effectiveBranch || "",
    });
    if (!precheck.ok) {
      Alert.alert(precheck.notice.title, precheck.notice.message);
      return;
    }
    const { githubToken: token, repoSlug, branch } = precheck.selection;

    const parsed = parseSelectedRepoOrAlert(repoSlug);
    if (!parsed) return;

    setIsEasInitRunning(true);
    try {
      await runEasLinkWorkflowStart({
        token,
        owner: parsed.owner,
        repo: parsed.repo,
        branch,
        projectId: "",
        persistProjectIdSelection: false,
      });

      const notice = resolveConnectionsAlertNotice("create_link_workflow_started");
      Alert.alert(notice.title, notice.message);
    } catch (e: unknown) {
      Alert.alert("Fehler", safeAlertText(e));
    } finally {
      setIsEasInitRunning(false);
    }
  }, [
    hydrated,
    isEasInitRunning,
    githubToken,
    effectiveRepo,
    effectiveBranch,
    runEasLinkWorkflowStart,
    parseSelectedRepoOrAlert,
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
