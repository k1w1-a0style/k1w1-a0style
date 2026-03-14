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
  getEdgeAdminKey,
  saveEdgeAdminKey,
  deleteEdgeAdminKey,
  triggerWorkflow,
} from "../../../infra/github/githubService";

import {
  deriveSupabaseUrl,
  safeAlertText,
  validateBeforeSave,
} from "../utils/validation";

import { debugLog } from "../../../lib/debugOverlay";
import { redactSecrets, truncateWithMarker } from "../../../lib/secretRedaction";
import { parseExpoGraphQLUsername } from "../utils/expoGraphql";

type ExpoProjectResponse = {
  data?: {
    id?: string;
    slug?: string;
    name?: string;
    project?: {
      id?: string;
      slug?: string;
    };
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
  const [supabaseRef, setSupabaseRef] = useState("" );
  const [expoOk, setExpoOk] = useState(false);
  const [expoUser, setExpoUser] = useState("" );
  const [easOk, setEasOk] = useState(false);
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

  const saveConnEasOk = useCallback(async (ok: boolean, opts?: { verifiedAt?: string | null }) => {
    const verifiedAt = opts?.verifiedAt ?? null;
    setEasOk(ok);
    setEasLastVerifiedAt(verifiedAt);
    await AsyncStorage.setItem(
      STORAGE_KEYS.CONN_EAS_OK,
      ok ? "true" : "false",
    ).catch(() => {});
    if (verifiedAt) {
      await AsyncStorage.setItem(STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT, verifiedAt).catch(() => {});
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT).catch(() => {});
    }
  }, []);

  const testEas = useCallback(async () => {
    // No EAS Project ID -> nothing to test.
    if (!easProjectId?.trim()) {
      await saveConnEasOk(false);
      return;
    }

    // EAS project validation requires an authenticated Expo request.
    // exp.host expects @owner/slug and will return 400 for UUID project IDs.
    if (!expoToken?.trim()) {
      await saveConnEasOk(false);
      Alert.alert("EAS Test", "Expo Token fehlt (für EAS Test erforderlich)");
      return;
    }

    setIsTestingEas(true);
    try {
      const id = easProjectId.trim();
      const resp = await fetch(
        `https://api.expo.dev/v2/projects/${encodeURIComponent(id)}`,
        {
          headers: {
            Authorization: `Bearer ${expoToken.trim()}`,
            Accept: "application/json",
          },
        },
      );

      if (!resp.ok) {
        await saveConnEasOk(false);
        Alert.alert("EAS Test", `EAS Test failed (${resp.status})`);
        return;
      }

      const json = (await resp.json().catch(() => null)) as ExpoProjectResponse | null;
      const hasProject = Boolean(
        json?.data?.id ||
          json?.data?.project?.id ||
          json?.data?.project?.slug ||
          json?.data?.slug ||
          json?.data?.name,
      );
      await saveConnEasOk(hasProject, { verifiedAt: hasProject ? new Date().toISOString() : null });
      if (!hasProject) {
        Alert.alert("EAS Test", "Projekt nicht gefunden oder keine Rechte");
      }
    } catch (e: unknown) {
      await saveConnEasOk(false);
      Alert.alert("EAS Test", `EAS Test failed (${safeAlertText(e)})`);
    } finally {
      setIsTestingEas(false);
    }
  }, [easProjectId, expoToken, saveConnEasOk]);

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

  const [edgeAdminKey, setEdgeAdminKeyState] = useState("");

  const [showGitHub, setShowGitHub] = useState(false);
  const [showExpo, setShowExpo] = useState(false);
  const [showEdge, setShowEdge] = useState(false);

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
      const [gh, ex, edge] = await Promise.all([
        getGitHubToken().catch(() => ""),
        getExpoToken().catch(() => ""),
        getEdgeAdminKey().catch(() => ""),
      ]);

      const [raw, url, anon, eas] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_RAW).catch(() => ""),
        AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL).catch(() => ""),
        AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_KEY).catch(() => ""),
        AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID).catch(() => ""),
      ]);

      // Load persistent connection lights
      const [ghOk, ghUserStored, ghScopesStored, sbOk, sbRefStored, exOk, exUserStored, easOkStored, easLastVerifiedStored, repoOkStored, repoSlug, repoBranch] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_USER).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_SCOPES).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_SUPABASE_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_SUPABASE_REF).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_EXPO_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_EXPO_USER).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_EAS_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_REPO_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_REPO_SLUG).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_REPO_BRANCH).catch(() => null),
      ]);

      await AsyncStorage.removeItem(STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY).catch(() => {});
      if (!mounted) return;
      setGithubToken(gh || "");
      setExpoToken(ex || "");
      setEdgeAdminKeyState(edge || "");
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
      if (easLastVerifiedStored) setEasLastVerifiedAt(easLastVerifiedStored);
      if (repoOkStored === "true") setRepoOk(true);
      const repoLineStored = [repoSlug || "", repoBranch || ""].filter(Boolean).join(" (") + (repoBranch ? ")" : "");
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
    const v = validateBeforeSave({
      githubToken,
      expoToken,
      edgeAdminKey,
      supabaseUrl,
      supabaseAnonKey,
    });
    if (!v.ok) {
      Alert.alert(v.title, v.message);
      return;
    }
    setBusy(true);
    try {
      const gh = githubToken.trim();
      const ex = expoToken.trim();
      const edge = edgeAdminKey.trim();

      if (gh) await saveGitHubToken(gh);
      else {
        await deleteGitHubToken();
        // If GitHub token is removed, clear dependent connection states
        setGithubOk(false);
        setGithubUser("");
        setGithubScopes("");
        await AsyncStorage.setItem(STORAGE_KEYS.CONN_GITHUB_OK, "false").catch(() => {});
        await AsyncStorage.removeItem(STORAGE_KEYS.CONN_GITHUB_USER).catch(() => {});
        await AsyncStorage.removeItem(STORAGE_KEYS.CONN_GITHUB_SCOPES).catch(() => {});

        setRepoOk(false);
        setRepoOkLine("");
        await AsyncStorage.setItem(STORAGE_KEYS.CONN_REPO_OK, "false").catch(() => {});
        await AsyncStorage.removeItem(STORAGE_KEYS.CONN_REPO_SLUG).catch(() => {});
        await AsyncStorage.removeItem(STORAGE_KEYS.CONN_REPO_BRANCH).catch(() => {});

        setEasOk(false);
        setEasLastVerifiedAt(null);
        await AsyncStorage.setItem(STORAGE_KEYS.CONN_EAS_OK, "false").catch(() => {});
        await AsyncStorage.removeItem(STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT).catch(() => {});
      }

      if (ex) await saveExpoToken(ex);
      else {
        await deleteExpoToken();
        setExpoOk(false);
        setExpoUser("");
        await AsyncStorage.setItem(STORAGE_KEYS.CONN_EXPO_OK, "false").catch(() => {});
        await AsyncStorage.removeItem(STORAGE_KEYS.CONN_EXPO_USER).catch(() => {});
      }

      if (edge) await saveEdgeAdminKey(edge);
      else await deleteEdgeAdminKey();

      await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_RAW, supabaseRaw.trim());
      await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, supabaseUrl.trim());
      await AsyncStorage.setItem(
        STORAGE_KEYS.SUPABASE_KEY,
        supabaseAnonKey.trim(),
      );
      await AsyncStorage.removeItem(STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY).catch(() => {});
      if (easProjectId.trim()) {
        await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, easProjectId.trim());
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.EAS_PROJECT_ID);
        setEasOk(false);
        setEasLastVerifiedAt(null);
        await AsyncStorage.setItem(STORAGE_KEYS.CONN_EAS_OK, "false").catch(() => {});
        await AsyncStorage.removeItem(STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT).catch(() => {});
      }

      // If Supabase base settings are cleared, reset connection status
      if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
        setSupabaseOk(false);
        setSupabaseRef("");
        await AsyncStorage.setItem(STORAGE_KEYS.CONN_SUPABASE_OK, "false").catch(() => {});
        await AsyncStorage.removeItem(STORAGE_KEYS.CONN_SUPABASE_REF).catch(() => {});
      }

      Alert.alert("✅ Gespeichert", "Tokens & Verbindungen wurden gespeichert.");
    } catch (e: unknown) {
      Alert.alert("❌ Speichern fehlgeschlagen", safeAlertText(e));
    } finally {
      setBusy(false);
    }
  }, [
    githubToken,
    expoToken,
    edgeAdminKey,
    supabaseRaw,
    supabaseUrl,
    supabaseAnonKey,
    easProjectId,
  ]);

  const testGitHub = useCallback(async () => {
    const gh = githubToken.trim();
    if (!gh) return Alert.alert("Fehlt", "GitHub Token fehlt.");
    setBusy(true);
    try {
      debugLog("connections:github", "GET /user", {
        url: githubApiUrl("/user"),
      });
      const resp = await fetch(githubApiUrl("/user"), {
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
      // Persist connection status
      setGithubOk(true);
      setGithubUser(login);
      await AsyncStorage.setItem(STORAGE_KEYS.CONN_GITHUB_OK, "true").catch(() => {});
      await AsyncStorage.setItem(STORAGE_KEYS.CONN_GITHUB_USER, login).catch(() => {});
      setGithubScopes(scopes);
      if (scopes) {
        await AsyncStorage.setItem(STORAGE_KEYS.CONN_GITHUB_SCOPES, scopes).catch(() => {});
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.CONN_GITHUB_SCOPES).catch(() => {});
      }
      Alert.alert("GitHub OK", `Verbunden als: ${login || "OK"}${scopes ? `\nScopes: ${scopes}` : ""}`);
    } catch (e: unknown) {
      setGithubOk(false);
      setGithubUser("");
      setGithubScopes("");
      await AsyncStorage.setItem(STORAGE_KEYS.CONN_GITHUB_OK, "false").catch(() => {});
      await AsyncStorage.removeItem(STORAGE_KEYS.CONN_GITHUB_USER).catch(() => {});
      await AsyncStorage.removeItem(STORAGE_KEYS.CONN_GITHUB_SCOPES).catch(() => {});
      debugLog("connections:github", "GitHub ERROR", {
        error: redactSecrets(truncateWithMarker(safeAlertText(e), 800)),
      });
      Alert.alert("GitHub Test", safeAlertText(e));
    } finally {
      setBusy(false);
    }
  }, [githubToken]);

  const testExpo = useCallback(async () => {
    const ex = expoToken.trim();
    if (!ex) return Alert.alert("Fehlt", "Expo / EAS Token fehlt.");
    setBusy(true);
    try {
      // Legacy endpoint (exp.host/--/api/v2/auth/user) is often 404 nowadays.
      // Use Expo's GraphQL API and treat a 200 + data response as "token valid".
      const url = "https://api.expo.dev/graphql";
      debugLog("connections:expo", "POST /graphql", { url });
      const resp = await fetch(url, {
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

      // UX: Wenn der Token valide ist, persistieren wir ihn sofort.
      // Viele Nutzer drücken erst "Test" und erwarten danach einen grünen Status nach Neustart.
      try {
        await saveExpoToken(ex);
      } catch {
        // ignore (SecureStore kann in manchen Umgebungen scheitern)
      }

      setExpoOk(true);
      setExpoUser(username || "");
      await AsyncStorage.setItem(STORAGE_KEYS.CONN_EXPO_OK, "true").catch(() => {});
      if (username) {
        await AsyncStorage.setItem(STORAGE_KEYS.CONN_EXPO_USER, username).catch(() => {});
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.CONN_EXPO_USER).catch(() => {});
      }

      Alert.alert("Expo OK", username ? `Verbunden als: ${username}` : "Token ist gueltig.");
    } catch (e: unknown) {
      setExpoOk(false);
      setExpoUser("");
      await AsyncStorage.setItem(STORAGE_KEYS.CONN_EXPO_OK, "false").catch(() => {});
      await AsyncStorage.removeItem(STORAGE_KEYS.CONN_EXPO_USER).catch(() => {});
      debugLog("connections:expo", "Expo ERROR", {
        error: redactSecrets(truncateWithMarker(safeAlertText(e), 800)),
      });
      Alert.alert("Expo Test", safeAlertText(e));
    } finally {
      setBusy(false);
    }
  }, [expoToken]);

  const testSupabase = useCallback(async () => {
    const url = supabaseUrl.trim();
    const anon = supabaseAnonKey.trim();
    if (!url) return Alert.alert("Fehlt", "Supabase URL fehlt.");
    if (!anon) return Alert.alert("Fehlt", "Supabase ANON Key fehlt.");

    setBusy(true);
    try {
      // Basic REST ping
      const resp = await fetch(`${url}/rest/v1/`, {
        method: "GET",
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      });
      if (!resp.ok) throw new Error(`REST Ping failed (${resp.status})`);

      // build_jobs table check (wichtig fürs Build-System)
      // In gehärteten Setups darf der ANON-Key durch RLS hier bewusst 401/403 liefern.
      const tableRes = await fetch(`${url}/rest/v1/build_jobs?select=id&limit=1`, {
        method: "GET",
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      });

      if (!tableRes.ok) {
        if (tableRes.status === 401 || tableRes.status === 403) {
          setSupabaseOk(true);
          await AsyncStorage.setItem(STORAGE_KEYS.CONN_SUPABASE_OK, "true").catch(() => {});
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
      await AsyncStorage.setItem(STORAGE_KEYS.CONN_SUPABASE_OK, "true").catch(() => {});
      // Store project ref (subdomain) for UX display
      try {
        const host = url.replace(/^https?:\/\//, "").split("/")[0] || "";
        const ref = host.endsWith(".supabase.co") ? host.split(".")[0] : "";
        if (ref) {
          setSupabaseRef(ref);
          await AsyncStorage.setItem(STORAGE_KEYS.CONN_SUPABASE_REF, ref).catch(() => {});
        }
      } catch {}
    } catch (e: unknown) {
      setSupabaseOk(false);
      await AsyncStorage.setItem(STORAGE_KEYS.CONN_SUPABASE_OK, "false").catch(() => {});
      Alert.alert("Supabase Test", safeAlertText(e));
    } finally {
      setBusy(false);
    }
  }, [supabaseUrl, supabaseAnonKey]);

  // Status flags
  const status = useMemo(() => {
    const gh = !!githubToken.trim();
    const ex = !!expoToken.trim();
    const edge = !!edgeAdminKey.trim();
    const sbUrl = !!supabaseUrl.trim();
    const sbAnon = !!supabaseAnonKey.trim();
    const linked = !!(projectData?.linkedRepo || activeRepo);
    const easId = easProjectId.trim();
    const eas = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(easId);
    return { gh, ex, edge, sbUrl, sbAnon, linked, eas };
  }, [
    githubToken,
    expoToken,
    edgeAdminKey,
    supabaseUrl,
    supabaseAnonKey,
    projectData?.linkedRepo,
    activeRepo,
    easProjectId,
  ]);

  const githubConnected = !!githubToken.trim();

  const onLinkExisting = useCallback(async () => {
    if (isEasInitRunning) return;

    const token = githubToken.trim();
    if (!token) {
      Alert.alert("Fehler", "GitHub Token fehlt (oder ist leer).");
      return;
    }

    const repoSlug = (effectiveRepo || "").trim();
    if (!repoSlug) {
      Alert.alert("Fehler", "Kein Repo ausgewählt.");
      return;
    }

    const branch = (effectiveBranch || "").trim();
    if (!branch) {
      Alert.alert(
        "Fehler",
        "Kein Branch ausgewählt. Bitte zuerst in GitHub Repos einen Branch verknüpfen.",
      );
      return;
    }

    const parsed = parseOwnerRepo(repoSlug);
    if (!parsed) {
      Alert.alert("Fehler", "Repo-Format ist ungültig. Erwartet: owner/repo");
      return;
    }

    const easId = easProjectId.trim();

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

        Alert.alert(
          "OK",
          projectId
            ? "EAS Link-Workflow gestartet. Check GitHub Actions (eas-link)."
            : "Keine EAS ID vorhanden. Init+Link Workflow gestartet (erstellt eine neue Project ID).\n\nNach Abschluss: Sync drücken, damit die App die neue ID aus dem Repo übernimmt.",
        );

        // Persist UX lights (best-effort): token saved above
        setEasOk(true);
        setEasLastVerifiedAt(null);
        await AsyncStorage.setItem(STORAGE_KEYS.CONN_EAS_OK, "true").catch(() => {});
        await AsyncStorage.removeItem(STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT).catch(() => {});

        if (repoSlug) {
          setRepoOk(true);
          setRepoOkLine(`${repoSlug}${branch ? ` (${branch})` : ""}`);
          await AsyncStorage.setItem(STORAGE_KEYS.CONN_REPO_OK, "true").catch(() => {});
          await AsyncStorage.setItem(STORAGE_KEYS.CONN_REPO_SLUG, repoSlug).catch(() => {});
          await AsyncStorage.setItem(STORAGE_KEYS.CONN_REPO_BRANCH, branch).catch(() => {});
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
    isEasInitRunning,
    githubToken,
    effectiveRepo,
    effectiveBranch,
    easProjectId,
  ]);

  const onCreateAndLink = useCallback(async () => {
    if (isEasInitRunning) return;

    const token = githubToken.trim();
    if (!token) {
      Alert.alert("Fehler", "GitHub Token fehlt (oder ist leer).");
      return;
    }

    const repoSlug = (effectiveRepo || "").trim();
    if (!repoSlug) {
      Alert.alert("Fehler", "Kein Repo ausgewählt.");
      return;
    }

    const branch = (effectiveBranch || "").trim();
    if (!branch) {
      Alert.alert(
        "Fehler",
        "Kein Branch ausgewählt. Bitte zuerst in GitHub Repos einen Branch verknüpfen.",
      );
      return;
    }

    const parsed = parseOwnerRepo(repoSlug);
    if (!parsed) {
      Alert.alert("Fehler", "Repo-Format ist ungültig. Erwartet: owner/repo");
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

      Alert.alert(
        "OK",
        "EAS Create+Link Workflow gestartet. Check GitHub Actions (eas-link) und danach Repo commit/push abwarten.",
      );
    } catch (e: unknown) {
      Alert.alert("Fehler", safeAlertText(e));
    } finally {
      setIsEasInitRunning(false);
    }
  }, [isEasInitRunning, githubToken, effectiveRepo, effectiveBranch]);


  return {
    navigation,
    busy,
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
    edgeAdminKey,
    setEdgeAdminKey: setEdgeAdminKeyState,
    showGitHub,
    setShowGitHub,
    showExpo,
    setShowExpo,
    showEdge,
    setShowEdge,

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
