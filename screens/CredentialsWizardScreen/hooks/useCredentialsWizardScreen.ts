// screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts
// REFACTORED: helpers → credentialHelpers.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useProject } from "../../../contexts/ProjectContext";
import { ensureSupabaseClient } from "../../../lib/supabase";
import { getEdgeAdminKey, saveEdgeAdminKey } from "../../../infra/github/githubService";
import {
  credKeyForProjectUiMode,
  credKeyForUiMode,
  resolveProjectCredentialScope,
} from "../../../lib/storageKeys";

import { useInlineToast } from "../../../components/diagnostics/useInlineToast";
import { theme } from "../../../theme";
import { SUPABASE_EDGE_FUNCTIONS } from "../../../shared/constants/supabase";

import type { ApiModeId, ModeDef, StatusResult, UiModeId, WizardHttpDebug } from "../types";

import {
  isLikelyValidAdminKey,
  isLikelyValidRepoFullName,
  isLikelyValidSupabaseUrl,
  sanitizeErrorForUi,
  sanitizeWizardHttpDebug,
} from "../utils/security";


import {
  MODES, pickStorageBucket, pickStoragePath, pickUpdatedAt,
  paletteTextMuted, paletteSuccess, paletteError, invokeEdgeJson,
  normalizeModeForUi,
  normalizeModeForApi,
} from "./credentialHelpers";

const EMPTY_STATUS_BY_MODE: Record<UiModeId, StatusResult | null> = {
  dev: null,
  preview: null,
  production: null,
};

export function mergePersistedStatusByMode(
  next: Partial<Record<UiModeId, StatusResult>>,
): Record<UiModeId, StatusResult | null> {
  return {
    ...EMPTY_STATUS_BY_MODE,
    ...next,
  };
}

