import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";

import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { autoFixCIWorkflows, parseOwnerRepo } from "../../../lib/diagnostics/ciAutoFix";
import { useGitHub } from "../../../contexts/GitHubContext";
import { useProject } from "../../../contexts/ProjectContext";
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
  getSupabaseServiceRoleKey,
  saveSupabaseServiceRoleKey,
  deleteSupabaseServiceRoleKey,
  triggerWorkflow,
} from "../../../infra/github/githubService";

import {
  deriveSupabaseUrl,
  safeAlertText,
  validateBeforeSave,
} from "../utils/validation";

export function useConnectionsScreen() {
  const navigation = useNavigation<any>();
  const { activeRepo, activeBranch } = useGitHub();
  const { projectData } = useProject();

  const [busy, setBusy] = useState(false);
  const [isEasInitRunning, setIsEasInitRunning] = useState(false);

  // Persistent connection lights
  const [githubOk, setGithubOk] = useState(false);
  const [githubUser, setGithubUser] = useState("");
  const [supabaseOk, setSupabaseOk] = useState(false);
  const [expoOk, setExpoOk] = useState(false);

  // Tokens
  const [githubToken, setGithubToken] = useState("");
  const [expoToken, setExpoToken] = useState("");
  const [edgeAdminKey, setEdgeAdminKeyState] = useState("");

  const [showGitHub, setShowGitHub] = useState(false);
  const [showExpo, setShowExpo] = useState(false);
  const [showEdge, setShowEdge] = useState(false);

  // Supabase
  const [supabaseRaw, setSupabaseRaw] = useState("");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [supabaseServiceRoleKey, setSupabaseServiceRoleKey] = useState("");

  const [showSupabaseAnon, setShowSupabaseAnon] = useState(false);
  const [showSupabaseServiceRole, setShowSupabaseServiceRole] = useState(false);

  // EAS
  const [easProjectId, setEasProjectId] = useState("");

  const repoLine = useMemo(() => {
    const repo = activeRepo || projectData?.linkedRepo || "";
    const br = activeBranch || projectData?.linkedBranch || "";
    if (!repo) return "";
    return `${repo}${br ? ` (${br})` : ""}`;
  }, [
    activeRepo,
    activeBranch,
    projectData?.linkedRepo,
    projectData?.linkedBranch,
  ]);

  const effectiveRepo = useMemo(() => {
    const repo = (activeRepo || projectData?.linkedRepo || "").trim();
    return repo ? repo : null;
  }, [activeRepo, projectData?.linkedRepo]);


  // Load stored settings on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [gh, ex, edge] = await Promise.all([
        getGitHubToken().catch(() => ""),
        getExpoToken().catch(() => ""),
        getEdgeAdminKey().catch(() => ""),
      ]);

      const srvSecure =
        (await getSupabaseServiceRoleKey().catch(() => null)) || "";

      const [raw, url, anon, eas] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_RAW).catch(() => ""),
        AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL).catch(() => ""),
        AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_KEY).catch(() => ""),
        AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID).catch(() => ""),
      ]);

      // Load persistent connection lights
      const [ghOk, ghUserStored, sbOk, exOk] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_GITHUB_USER).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_SUPABASE_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CONN_EXPO_OK).catch(() => null),
      ]);

      // Legacy migration: AsyncStorage -> SecureStore
      let srv = srvSecure;
      if (!srv) {
        const legacy = await AsyncStorage.getItem(
          STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY_LEGACY,
        ).catch(() => "");
        if (legacy) {
          await saveSupabaseServiceRoleKey(legacy);
          await AsyncStorage.removeItem(
            STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY_LEGACY,
          ).catch(() => {});
          srv = legacy;
        }
      }
      if (!mounted) return;
      setGithubToken(gh || "");
      setExpoToken(ex || "");
      setEdgeAdminKeyState(edge || "");
      setSupabaseRaw(raw || "");
      setSupabaseUrl(url || "");
      setSupabaseAnonKey(anon || "");
      setSupabaseServiceRoleKey(srv || "");
      setEasProjectId(eas || "");

      // Restore persistent lights
      if (ghOk === "true") setGithubOk(true);
      if (ghUserStored) setGithubUser(ghUserStored);
      if (sbOk === "true") setSupabaseOk(true);
      if (exOk === "true") setExpoOk(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

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
      supabaseServiceRoleKey,
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
      else await deleteGitHubToken();

      if (ex) await saveExpoToken(ex);
      else await deleteExpoToken();

      if (edge) await saveEdgeAdminKey(edge);
      else await deleteEdgeAdminKey();

      await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_RAW, supabaseRaw.trim());
      await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, supabaseUrl.trim());
      await AsyncStorage.setItem(
        STORAGE_KEYS.SUPABASE_KEY,
        supabaseAnonKey.trim(),
      );
      const srv = supabaseServiceRoleKey.trim();
      if (srv) await saveSupabaseServiceRoleKey(srv);
      else await deleteSupabaseServiceRoleKey();
      // Remove legacy value if it exists
      await AsyncStorage.removeItem(
        STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY_LEGACY,
      ).catch(() => {});
      await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, easProjectId.trim());

      Alert.alert("✅ Gespeichert", "Tokens & Verbindungen wurden gespeichert.");
    } catch (e: any) {
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
    supabaseServiceRoleKey,
    easProjectId,
  ]);

  const testGitHub = useCallback(async () => {
    const gh = githubToken.trim();
    if (!gh) return Alert.alert("Fehlt", "GitHub Token fehlt.");
    setBusy(true);
    try {
      const resp = await fetch("https://api.github.com/user", {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${gh}`,
        },
      });
      if (!resp.ok) throw new Error(`GitHub Test failed (${resp.status})`);
      await resp.json().catch(() => ({}));
      Alert.alert("✅ GitHub OK", "Token ist gültig und hat User-Zugriff.");
    } catch (e: any) {
      Alert.alert("❌ GitHub Test", safeAlertText(e));
    } finally {
      setBusy(false);
    }
  }, [githubToken]);

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
// Hinweis: In gehärteten Setups blockt RLS den anon-Key (401/403). Das ist OK,
// solange CI/Edge mit Service-Role arbeitet. Wenn ein Service-Role-Key vorhanden ist,
// nutzen wir ihn für den Check.
      const checkKey = (supabaseServiceRoleKey || "").trim() || anon;

      const tableRes = await fetch(`${url}/rest/v1/build_jobs?select=id&limit=1`, {
        method: "GET",
        headers: { apikey: checkKey, Authorization: `Bearer ${checkKey}` },
      });

      if (!tableRes.ok) {
        if ((tableRes.status === 401 || tableRes.status === 403) && checkKey === anon) {
          Alert.alert(
            "✅ Supabase OK",
            "REST erreichbar. build_jobs ist durch RLS geschützt (401/403) – das ist ok. CI/Edge nutzt Service-Role.",
          );
          return;
        }
        throw new Error(`build_jobs Check fehlgeschlagen (${tableRes.status}).`);
      }

      Alert.alert(
        "✅ Supabase OK",
        checkKey === anon
          ? "REST + build_jobs erreichbar."
          : "REST + build_jobs (Service-Role) erreichbar.",
      );
    } catch (e: any) {
      Alert.alert("❌ Supabase Test", safeAlertText(e));
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
    const sbSrv = !!supabaseServiceRoleKey.trim();
    const linked = !!(projectData?.linkedRepo || activeRepo);
    const eas = !!easProjectId.trim();
    return { gh, ex, edge, sbUrl, sbAnon, sbSrv, linked, eas };
  }, [
    githubToken,
    expoToken,
    edgeAdminKey,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
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

    const branch =
      (activeBranch || projectData?.linkedBranch || "main").trim() || "main";

    const parsed = parseOwnerRepo(repoSlug);
    if (!parsed) {
      Alert.alert("Fehler", "Repo-Format ist ungültig. Erwartet: owner/repo");
      return;
    }

    const easId = easProjectId.trim();
    if (!easId) {
      Alert.alert("Fehler", "Bitte zuerst eine EAS Project ID eingeben.");
      return;
    }

    setIsEasInitRunning(true);
    try {
      // Persist token + EAS id so andere Teile der App die gleichen Werte nutzen
      await saveGitHubToken(token);
      await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, easId).catch(
        () => null,
      );

      await autoFixCIWorkflows({ owner: parsed.owner, repo: parsed.repo, branch });

      await triggerWorkflow(parsed.owner, parsed.repo, "eas-link.yml", branch, {
        ref: branch,
        eas_project_id: easId,
      });

      Alert.alert(
        "OK",
        "EAS Link-Workflow gestartet. Check GitHub Actions (eas-link).",
      );
    } catch (e: any) {
      Alert.alert("Fehler", safeAlertText(e));
    } finally {
      setIsEasInitRunning(false);
    }
  }, [
    isEasInitRunning,
    githubToken,
    effectiveRepo,
    activeBranch,
    projectData?.linkedBranch,
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

    const branch =
      (activeBranch || projectData?.linkedBranch || "main").trim() || "main";

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
    } catch (e: any) {
      Alert.alert("Fehler", safeAlertText(e));
    } finally {
      setIsEasInitRunning(false);
    }
  }, [isEasInitRunning, githubToken, effectiveRepo, activeBranch, projectData?.linkedBranch]);


  return {
    navigation,
    busy,
    githubConnected,
    isEasInitRunning,
    activeRepo: effectiveRepo,
    onLinkExisting,
    onCreateAndLink,

    // Repo/status
    status,
    repoLine,
    supabaseUrl,
    easProjectId,

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
    showSupabaseServiceRole,
    setShowSupabaseServiceRole,

    // Supabase
    supabaseRaw,
    setSupabaseRaw,
    setSupabaseUrl,
    supabaseAnonKey,
    setSupabaseAnonKey,
    supabaseServiceRoleKey,
    setSupabaseServiceRoleKey,

    // EAS
    setEasProjectId,

    // Actions
    saveAll,
    testGitHub,
    testSupabase,
  };
}
