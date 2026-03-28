// screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts
// REFACTORED: helpers → credentialHelpers.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useProject } from "../../../contexts/ProjectContext";
import { ensureSupabaseClient } from "../../../lib/supabase";
import {
  getAndroidKeystoreExportAdminKey,
  getLegacyEdgeAdminKey,
  saveAndroidKeystoreExportAdminKey,
} from "../../../infra/github/githubService";
import {
  credKeyForProjectUiMode,
  credKeyForUiMode,
  credStatusMetaKeyForProjectUiMode,
  resolveProjectCredentialScope,
} from "../../../lib/storageKeys";

import { useInlineToast } from "../../../components/diagnostics/useInlineToast";
import { theme } from "../../../theme";
import { SUPABASE_EDGE_FUNCTIONS } from "../../../shared/constants/supabase";

import type { ApiModeId, ModeDef, StatusResult, UiModeId, WizardHttpDebug } from "../types";

import {
  isLikelyValidRepoFullName,
  isLikelyValidSupabaseUrl,
  sanitizeErrorForUi,
  sanitizeWizardHttpDebug,
} from "../utils/security";
import { isLikelyValidAdminKey } from "../../../lib/security/isLikelyValidAdminKey";
import { describeLocalEdgeAdminKeyIssue } from "../utils/localAdminKey";