export function useCredentialsWizardScreen() {
  const project = useProject();
  const toast = useInlineToast();

  // Repo/Branch niemals "fest pinnen" – immer aus dem aktuell verlinkten Projekt holen.
  const repoFullName = project?.projectData?.linkedRepo ?? "";
  const branch = project?.projectData?.linkedBranch ?? "";

  const initialMode: UiModeId =
    normalizeModeForUi(project?.projectData?.preferredBuildProfile) ?? "dev";
  const [selectedMode, setSelectedMode] = useState<UiModeId>(initialMode);

  // If Build Screen / other parts change the preferred profile, mirror it here.
  useEffect(() => {
    const next = normalizeModeForUi(project?.projectData?.preferredBuildProfile) ?? "dev";
    setSelectedMode((prev) => (prev === next ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.projectData?.preferredBuildProfile]);

  // Persist selection back to the project (single source of truth).
  useEffect(() => {
    const apiMode = normalizeModeForApi(selectedMode);
    if (apiMode && apiMode !== project?.projectData?.preferredBuildProfile) {
      if (project?.setPreferredBuildProfile) void project.setPreferredBuildProfile(apiMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMode, project?.projectData?.preferredBuildProfile, project?.setPreferredBuildProfile]);

  const [supabaseUrl, setSupabaseUrl] = useState<string>("");
  const [adminKey, setAdminKey] = useState<string>("");
  const [adminKeyLoaded, setAdminKeyLoaded] = useState(false);

  const [busy, setBusy] = useState<string | null>(null);

  const projectCredentialScope = useMemo(
    () =>
      resolveProjectCredentialScope({
        projectId: project?.projectData?.id,
        linkedRepo: project?.projectData?.linkedRepo,
      }),
    [project?.projectData?.id, project?.projectData?.linkedRepo],
  );

  const [statusByMode, setStatusByMode] = useState<Record<UiModeId, StatusResult | null>>(
    EMPTY_STATUS_BY_MODE,
  );

  const [lastDebug, setLastDebug] = useState<WizardHttpDebug | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showError, setShowError] = useState(false);

  const runningRef = useRef(false);
  const runningAllRef = useRef(false);
  const generateRef = useRef(false);
  const isMountedRef = useRef(true);

  const safeSetLastError = useCallback(
    (err: unknown) => {
      if (!isMountedRef.current) return;
      const text = err instanceof Error ? err.message : String(err ?? "");
      setLastError(sanitizeErrorForUi(text));
    },
    [setLastError]
  );

  const safeSetLastDebug = useCallback(
    (dbg: WizardHttpDebug | null) => {
      if (!isMountedRef.current) return;
      setLastDebug(dbg ? sanitizeWizardHttpDebug(dbg) : null);
    },
    [setLastDebug]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const client = await ensureSupabaseClient();
        if (!isMountedRef.current) return;
        // supabase-js client exposes supabaseUrl
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const url = (client as any)?.supabaseUrl as string | undefined;
        if (url && isMountedRef.current) setSupabaseUrl(url);
      } catch (e) {
        safeSetLastError(e);
      }
    })();
  }, [safeSetLastError]);

  useEffect(() => {
    (async () => {
      try {
        const k = await getEdgeAdminKey();
        if (!isMountedRef.current) return;
        if (k && isMountedRef.current) setAdminKey(k);
      } finally {
        if (isMountedRef.current) setAdminKeyLoaded(true);
      }
    })();
  }, []);

  const canRun = useMemo(() => {
    return (
      Boolean(supabaseUrl && adminKey && repoFullName) &&
      isLikelyValidSupabaseUrl(supabaseUrl) &&
      isLikelyValidAdminKey(adminKey) &&
      isLikelyValidRepoFullName(repoFullName)
    );
  }, [supabaseUrl, adminKey, repoFullName]);

  const ensureCanRunOrAlert = useCallback((): boolean => {
    const url = (supabaseUrl || "").trim();
    const key = (adminKey || "").trim();
    const repo = (repoFullName || "").trim();

    if (!url || !key || !repo) {
      Alert.alert("Fehlt was", "Supabase URL, Repo oder Admin-Key fehlen. Bitte erst oben setzen.");
      return false;
    }

    if (!isLikelyValidSupabaseUrl(url)) {
      Alert.alert(
        "Supabase URL ungültig",
        "Bitte eine HTTPS URL angeben (z.B. https://<project>.supabase.co) und keine Leerzeichen."
      );
      return false;
    }

    if (!isLikelyValidRepoFullName(repo)) {
      Alert.alert("Repo ungültig", "Repo muss im Format owner/repo sein (z.B. k1w1-a0style/k1w1-a0style).");
      return false;
    }

    if (!isLikelyValidAdminKey(key)) {
      Alert.alert("Admin-Key wirkt ungültig", "Admin-Key ist zu kurz oder enthält Leerzeichen.");
      return false;
    }

    return true;
  }, [supabaseUrl, adminKey, repoFullName]);

  useEffect(() => {
    let cancelled = false;

    // Scope changed (project/repo switch): clear old in-memory status immediately
    // so another project's last-known state does not leak into this screen.
    setStatusByMode(EMPTY_STATUS_BY_MODE);

    (async () => {
      const next: Partial<Record<UiModeId, StatusResult>> = {};

      for (const mode of MODES.map((m) => m.id)) {
        const scopedKey = credKeyForProjectUiMode({ mode, projectScope: projectCredentialScope });
        const legacyKey = credKeyForUiMode(mode);

        const scopedVal = await AsyncStorage.getItem(scopedKey).catch(() => null);
        let exists = scopedVal === "true" ? true : scopedVal === "false" ? false : null;

        if (exists === null && scopedKey !== legacyKey) {
          const legacyVal = await AsyncStorage.getItem(legacyKey).catch(() => null);
          exists = legacyVal === "true" ? true : legacyVal === "false" ? false : null;
        }

        if (exists !== null) {
          next[mode] = { exists };
        }
      }

      if (cancelled) return;
      setStatusByMode(mergePersistedStatusByMode(next));
    })();

    return () => {
      cancelled = true;
    };
  }, [projectCredentialScope]);

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

    safeSetLastError(null);
    safeSetLastDebug(null);
    if (setBusyFlag && isMountedRef.current) setBusy(`status:${mode}`);

    try {
      const apiMode = normalizeModeForApi(mode);
      const r = await invokeEdgeJson(supabaseUrl, SUPABASE_EDGE_FUNCTIONS.ANDROID_KEYSTORE_STATUS, adminKey, {
        repo: repoFullName,
        mode: apiMode,
      });

      safeSetLastDebug(r.debug);
      if (!r.ok) {
        safeSetLastError(r.error);
        if (isMountedRef.current) setStatusByMode((prev) => ({ ...prev, [mode]: { exists: false } }));
        return;
      }

      const data = r.data as StatusResult;
      if (isMountedRef.current) setStatusByMode((prev) => ({ ...prev, [mode]: data }));
      // Persist key status
      const credKey = credKeyForProjectUiMode({
        mode,
        projectScope: projectCredentialScope,
      });
      await AsyncStorage.setItem(credKey, data.exists ? "true" : "false").catch(() => {});
    } catch (e: unknown) {
      safeSetLastError(e);
    } finally {
      if (setBusyFlag && isMountedRef.current) setBusy(null);
    }
  }

  async function refreshStatus(mode: UiModeId) {
    if (!ensureCanRunOrAlert()) return;

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
    if (!ensureCanRunOrAlert()) return;

    // Separate guard so refreshAll doesn't deadlock with refreshStatus' guard.
    if (runningAllRef.current) return;
    runningAllRef.current = true;

    if (isMountedRef.current) {
      setBusy("status:all");
      setLastError(null);
      setLastDebug(null);
    }

    try {
      // Sequential to avoid rate-limit bursts (stable + gentle on Edge functions)
      // eslint-disable-next-line no-restricted-syntax
      for (const m of MODES) {
        // eslint-disable-next-line no-await-in-loop
        await refreshStatusCore(m.id, { setBusy: false });
      }
      toast.show("Status aktualisiert");
    } finally {
      runningAllRef.current = false;
      if (isMountedRef.current) setBusy(null);
    }
  }

  async function generate(mode: UiModeId) {
    if (!ensureCanRunOrAlert()) return;
    if (generateRef.current) return;
    generateRef.current = true;

    if (isMountedRef.current) {
      setBusy(`generate:${mode}`);
      setLastError(null);
      setLastDebug(null);
    }

    try {
      const apiMode = normalizeModeForApi(mode);
      const r = await invokeEdgeJson(supabaseUrl, SUPABASE_EDGE_FUNCTIONS.ANDROID_KEYSTORE_GENERATE, adminKey, {
        repo: repoFullName,
        mode: apiMode,
        // optional: branch rein, damit du später mehr Kontext hast (DB key bleibt repo+mode)
        branch: branch || undefined,
      });

      safeSetLastDebug(r.debug);
      if (!r.ok) {
        safeSetLastError(r.error);
        return;
      }

      const data = r.data as { ok?: boolean; error?: string } | null;
      if (data?.ok === false) {
        safeSetLastError(data.error ?? "Generate fehlgeschlagen");
        return;
      }

      toast.show("Keystore erstellt");
      await refreshStatus(mode);
    } catch (e: unknown) {
      safeSetLastError(e);
    } finally {
      generateRef.current = false;
      if (isMountedRef.current) setBusy(null);
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
