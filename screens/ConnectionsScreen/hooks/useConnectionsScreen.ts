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

import { redactSecrets, truncateWithMarker } from "../../../lib/secretRedaction";

const MAX_ALERT_CHARS = 180;

const safeAlertText = (value: unknown, fallback = "Fehler"): string => {
  const raw = typeof value === "string" ? value : (value as any)?.message;
  const msg = String(raw || fallback);
  return truncateWithMarker(redactSecrets(msg), MAX_ALERT_CHARS, "…<gekürzt>");
};

const looksLikeJwt = (token: string): boolean => {
  // Minimal check only. We don't decode here to avoid atob / platform edge cases.
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
};

type ValidationResult = { ok: true } | { ok: false; title: string; message: string };

const validateBeforeSave = (p: {
  githubToken: string;
  expoToken: string;
  edgeAdminKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
}): ValidationResult => {
  const gh = p.githubToken.trim();
  if (gh) {
    const okPrefix =
      gh.startsWith("ghp_") || gh.startsWith("github_pat_") || gh.startsWith("gho_");
    const okLength = gh.length >= 30;
    if (!okPrefix || !okLength) {
      return {
        ok: false,
        title: "Ungültiger GitHub Token",
        message: 'GitHub PAT muss typischerweise mit "ghp_" oder "github_pat_" beginnen.',
      };
    }
  }

  const ex = p.expoToken.trim();
  if (ex) {
    // Expo tokens vary; we only prevent obvious junk (too short / whitespace).
    if (ex.length < 20 || /\s/.test(ex)) {
      return {
        ok: false,
        title: "Ungültiger Expo/EAS Token",
        message: "Token ist zu kurz oder enthält Leerzeichen.",
      };
    }
  }

  const edge = p.edgeAdminKey.trim();
  if (edge) {
    if (edge.length < 20 || /\s/.test(edge)) {
      return {
        ok: false,
        title: "Ungültiger Edge Admin Key",
        message: "Key ist zu kurz oder enthält Leerzeichen.",
      };
    }
  }

  const sbUrl = p.supabaseUrl.trim();
  if (sbUrl) {
    if (!/^https:\/\//i.test(sbUrl) || !/\.supabase\.co\b/i.test(sbUrl)) {
      return {
        ok: false,
        title: "Ungültige Supabase URL",
        message: "URL muss https://<project>.supabase.co sein.",
      };
    }
  }

  const anon = p.supabaseAnonKey.trim();
  if (anon && !looksLikeJwt(anon)) {
    return {
      ok: false,
      title: "Ungültiger Supabase ANON Key",
      message: "Key muss wie ein JWT aussehen (eyJ... . eyJ... . ...).",
    };
  }

  const srv = p.supabaseServiceRoleKey.trim();
  if (srv && !looksLikeJwt(srv)) {
    return {
      ok: false,
      title: "Ungültiger Supabase Service Role Key",
      message: "Key muss wie ein JWT aussehen (eyJ... . eyJ... . ...).",
    };
  }

  return { ok: true };
};

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

  const safeAlertMessage = useCallback((msg: unknown, max = 220) => {
    const raw = typeof msg === "string" ? msg : (msg as any)?.message || String(msg || "");
    return truncateWithMarker(redactSecrets(String(raw || "")), max, "…<truncated>");
  }, []);

  const validateBeforeSave = useCallback((): { ok: true } | { ok: false; title: string; message: string } => {
    const gh = githubToken.trim();
    const ex = expoToken.trim();
    const edge = edgeAdminKey.trim();
    const sbUrl = supabaseUrl.trim();
    const sbAnon = supabaseAnonKey.trim();
    const sbSrv = supabaseServiceRoleKey.trim();

    // GitHub PATs are typically ghp_ / github_pat_ / gho_ / ghu_ / ghs_ / ghr_
    if (gh && !/^(ghp_|github_pat_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_]{10,}$/i.test(gh) && gh.length < 30) {
      return {
        ok: false,
        title: "Ungültiger GitHub Token",
        message: "Der GitHub Token sieht nicht wie ein PAT aus (z.B. ghp_…, github_pat_…).",
      };
    }

    // Expo tokens are long and often start with expo_
    if (ex && !/^expo_[A-Za-z0-9_-]{10,}$/i.test(ex) && ex.length < 30) {
      return {
        ok: false,
        title: "Ungültiger Expo / EAS Token",
        message: "Der Expo Token sieht nicht korrekt aus (oft expo_… und deutlich länger).",
      };
    }

    // Edge admin key - just sanity check length to catch obvious mistakes
    if (edge && edge.length < 16) {
      return {
        ok: false,
        title: "Ungültiger Edge Admin Key",
        message: "Der Edge Admin Key ist sehr kurz – bitte prüfen.",
      };
    }

    if (sbUrl) {
      try {
        const u = new URL(sbUrl);
        if (u.protocol !== "https:" || !/\.supabase\.co$/i.test(u.hostname)) {
          return {
            ok: false,
            title: "Ungültige Supabase URL",
            message: "Supabase URL muss https://<project>.supabase.co sein.",
          };
        }
      } catch {
        return { ok: false, title: "Ungültige Supabase URL", message: "Supabase URL ist keine gültige URL." };
      }
    }

    const looksJwt = (v: string) => /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v);
    if (sbAnon && !looksJwt(sbAnon)) {
      return { ok: false, title: "Ungültiger Supabase ANON Key", message: "Der ANON Key sollte wie ein JWT aussehen (eyJ…eyJ….…)." };
    }
    if (sbSrv && !looksJwt(sbSrv)) {
      return { ok: false, title: "Ungültiger Service Role Key", message: "Der Service Role Key sollte wie ein JWT aussehen (eyJ…eyJ….…)." };
    }

    return { ok: true };
  }, [githubToken, expoToken, edgeAdminKey, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey]);

  const saveAll = useCallback(async () => {
    // validateBeforeSave can be either a memoized object OR a callback returning that object
    // (depending on earlier refactors). Normalize it to a plain result here.
    const vAny: any = validateBeforeSave;
    const v = typeof vAny === "function" ? vAny() : vAny;
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
      const tableRes = await fetch(`${url}/rest/v1/build_jobs?select=id&limit=1`, {
        method: "GET",
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      });
      if (!tableRes.ok) {
        throw new Error(`Tabelle build_jobs fehlt (${tableRes.status}).`);
      }

      Alert.alert("✅ Supabase OK", "REST + build_jobs erreichbar.");
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
