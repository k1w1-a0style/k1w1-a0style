import { useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";

import { useProject } from "../../../contexts/ProjectContext";
import { ensureSupabaseClient } from "../../../lib/supabase";
import { getEdgeAdminKey, saveEdgeAdminKey } from "../../../contexts/githubService";

import { useInlineToast } from "../../../components/diagnostics/useInlineToast";
import { theme } from "../../../theme";

import type { ApiModeId, ModeDef, StatusResult, UiModeId, WizardHttpDebug } from "../types";

const MODES: ModeDef[] = [
  { id: "dev", label: "Dev", hint: "Schnell testen (signed)" },
  { id: "preview", label: "Preview", hint: "Interne APK teilen (signed)" },
  { id: "production", label: "Production", hint: "Release/Store (signed)" },
];

function normalizeModeForApi(mode: UiModeId): ApiModeId {
  return mode === "dev" ? "development" : mode;
}

function normalizeModeForUi(mode?: string): UiModeId | undefined {
  if (!mode) return undefined;
  if (mode === "development") return "dev";
  if (mode === "preview" || mode === "production" || mode === "dev") return mode as UiModeId;
  return undefined;
}

function pickStorageBucket(record?: StatusResult["record"]) {
  return record?.storage?.bucket ?? record?.storage_bucket;
}

function pickStoragePath(record?: StatusResult["record"]) {
  return record?.storage?.path ?? record?.storage_path;
}

function pickUpdatedAt(record?: StatusResult["record"]) {
  return record?.updatedAt ?? record?.updated_at;
}

function paletteTextMuted() {
  return theme.palette.text.muted;
}

function paletteSuccess() {
  return theme.palette.success;
}

function paletteError() {
  return theme.palette.error;
}

async function invokeEdgeJson(
  supabaseUrl: string,
  fn: string,
  adminKey: string,
  payload: any,
): Promise<{ ok: true; data: any; debug: WizardHttpDebug } | { ok: false; error: string; debug: WizardHttpDebug }> {
  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${fn}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Defensive: trim to avoid accidental whitespace/newlines from copy/paste.
      "x-k1w1-admin-key": adminKey.trim(),
    },
    body: JSON.stringify(payload ?? {}),
  });

  const bodyText = await res.text();
  const debug: WizardHttpDebug = { url, status: res.status, statusText: res.statusText ?? "", bodyText };

  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status} ${res.statusText || ""}`.trim(), debug };
  }

  try {
    const data = bodyText ? JSON.parse(bodyText) : null;
    return { ok: true, data, debug };
  } catch {
    return { ok: true, data: bodyText, debug };
  }
}

export function useCredentialsWizardScreen() {
  const project = useProject();
  const toast = useInlineToast();

  // Repo/Branch niemals "fest pinnen" – immer aus dem aktuell verlinkten Projekt holen.
  const repoFullName = project?.projectData?.linkedRepo ?? "";
  const branch = project?.projectData?.linkedBranch ?? "";

  const [selectedMode, setSelectedMode] = useState<UiModeId>("production");

  const [supabaseUrl, setSupabaseUrl] = useState<string>("");
  const [adminKey, setAdminKey] = useState<string>("");
  const [adminKeyLoaded, setAdminKeyLoaded] = useState(false);

  const [busy, setBusy] = useState<string | null>(null);

  const [statusByMode, setStatusByMode] = useState<Record<UiModeId, StatusResult | null>>({
    dev: null,
    preview: null,
    production: null,
  });

  const [lastDebug, setLastDebug] = useState<WizardHttpDebug | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showError, setShowError] = useState(false);

  const runningRef = useRef(false);
  const runningAllRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const client = await ensureSupabaseClient();
        if (!mounted) return;
        // supabase-js client exposes supabaseUrl
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const url = (client as any)?.supabaseUrl as string | undefined;
        if (url) setSupabaseUrl(url);
      } catch (e: any) {
        if (!mounted) return;
        setLastError(e?.message ?? String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const k = await getEdgeAdminKey();
        if (!mounted) return;
        if (k) setAdminKey(k);
      } finally {
        if (mounted) setAdminKeyLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const canRun = useMemo(() => {
    return Boolean(supabaseUrl && adminKey && repoFullName);
  }, [supabaseUrl, adminKey, repoFullName]);

  const selectedStatus = statusByMode[selectedMode];

  const prettyDebug = useMemo(() => {
    if (!lastDebug) return "";
    try {
      return JSON.stringify(lastDebug, null, 2);
    } catch {
      return String(lastDebug);
    }
  }, [lastDebug]);

  const prettyError = useMemo(() => {
    if (!lastError) return "";
    return String(lastError);
  }, [lastError]);

  function metaForStatus(s: StatusResult | null, mode: UiModeId) {
    const isBusy = busy === `status:${mode}`;
    if (isBusy) return { icon: "time-outline" as const, text: "prüfe…", color: paletteTextMuted() };
    if (s?.exists) return { icon: "checkmark-circle-outline" as const, text: "Key vorhanden", color: paletteSuccess() };
    if (s && !s.exists) return { icon: "close-circle-outline" as const, text: "kein Key", color: paletteError() };
    return { icon: "help-circle-outline" as const, text: "unbekannt", color: paletteTextMuted() };
  }

  async function refreshStatusCore(mode: UiModeId, opts?: { setBusy?: boolean }) {
  const setBusyFlag = opts?.setBusy !== false;

  setLastError(null);
  setLastDebug(null);
  if (setBusyFlag) setBusy(`status:${mode}`);

  try {
    const apiMode = normalizeModeForApi(mode);
    const r = await invokeEdgeJson(supabaseUrl, "android-keystore-status", adminKey, {
      repo: repoFullName,
      mode: apiMode,
    });

    setLastDebug(r.debug);
    if (!r.ok) {
      setLastError(r.error);
      setStatusByMode((prev) => ({ ...prev, [mode]: { exists: false } }));
      return;
    }

    const data = r.data as StatusResult;
    setStatusByMode((prev) => ({ ...prev, [mode]: data }));
  } catch (e: any) {
    setLastError(e?.message ?? String(e));
  } finally {
    if (setBusyFlag) setBusy(null);
  }
}

  async function refreshStatus(mode: UiModeId) {
  if (!canRun) {
    Alert.alert("Fehlt was", "Supabase URL, Repo oder Admin-Key fehlen. Bitte erst oben setzen.");
    return;
  }

  // Prevent stacked calls on bad networks.
  if (runningRef.current) return;
  runningRef.current = true;

  try {
    await refreshStatusCore(mode, { setBusy: true });
  } finally {
    runningRef.current = false;
  }
}

  async function refreshAll() {
  if (!canRun) {
    Alert.alert("Fehlt was", "Supabase URL, Repo oder Admin-Key fehlen. Bitte erst oben setzen.");
    return;
  }

  // Separate guard so refreshAll doesn't deadlock with refreshStatus' guard.
  if (runningAllRef.current) return;
  runningAllRef.current = true;

  setBusy("status:all");
  setLastError(null);
  setLastDebug(null);

  try {
    // Sequential to avoid rate-limit bursts (stable).
    // eslint-disable-next-line no-restricted-syntax
    for (const m of MODES) {
      // eslint-disable-next-line no-await-in-loop
      await refreshStatusCore(m.id, { setBusy: false });
    }
    toast.show("Status aktualisiert");
  } finally {
    runningAllRef.current = false;
    setBusy(null);
  }
}


  async function generate(mode: UiModeId) {
    if (!canRun) {
      Alert.alert("Fehlt was", "Supabase URL, Repo oder Admin-Key fehlen. Bitte erst oben setzen.");
      return;
    }

    setBusy(`generate:${mode}`);
    setLastError(null);
    setLastDebug(null);

    try {
      const apiMode = normalizeModeForApi(mode);
      const r = await invokeEdgeJson(supabaseUrl, "android-keystore-generate", adminKey, {
        repo: repoFullName,
        mode: apiMode,
        // optional: branch rein, damit du später mehr Kontext hast (DB key bleibt repo+mode)
        branch: branch || undefined,
      });

      setLastDebug(r.debug);
      if (!r.ok) {
        setLastError(r.error);
        return;
      }

      if ((r.data as any)?.ok === false) {
        setLastError((r.data as any)?.error ?? "Generate fehlgeschlagen");
        return;
      }

      toast.show("Keystore erstellt");
      await refreshStatus(mode);
    } catch (e: any) {
      setLastError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onSaveAdminKey() {
    const trimmed = adminKey.trim();
    setAdminKey(trimmed);
    await saveEdgeAdminKey(trimmed);
    toast.show("Admin-Key gespeichert");
  }

  async function onCopyError() {
    await Clipboard.setStringAsync(prettyError);
    toast.show("Fehler kopiert");
  }

  async function onCopyDebug() {
    await Clipboard.setStringAsync(prettyDebug);
    toast.show("Debug kopiert");
  }

  const modeHint = useMemo(() => MODES.find((m) => m.id === selectedMode)?.hint ?? "", [selectedMode]);

  const headerSubtitle = useMemo(() => {
    if (!repoFullName) return "Repo nicht verlinkt";
    const b = branch ? ` · ${branch}` : "";
    return `${repoFullName}${b}`;
  }, [repoFullName, branch]);

  return {
    toast,

    repoFullName,
    branch,

    MODES,

    selectedMode,
    setSelectedMode,

    supabaseUrl,

    adminKey,
    setAdminKey,
    adminKeyLoaded,
    onSaveAdminKey,

    busy,

    statusByMode,
    selectedStatus,

    lastDebug,
    lastError,
    setLastError,
    setLastDebug,

    showAdvanced,
    setShowAdvanced,
    showDebug,
    setShowDebug,
    showError,
    setShowError,

    canRun,
    modeHint,
    headerSubtitle,

    prettyDebug,
    prettyError,

    metaForStatus,
    normalizeModeForUi,
    pickStorageBucket,
    pickStoragePath,
    pickUpdatedAt,

    refreshStatus,
    refreshAll,
    generate,

    onCopyError,
    onCopyDebug,
  };
}