import {
  MODES, pickStorageBucket, pickStoragePath, pickUpdatedAt,
  paletteTextMuted, paletteSuccess, paletteError, invokeEdgeJson,
  normalizeModeForUi,
  normalizeModeForApi,
} from "./credentialHelpers";
import {
  formatWizardBusyLabel,
  resolveWizardStatusPresentation,
  toGeneratedPendingStatus,
  toGeneratedPendingStatusWithReason,
  toWizardErrorStatus,
  toWizardStatusResult,
} from "../statusContract";

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
  }, [project?.projectData?.preferredBuildProfile]);

  // Persist selection back to the project (single source of truth).
  useEffect(() => {
    const apiMode = normalizeModeForApi(selectedMode);
    if (apiMode && apiMode !== project?.projectData?.preferredBuildProfile) {
      if (project?.setPreferredBuildProfile) void project.setPreferredBuildProfile(apiMode);
    }
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

  const activeActionRef = useRef<string | null>(null);
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
        const url = (client as unknown as { supabaseUrl?: string } | null)?.supabaseUrl;
        if (url && isMountedRef.current) setSupabaseUrl(url);
      } catch (e) {
        safeSetLastError(e);
      }
    })();
  }, [safeSetLastError]);

  const hydrateAdminKey = useCallback(async () => {
    try {
      const scopedKeystoreKey = await getAndroidKeystoreExportAdminKey();
      const k = scopedKeystoreKey ?? (await getLegacyEdgeAdminKey());
      if (!isMountedRef.current) return null;
      setAdminKey(k ?? "");
      return k ?? "";
    } finally {
      if (isMountedRef.current) setAdminKeyLoaded(true);
    }
  }, []);

  useEffect(() => {
    void hydrateAdminKey();
  }, [hydrateAdminKey]);

  useFocusEffect(
    useCallback(() => {
      void hydrateAdminKey();
      return undefined;
    }, [hydrateAdminKey]),
  );

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

  const requireUserJwtOrAlert = useCallback(async (): Promise<string | null> => {
    try {
      const client = await ensureSupabaseClient();
      const sessionResult = await (client as {
        auth?: {
          getSession?: () => Promise<{ data?: { session?: { access_token?: string | null } | null } | null }>;
        };
      })?.auth?.getSession?.();
      const jwt = sessionResult?.data?.session?.access_token?.trim();
      if (jwt) return jwt;
    } catch (error) {
      safeSetLastError(error);
    }

    Alert.alert(
      "Supabase Login fehlt",
      "Keystore-Status/Generate benötigen einen Supabase Operator-JWT mit Rolle build_admin (oder service_role fuer Server-Caller) sowie den lokalen Android Keystore Export Admin Key. build_admin wird im Betriebs-/Provisioning-Prozess ausserhalb dieses Repos per Supabase-User-Claim vergeben.",
    );
    return null;
  }, [safeSetLastError]);

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
        const scopedStateKey = credStatusMetaKeyForProjectUiMode({
          mode,
          field: "state",
          projectScope: projectCredentialScope,
        });
        const legacyStateKey = credStatusMetaKeyForProjectUiMode({ mode, field: "state" });
        const scopedDetailKey = credStatusMetaKeyForProjectUiMode({
          mode,
          field: "detail",
          projectScope: projectCredentialScope,
        });
        const legacyDetailKey = credStatusMetaKeyForProjectUiMode({ mode, field: "detail" });

        const scopedVal = await AsyncStorage.getItem(scopedKey).catch(() => null);
        let exists = scopedVal === "true" ? true : scopedVal === "false" ? false : null;

        if (exists === null && scopedKey !== legacyKey) {
          const legacyVal = await AsyncStorage.getItem(legacyKey).catch(() => null);
          exists = legacyVal === "true" ? true : legacyVal === "false" ? false : null;
        }

        const scopedStateVal = await AsyncStorage.getItem(scopedStateKey).catch(() => null);
        const credentialState =
          scopedStateVal ??
          (scopedStateKey !== legacyStateKey
            ? await AsyncStorage.getItem(legacyStateKey).catch(() => null)
            : null);
        const scopedDetailVal = await AsyncStorage.getItem(scopedDetailKey).catch(() => null);
        const stateDetail =
          scopedDetailVal ??
          (scopedDetailKey !== legacyDetailKey
            ? await AsyncStorage.getItem(legacyDetailKey).catch(() => null)
            : null);

        if (exists !== null || credentialState || stateDetail) {
          next[mode] = {
            exists: exists ?? false,
            credentialState:
              credentialState === "verified" ||
              credentialState === "missing" ||
              credentialState === "unknown" ||
              credentialState === "auth_error" ||
              credentialState === "stale" ||
              credentialState === "generated_pending_verification"
                ? credentialState
                : undefined,
            stateDetail: stateDetail ?? undefined,
          };
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
    const presentation = resolveWizardStatusPresentation({
      status: s,
      mode,
      busy,
    });

    const color =
      presentation.colorToken === "ok"
        ? paletteSuccess()
        : presentation.colorToken === "error"
          ? paletteError()
          : presentation.colorToken === "warn"
            ? theme.palette.warning
            : paletteTextMuted();

    return {
      icon: presentation.icon,
      text: presentation.text,
      color,
      detail: presentation.detail,
      state: presentation.state,
      requiresManualRecheck: presentation.requiresManualRecheck,
      treatsAsMissing: presentation.treatsAsMissing,
      treatsAsVerified: presentation.treatsAsVerified,
    };
  }

  const tryBeginAction = useCallback((nextBusy: string): boolean => {
    if (activeActionRef.current) return false;
    activeActionRef.current = nextBusy;
    if (isMountedRef.current) setBusy(nextBusy);
    return true;
  }, []);

  const finishAction = useCallback((nextBusy: string) => {
    if (activeActionRef.current === nextBusy) activeActionRef.current = null;
    if (isMountedRef.current) {
      setBusy((prev) => (prev === nextBusy ? null : prev));
    }
  }, []);

  const persistWizardStatus = useCallback(
    async (mode: UiModeId, status: StatusResult | null) => {
      const existsKey = credKeyForProjectUiMode({ mode, projectScope: projectCredentialScope });
      const stateKey = credStatusMetaKeyForProjectUiMode({
        mode,
        field: "state",
        projectScope: projectCredentialScope,
      });
      const detailKey = credStatusMetaKeyForProjectUiMode({
        mode,
        field: "detail",
        projectScope: projectCredentialScope,
      });
      const removeItem = typeof AsyncStorage.removeItem === "function"
        ? AsyncStorage.removeItem.bind(AsyncStorage)
        : async () => undefined;
      await Promise.all([
        AsyncStorage.setItem(existsKey, status?.exists ? "true" : "false").catch(() => {}),
        status?.credentialState
          ? AsyncStorage.setItem(stateKey, status.credentialState).catch(() => {})
          : removeItem(stateKey).catch(() => {}),
        status?.stateDetail
          ? AsyncStorage.setItem(detailKey, status.stateDetail).catch(() => {})
          : removeItem(detailKey).catch(() => {}),
      ]);
    },
    [projectCredentialScope],
  );

  async function refreshStatusCore(
    mode: UiModeId,
    userJwt: string,
    opts?: { preservePendingOnError?: boolean },
  ) {
    safeSetLastError(null);
    safeSetLastDebug(null);

    try {
      const apiMode = normalizeModeForApi(mode);
      const r = await invokeEdgeJson(
        supabaseUrl,
        SUPABASE_EDGE_FUNCTIONS.ANDROID_KEYSTORE_STATUS,
        adminKey,
        userJwt,
        {
        repo: repoFullName,
        mode: apiMode,
      });

      safeSetLastDebug(r.debug);
      if (!r.ok) {
        safeSetLastError(r.error);
        if (isMountedRef.current) {
          setStatusByMode((prev) => {
            const nextStatus =
              opts?.preservePendingOnError && prev[mode]?.credentialState === "generated_pending_verification"
                ? toGeneratedPendingStatusWithReason(prev[mode], "Statuscheck konnte den neuen Keystore noch nicht bestaetigen.")
                : toWizardErrorStatus({
                    previous: prev[mode],
                    statusCode: r.debug.status ?? null,
                    error: r.error,
                    detail: describeLocalEdgeAdminKeyIssue({
                      adminKey,
                      statusCode: r.debug.status ?? null,
                      error: r.error,
                      surface: "keystore",
                    }),
                  });
            void persistWizardStatus(mode, nextStatus);
            return {
              ...prev,
              [mode]: nextStatus,
            };
          });
        }
        return false;
      }

      const data = toWizardStatusResult(r.data as StatusResult);
      if (isMountedRef.current) {
        setStatusByMode((prev) => ({ ...prev, [mode]: data }));
      }
      await persistWizardStatus(mode, data);
      return true;
    } catch (e: unknown) {
      safeSetLastError(e);
      if (isMountedRef.current) {
        setStatusByMode((prev) => {
          const nextStatus =
            prev[mode]?.credentialState === "generated_pending_verification"
              ? toGeneratedPendingStatusWithReason(
                  prev[mode],
                  "Statuscheck konnte den neuen Keystore noch nicht bestaetigen.",
                )
              : toWizardErrorStatus({
                  previous: prev[mode],
                  error: e,
                  detail: describeLocalEdgeAdminKeyIssue({ adminKey, error: e, surface: "keystore" }),
                });
          void persistWizardStatus(mode, nextStatus);
          return {
            ...prev,
            [mode]: nextStatus,
          };
        });
      }
      return false;
    }
  }

  async function refreshStatus(mode: UiModeId) {
    if (!ensureCanRunOrAlert()) return;
    const userJwt = await requireUserJwtOrAlert();
    if (!userJwt) return;

    const actionKey = `status:${mode}`;
    if (!tryBeginAction(actionKey)) return;

    try {
      await refreshStatusCore(mode, userJwt, { preservePendingOnError: true });
    } finally {
      finishAction(actionKey);
    }
  }

  async function refreshAll() {
    if (!ensureCanRunOrAlert()) return;
    const userJwt = await requireUserJwtOrAlert();
    if (!userJwt) return;

    const actionKey = "status:all";
    if (!tryBeginAction(actionKey)) return;

    if (isMountedRef.current) {
      setLastError(null);
      setLastDebug(null);
    }

    try {
      // Sequential to avoid rate-limit bursts (stable + gentle on Edge functions)
      for (const m of MODES) {
        await refreshStatusCore(m.id, userJwt);
      }
      toast.show("Status aktualisiert");
    } finally {
      finishAction(actionKey);
    }
  }

  async function generate(mode: UiModeId) {
    if (!ensureCanRunOrAlert()) return;
    const userJwt = await requireUserJwtOrAlert();
    if (!userJwt) return;

    const actionKey = `generate:${mode}`;
    if (!tryBeginAction(actionKey)) return;

    if (isMountedRef.current) {
      setLastError(null);
      setLastDebug(null);
    }

    try {
      const apiMode = normalizeModeForApi(mode);
      const r = await invokeEdgeJson(
        supabaseUrl,
        SUPABASE_EDGE_FUNCTIONS.ANDROID_KEYSTORE_GENERATE,
        adminKey,
        userJwt,
        {
        repo: repoFullName,
        mode: apiMode,
      });

      safeSetLastDebug(r.debug);
      if (!r.ok) {
        safeSetLastError(r.error);
        if (isMountedRef.current) {
          setStatusByMode((prev) => {
            const nextStatus = toWizardErrorStatus({
              previous: prev[mode],
              statusCode: r.debug.status ?? null,
              error: r.error,
              detail: describeLocalEdgeAdminKeyIssue({
                adminKey,
                statusCode: r.debug.status ?? null,
                error: r.error,
                surface: "keystore",
              }),
            });
            void persistWizardStatus(mode, nextStatus);
            return {
              ...prev,
              [mode]: nextStatus,
            };
          });
        }
        return;
      }

      const data = r.data as { ok?: boolean; error?: string } | null;
      if (data?.ok === false) {
        safeSetLastError(data.error ?? "Generate fehlgeschlagen");
        return;
      }

      if (isMountedRef.current) {
        setStatusByMode((prev) => {
          const nextStatus = toGeneratedPendingStatus(prev[mode]);
          void persistWizardStatus(mode, nextStatus);
          return {
            ...prev,
            [mode]: nextStatus,
          };
        });
      }

      toast.show("Keystore erzeugt - Verifikation laeuft/steht noch aus");
      await refreshStatusCore(mode, userJwt, { preservePendingOnError: true });
    } catch (e: unknown) {
      safeSetLastError(e);
      if (isMountedRef.current) {
        setStatusByMode((prev) => {
          const nextStatus =
            prev[mode]?.credentialState === "generated_pending_verification"
              ? toGeneratedPendingStatusWithReason(
                  prev[mode],
                  "Statuscheck konnte den neuen Keystore noch nicht bestaetigen.",
                )
              : toWizardErrorStatus({
                  previous: prev[mode],
                  error: e,
                  detail: describeLocalEdgeAdminKeyIssue({ adminKey, error: e, surface: "keystore" }),
                });
          void persistWizardStatus(mode, nextStatus);
          return {
            ...prev,
            [mode]: nextStatus,
          };
        });
      }
    } finally {
      finishAction(actionKey);
    }
  }

  async function onSaveAdminKey() {
    const trimmed = adminKey.trim();
    setAdminKey(trimmed);

    if (trimmed && !isLikelyValidAdminKey(trimmed)) {
      Alert.alert(
        "Admin-Key wirkt ungültig",
        "Bitte nur einen formal gültigen lokalen Android Keystore Export Admin Key ohne Leerzeichen speichern.",
      );
      return;
    }

    await saveAndroidKeystoreExportAdminKey(trimmed);
    await hydrateAdminKey();
    toast.show(
      trimmed
        ? "Android Keystore Export Admin Key gespeichert und neu geladen"
        : "Android Keystore Export Admin Key gelöscht und neu geladen",
    );
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
    formatBusyLabel: busy ? formatWizardBusyLabel(busy) : null,

    onCopyError,
    onCopyDebug,
  };
}
