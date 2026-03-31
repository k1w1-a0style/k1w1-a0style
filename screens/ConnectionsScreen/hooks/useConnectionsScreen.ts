import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";

import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { githubApiUrl } from "../../../shared/constants/github";
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
  getLegacyEdgeAdminKey,
  saveLegacyEdgeAdminKey,
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
  safeAlertText,
  validateBeforeSave,
  validateEasProjectId,
} from "../utils/validation";

import { debugLog } from "../../../lib/debugOverlay";
import { fetchWithTimeout } from "../../../lib/network/fetchWithTimeout";
import { redactSecrets, truncateWithMarker } from "../../../lib/secretRedaction";
import { parseExpoGraphQLUsername } from "../utils/expoGraphql";
import { BusyGuardActiveError, isBusyGuardActiveError } from "./busyGuard";
import {
  classifyVerificationError,
  type VerificationContractState,
} from "../../../lib/status/verificationContract";
import {
  buildRepoOkLine,
  deriveSupabaseRefFromUrl,
  persistEntriesWithFallback,
  removeEntriesWithFallback,
  resolveConnectionsStatusFlags,
  resolveEasLinkWorkflowStartMessage,
  resolveLinkExistingSelectionPrecheck,
  resolveEasTestPrecheck,
  resolveEasProjectVerification,
  resolveConnectionsAlertNotice,
  resolvePersistedEasState,
  type ExpoProjectResponse,
} from "./useConnectionsScreenHelpers";

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
  const [supabaseRef, setSupabaseRef] = useState("" );
  const [expoOk, setExpoOk] = useState(false);
  const [expoUser, setExpoUser] = useState("" );
  const [easOk, setEasOk] = useState(false);
  const [easState, setEasState] = useState<VerificationContractState>("missing");
  const [easLastVerifiedAt, setEasLastVerifiedAt] = useState<string | null>(null);
  const [repoOk, setRepoOk] = useState(false);
  const [repoOkLine, setRepoOkLine] = useState("" );

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

  const saveConnEasStatus = useCallback(async (params: {
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
  }, []);

  const testEas = useCallback(async () => {
    if (!hydrated) return;

    try {
      await withBusyGuard(async () => {
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
          const id = easProjectId.trim();
          const resp = await fetchWithTimeout(
            `https://api.expo.dev/v2/projects/${encodeURIComponent(id)}`,
            {
              timeoutMs: 12_000,
              timeoutMessage: "EAS-Projektprüfung hat das Zeitlimit erreicht. Bitte Expo-Verbindung erneut testen.",
              headers: {
                Authorization: `Bearer ${expoToken.trim()}`,
                Accept: "application/json",
              },
            },
          );

          if (!resp.ok) {
            await saveConnEasStatus({
              ok: false,
              state: classifyVerificationError({ statusCode: resp.status }),
            });
            Alert.alert("EAS Test", `EAS Test failed (${resp.status})`);
            return;
          }

          const json = (await resp.json().catch(() => null)) as ExpoProjectResponse | null;
          const verification = resolveEasProjectVerification(json, new Date().toISOString());
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
      });
    } catch (e: unknown) {
      if (isBusyGuardActiveError(e)) {
        Alert.alert("Bitte warten", e.message);
      } else {
        Alert.alert("EAS Test", safeAlertText(e));
      }
    }
  }, [hydrated, easProjectId, expoToken, saveConnEasStatus, withBusyGuard]);

  // Expo connection light is persisted (set by explicit "Test Expo"),
  // but we force it OFF if the token is cleared (after hydration).
  useEffect(() => {
    if (!hydrated) return;
    if (!expoToken.trim()) {
      setExpoOk(false);
      setExpoUser("");
      AsyncStorage.setItem(STORAGE_KEYS.CONN_EXPO_OK, "false").catch(() => {});
      AsyncStorage.removeItem(STORAGE_KEYS.CONN_EXPO_USER).catch(() => {});
    }
  }, [expoToken, hydrated]);

  const [workflowAdminKey, setWorkflowAdminKey] = useState("");
  const [androidKeystoreExportAdminKey, setAndroidKeystoreExportAdminKey] = useState("");
  const [legacyEdgeAdminKey, setLegacyEdgeAdminKey] = useState("");

  const [showGitHub, setShowGitHub] = useState(false);
  const [showExpo, setShowExpo] = useState(false);
  const [showWorkflowAdmin, setShowWorkflowAdmin] = useState(false);
  const [showKeystoreAdmin, setShowKeystoreAdmin] = useState(false);
  const [showLegacyEdge, setShowLegacyEdge] = useState(false);

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
      const [gh, ex, workflowKey, keystoreKey, legacyEdgeKey] = await Promise.all([
        getGitHubToken().catch(() => ""),
        getExpoToken().catch(() => ""),
        getWorkflowAdminKey().catch(() => ""),
        getAndroidKeystoreExportAdminKey().catch(() => ""),
        getLegacyEdgeAdminKey().catch(() => ""),
      ]);

      const [raw, url, anon, eas] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_RAW).catch(() => ""),
        AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL).catch(() => ""),
        getSupabaseAnonKey().catch(() => ""),
        AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID).catch(() => ""),
      ]);

      // Load persistent connection lights
      const [ghOk, ghUserStored, ghScopesStored, sbOk, sbRefStored, exOk, exUserStored, easOkStored, easStateStored, easLastVerifiedStored, repoOkStored, repoSlug, repoBranch] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_USER).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_SCOPES).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_SUPABASE_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_SUPABASE_REF).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_EXPO_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_EXPO_USER).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_EAS_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_EAS_STATE).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_REPO_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_REPO_SLUG).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_REPO_BRANCH).catch(() => null),
      ]);

      if (!mounted) return;
      setGithubToken(gh || "");
      setExpoToken(ex || "");
      setWorkflowAdminKey(workflowKey || "");
      setAndroidKeystoreExportAdminKey(keystoreKey || "");
      setLegacyEdgeAdminKey(legacyEdgeKey || "");
      setSupabaseRaw(raw || "");
      setSupabaseUrl(url || "");
      setSupabaseAnonKey(anon || "");
      setEasProjectId(eas || "");

      // Restore persistent lights
      if (ghOk === "true") setGithubOk(true);
      if (ghUserStored) setGithubUser(ghUserStored);
      if (ghScopesStored) setGithubScopes(ghScopesStored);
      if (sbOk === "true") setSupabaseOk(true);
      if (sbRefStored) setSupabaseRef(sbRefStored);
      if (exOk === "true") setExpoOk(true);
      if (exUserStored) setExpoUser(exUserStored);
      if (easOkStored === "true") setEasOk(true);
      const restoredEasState = resolvePersistedEasState({
        state: easStateStored,
        easProjectId: eas || "",
        lastVerifiedAt: easLastVerifiedStored,
      });
      if (restoredEasState) setEasState(restoredEasState);
      if (easLastVerifiedStored) setEasLastVerifiedAt(easLastVerifiedStored);
      if (repoOkStored === "true") setRepoOk(true);
      const repoLineStored = buildRepoOkLine(repoSlug, repoBranch);
      if (repoSlug) setRepoOkLine(repoLineStored);

      // Hydration finished (prevents initial token empty state from clearing saved OK lights).
      setHydrated(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

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
      legacyEdgeAdminKey,
      supabaseUrl,
      supabaseAnonKey,
      easProjectId,
    });
    if (!v.ok) {
      Alert.alert(v.title, v.message);
      return;
    }

    try {
      await withBusyGuard(async () => {
      const gh = githubToken.trim();
      const ex = expoToken.trim();
      const workflowAdmin = workflowAdminKey.trim();
      const keystoreAdmin = androidKeystoreExportAdminKey.trim();
      const legacyEdge = legacyEdgeAdminKey.trim();
      const raw = supabaseRaw.trim();
      const sbUrl = supabaseUrl.trim();
      const sbAnon = supabaseAnonKey.trim();
      const easId = easProjectId.trim();

      if (gh) await saveGitHubToken(gh);
      else {
        await deleteGitHubToken();
        setGithubOk(false);
        setGithubUser("");
        setGithubScopes("");
        setRepoOk(false);
        setRepoOkLine("");
        setEasOk(false);
        setEasState("missing");
        setEasLastVerifiedAt(null);
        await persistConnLights([
          [STORAGE_KEYS.CONN_GITHUB_OK, "false"],
          [STORAGE_KEYS.CONN_REPO_OK, "false"],
          [STORAGE_KEYS.CONN_EAS_OK, "false"],
          [STORAGE_KEYS.CONN_EAS_STATE, "missing"],
        ]);
        await removeConnLights([
          STORAGE_KEYS.CONN_GITHUB_USER,
          STORAGE_KEYS.CONN_GITHUB_SCOPES,
          STORAGE_KEYS.CONN_REPO_SLUG,
          STORAGE_KEYS.CONN_REPO_BRANCH,
          STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT,
        ]);
      }

      if (ex) {
        await saveExpoToken(ex);
      } else {
        await deleteExpoToken();
        setExpoOk(false);
        setExpoUser("");
        await persistConnLights([[STORAGE_KEYS.CONN_EXPO_OK, "false"]]);
        await removeConnLights([STORAGE_KEYS.CONN_EXPO_USER]);
      }

      if (workflowAdmin) await saveWorkflowAdminKey(workflowAdmin);
      else await deleteWorkflowAdminKey();

      if (keystoreAdmin) await saveAndroidKeystoreExportAdminKey(keystoreAdmin);
      else await deleteAndroidKeystoreExportAdminKey();

      if (legacyEdge) await saveLegacyEdgeAdminKey(legacyEdge);
      else await deleteLegacyEdgeAdminKey();

      await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_RAW, raw);
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
        setEasOk(false);
        setEasState("missing");
        setEasLastVerifiedAt(null);
        await persistConnLights([
          [STORAGE_KEYS.CONN_EAS_OK, "false"],
          [STORAGE_KEYS.CONN_EAS_STATE, "missing"],
        ]);
        await removeConnLights([STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT]);
      }

      if (!sbUrl || !sbAnon) {
        setSupabaseOk(false);
        setSupabaseRef("");
        await persistConnLights([[STORAGE_KEYS.CONN_SUPABASE_OK, "false"]]);
        await removeConnLights([STORAGE_KEYS.CONN_SUPABASE_REF]);
      }

      Alert.alert("✅ Gespeichert", "Tokens & Verbindungen wurden gespeichert.");
      });
    } catch (e: unknown) {
      if (isBusyGuardActiveError(e)) {
        Alert.alert("Bitte warten", e.message);
      } else {
        Alert.alert("❌ Speichern fehlgeschlagen", safeAlertText(e));
      }
    }
  }, [
    hydrated,
    githubToken,
    expoToken,
    workflowAdminKey,
    androidKeystoreExportAdminKey,
    legacyEdgeAdminKey,
    supabaseRaw,
    supabaseUrl,
    supabaseAnonKey,
    easProjectId,
    withBusyGuard,
    persistConnLights,
    removeConnLights,
  ]);

  const testGitHub = useCallback(async () => {
    if (!hydrated) return;
    const gh = githubToken.trim();
    if (!gh) return Alert.alert("Fehlt", "GitHub Token fehlt.");

    try {
      await withBusyGuard(async () => {
      debugLog("connections:github", "GET /user", {
        url: githubApiUrl("/user"),
      });
      const resp = await fetchWithTimeout(githubApiUrl("/user"), {
        timeoutMs: 12_000,
        timeoutMessage: "GitHub-Test hat das Zeitlimit erreicht. Bitte erneut versuchen.",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${gh}`,
        },
      });
      debugLog("connections:github", "Response", {
        status: resp.status,
        ok: resp.ok,
        scopes: resp.headers.get("x-oauth-scopes") || resp.headers.get("X-OAuth-Scopes") || "",
      });
      if (!resp.ok) throw new Error(`GitHub Test failed (${resp.status})`);
      const userData = await resp.json().catch(() => ({}));
      const login = userData?.login || "";
      const scopesHeader = resp.headers.get("x-oauth-scopes") || resp.headers.get("X-OAuth-Scopes") || "";
      const scopes = String(scopesHeader || "").trim();
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
      });
    } catch (e: unknown) {
      if (isBusyGuardActiveError(e)) {
        Alert.alert("Bitte warten", e.message);
        return;
      }

      setGithubOk(false);
      setGithubUser("");
      setGithubScopes("");
      await persistConnLights([[STORAGE_KEYS.CONN_GITHUB_OK, "false"]]);
      await removeConnLights([STORAGE_KEYS.CONN_GITHUB_USER, STORAGE_KEYS.CONN_GITHUB_SCOPES]);
      debugLog("connections:github", "GitHub ERROR", {
        error: redactSecrets(truncateWithMarker(safeAlertText(e), 800)),
      });
      Alert.alert("GitHub Test", safeAlertText(e));
    }
  }, [githubToken, hydrated, withBusyGuard, persistConnLights, removeConnLights]);

  const testExpo = useCallback(async () => {
    if (!hydrated) return;
    const ex = expoToken.trim();
    if (!ex) return Alert.alert("Fehlt", "Expo / EAS Token fehlt.");

    try {
      await withBusyGuard(async () => {
      const url = "https://api.expo.dev/graphql";
      debugLog("connections:expo", "POST /graphql", { url });
      const resp = await fetchWithTimeout(url, {
        timeoutMs: 12_000,
        timeoutMessage: "Expo-Test hat das Zeitlimit erreicht. Bitte erneut versuchen.",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ex}`,
        },
        body: JSON.stringify({
          query: "query Me { me { id username } }",
        }),
      });

      const raw = await resp.text();
      debugLog("connections:expo", "Response", {
        status: resp.status,
        ok: resp.ok,
        body: redactSecrets(truncateWithMarker(raw, 1000)),
      });

      if (!resp.ok) throw new Error(`Expo Test failed (${resp.status})`);
      const username = parseExpoGraphQLUsername(raw || "");

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
      });
    } catch (e: unknown) {
      if (isBusyGuardActiveError(e)) {
        Alert.alert("Bitte warten", e.message);
        return;
      }

      setExpoOk(false);
      setExpoUser("");
      await persistConnLights([[STORAGE_KEYS.CONN_EXPO_OK, "false"]]);
      await removeConnLights([STORAGE_KEYS.CONN_EXPO_USER]);
      debugLog("connections:expo", "Expo ERROR", {
        error: redactSecrets(truncateWithMarker(safeAlertText(e), 800)),
      });
      Alert.alert("Expo Test", safeAlertText(e));
    }
  }, [expoToken, hydrated, withBusyGuard, persistConnLights, removeConnLights]);

  const testSupabase = useCallback(async () => {
    if (!hydrated) return;
    const url = supabaseUrl.trim();
    const anon = supabaseAnonKey.trim();
    if (!url) return Alert.alert("Fehlt", "Supabase URL fehlt.");
    if (!anon) return Alert.alert("Fehlt", "Supabase ANON Key fehlt.");

    try {
      await withBusyGuard(async () => {
      const resp = await fetchWithTimeout(`${url}/rest/v1/`, {
        timeoutMs: 12_000,
        timeoutMessage: "Supabase-REST-Ping hat das Zeitlimit erreicht. Bitte URL/Netzwerk prüfen.",
        method: "GET",
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      });
      if (!resp.ok) throw new Error(`REST Ping failed (${resp.status})`);

      const tableRes = await fetchWithTimeout(`${url}/rest/v1/build_jobs?select=id&limit=1`, {
        timeoutMs: 12_000,
        timeoutMessage: "Supabase build_jobs-Prüfung hat das Zeitlimit erreicht. Bitte erneut versuchen.",
        method: "GET",
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      });

      if (!tableRes.ok) {
        if (tableRes.status === 401 || tableRes.status === 403) {
          setSupabaseOk(true);
          await persistConnLights([[STORAGE_KEYS.CONN_SUPABASE_OK, "true"]]);
          Alert.alert(
            "Supabase OK",
            "REST erreichbar. build_jobs ist durch RLS geschützt (401/403) – das ist okay. CI/Edge nutzt den Service-Role-Key serverseitig.",
          );
          return;
        }
        throw new Error(`build_jobs Check fehlgeschlagen (${tableRes.status}).`);
      }

      Alert.alert("Supabase OK", "REST + build_jobs erreichbar.");
      setSupabaseOk(true);
      const writes: Array<[string, string]> = [[STORAGE_KEYS.CONN_SUPABASE_OK, "true"]];
      const ref = deriveSupabaseRefFromUrl(url);
      if (ref) {
        setSupabaseRef(ref);
        writes.push([STORAGE_KEYS.CONN_SUPABASE_REF, ref]);
      }
      await persistConnLights(writes);
      });
    } catch (e: unknown) {
      if (isBusyGuardActiveError(e)) {
        Alert.alert("Bitte warten", e.message);
        return;
      }

      setSupabaseOk(false);
      await persistConnLights([[STORAGE_KEYS.CONN_SUPABASE_OK, "false"]]);
      Alert.alert("Supabase Test", safeAlertText(e));
    }
  }, [supabaseUrl, supabaseAnonKey, hydrated, withBusyGuard, persistConnLights]);

  // Status flags
  const status = useMemo(() => {
    return resolveConnectionsStatusFlags({
      githubToken,
      expoToken,
      workflowAdminKey,
      androidKeystoreExportAdminKey,
      legacyEdgeAdminKey,
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
    legacyEdgeAdminKey,
    supabaseUrl,
    supabaseAnonKey,
    projectData?.linkedRepo,
    activeRepo,
    easProjectId,
  ]);

  const githubConnected = !!githubToken.trim();

  const onLinkExisting = useCallback(async () => {
    if (!hydrated || busyRef.current) return;
    if (isEasInitRunning) return;

    const token = githubToken.trim();
    const repoSlug = (effectiveRepo || "").trim();
    const branch = (effectiveBranch || "").trim();
    const linkPrecheck = resolveLinkExistingSelectionPrecheck({ githubToken: token, repoSlug, branch });
    if (!linkPrecheck.ok) {
      Alert.alert(linkPrecheck.alertTitle || "Fehler", linkPrecheck.alertMessage || "Ungültige Auswahl.");
      return;
    }

    const parsed = parseOwnerRepo(repoSlug);
    if (!parsed) {
      const notice = resolveConnectionsAlertNotice("invalid_repo_format");
      Alert.alert(notice.title, notice.message);
      return;
    }

    const easId = easProjectId.trim();
    const easValidation = validateEasProjectId(easId);
    if (!easValidation.ok) {
      Alert.alert(easValidation.title, easValidation.message);
      return;
    }

    const runLink = async (projectId: string) => {
      setIsEasInitRunning(true);
      try {
        // Persist token + (optional) EAS id so andere Teile der App die gleichen Werte nutzen
        await saveGitHubToken(token);
        if (projectId) {
          await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, projectId).catch(() => null);
        } else {
          // We are creating a new EAS Project ID in the workflow.
          // The generated id will be committed to eas-project.json in the repo.
          await AsyncStorage.removeItem(STORAGE_KEYS.EAS_PROJECT_ID).catch(() => null);
        }

        await autoFixCIWorkflows({ owner: parsed.owner, repo: parsed.repo, branch });

        await triggerWorkflow(parsed.owner, parsed.repo, "eas-link.yml", branch, {
          ref: branch,
          eas_project_id: projectId,
        });

        Alert.alert("OK", resolveEasLinkWorkflowStartMessage(projectId));

        // Workflow wurde nur gestartet; EAS-Verification bleibt bis zum echten Test neutral/false.
        setEasOk(false);
        setEasState(projectId ? "stale" : "missing");
        setEasLastVerifiedAt(null);
        await persistConnLights([
          [STORAGE_KEYS.CONN_EAS_OK, "false"],
          [STORAGE_KEYS.CONN_EAS_STATE, projectId ? "stale" : "missing"],
        ]);
        await removeConnLights([STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT]);

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
  ]);

  const onCreateAndLink = useCallback(async () => {
    if (!hydrated || busyRef.current) return;
    if (isEasInitRunning) return;

    const token = githubToken.trim();
    if (!token) {
      const notice = resolveConnectionsAlertNotice("missing_github_token");
      Alert.alert(notice.title, notice.message);
      return;
    }

    const repoSlug = (effectiveRepo || "").trim();
    if (!repoSlug) {
      const notice = resolveConnectionsAlertNotice("missing_repo_selection");
      Alert.alert(notice.title, notice.message);
      return;
    }

    const branch = (effectiveBranch || "").trim();
    if (!branch) {
      // Invariant contract: "Kein Branch ausgewählt. Bitte zuerst in GitHub Repos einen Branch verknüpfen."
      const notice = resolveConnectionsAlertNotice("missing_branch_selection");
      Alert.alert(notice.title, notice.message);
      return;
    }

    const parsed = parseOwnerRepo(repoSlug);
    if (!parsed) {
      const notice = resolveConnectionsAlertNotice("invalid_repo_format");
      Alert.alert(notice.title, notice.message);
      return;
    }

    setIsEasInitRunning(true);
    try {
      await saveGitHubToken(token);

      await autoFixCIWorkflows({ owner: parsed.owner, repo: parsed.repo, branch });

      // eas_project_id leer => Workflow macht 'eas init' und erzeugt eine neue Project ID
      await triggerWorkflow(parsed.owner, parsed.repo, "eas-link.yml", branch, {
        ref: branch,
      });

      const notice = resolveConnectionsAlertNotice("create_link_workflow_started");
      Alert.alert(notice.title, notice.message);
    } catch (e: unknown) {
      Alert.alert("Fehler", safeAlertText(e));
    } finally {
      setIsEasInitRunning(false);
    }
  }, [hydrated, isEasInitRunning, githubToken, effectiveRepo, effectiveBranch]);


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
    legacyEdgeAdminKey,
    setLegacyEdgeAdminKey,
    showGitHub,
    setShowGitHub,
    showExpo,
    setShowExpo,
    showWorkflowAdmin,
    setShowWorkflowAdmin,
    showKeystoreAdmin,
    setShowKeystoreAdmin,
    showLegacyEdge,
    setShowLegacyEdge,

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
