import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";

import { STORAGE_KEYS } from "../../../lib/storageKeys";
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
} from "../../../contexts/githubService";

const deriveSupabaseUrl = (raw: string): { projectId: string; url: string } => {
  const trimmed = (raw || "").trim();

  const matchUrl = trimmed.match(/^https?:\/\/([^.]+)\.supabase\.co/i);
  if (matchUrl && matchUrl[1]) {
    const id = matchUrl[1];
    return { projectId: id, url: `https://${id}.supabase.co` };
  }

  const matchId = trimmed.match(/^[a-z0-9]{6,}$/i);
  if (matchId) {
    const id = trimmed;
    return { projectId: id, url: `https://${id}.supabase.co` };
  }

  return { projectId: "", url: "" };
};

export function useConnectionsScreen() {
  const navigation = useNavigation<any>();
  const { activeRepo, activeBranch } = useGitHub();
  const { projectData } = useProject();

  const [busy, setBusy] = useState(false);

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
      Alert.alert("❌ Speichern fehlgeschlagen", e?.message || "Unbekannter Fehler");
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
      const j = await resp.json().catch(() => ({}));
      Alert.alert("✅ GitHub OK", `User: ${j?.login || "ok"}`);
    } catch (e: any) {
      Alert.alert("❌ GitHub Test", e?.message || "Fehler");
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
      const tableRes = await fetch(`${url}/rest/v1/build_jobs?select=id&limit=1`, {
        method: "GET",
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      });
      if (!tableRes.ok) {
        throw new Error(`Tabelle build_jobs fehlt (${tableRes.status}).`);
      }

      Alert.alert("✅ Supabase OK", "REST + build_jobs erreichbar.");
    } catch (e: any) {
      Alert.alert("❌ Supabase Test", e?.message || "Fehler");
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

  return {
    navigation,
    busy,

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
