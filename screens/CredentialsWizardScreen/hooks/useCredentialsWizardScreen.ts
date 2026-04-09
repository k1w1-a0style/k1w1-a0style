// screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts
// REFACTORED: helpers → credentialHelpers.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";

import { useProject } from "../../../contexts/ProjectContext";
import { ensureSupabaseClient } from "../../../lib/supabase";
import {
  getAndroidKeystoreExportAdminKey,
  saveAndroidKeystoreExportAdminKey,
} from "../../../infra/github/githubService";
import {
  resolveProjectCredentialScope,
} from "../../../lib/storageKeys";

import { useInlineToast } from "../../../components/diagnostics/useInlineToast";
import { theme } from "../../../theme";
import { SUPABASE_EDGE_FUNCTIONS } from "../../../shared/constants/supabase";

import type { ApiModeId, ModeDef, StatusResult, UiModeId } from "../types";

import { isLikelyValidAdminKey } from "../../../lib/security/isLikelyValidAdminKey";
import { describeLocalEdgeAdminKeyIssue } from "../utils/localAdminKey";


import {
  MODES, pickStorageBucket, pickStoragePath, pickUpdatedAt,
  paletteTextMuted, paletteSuccess, paletteError, invokeEdgeJson,
  normalizeModeForUi,
  normalizeModeForApi,
} from "./credentialHelpers";
import {
  getEmptyStatusByMode,
  hydratePersistedStatusByMode,
  mergePersistedStatusByMode,
  persistWizardStatusByMode,
} from "./wizardStatusStore";
import { readCurrentUserJwt } from "./wizardEdgeAuth";
import { isWizardRunInputReady, validateWizardRunInputs } from "./credentialRunValidation";
import {
  formatWizardBusyLabel,
  resolveWizardStatusPresentation,
} from "../statusContract";
import { runGenerateAction, runStatusRefreshAction } from "./wizardEdgeActions";
import { useCredentialsWizardUiState } from "./useCredentialsWizardUiState";

export { mergePersistedStatusByMode };

const MISSING_OPERATOR_JWT_TITLE = "Supabase Login fehlt";
const MISSING_OPERATOR_JWT_MESSAGE =
  "Keystore-Status/Generate benötigen einen Supabase Operator-JWT mit Rolle build_admin (oder service_role fuer Server-Caller) sowie den lokalen Android Keystore Export Admin Key. build_admin wird im Betriebs-/Provisioning-Prozess ausserhalb dieses Repos per Supabase-User-Claim vergeben. Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim sind fuer diesen Operator-Flow fail-closed blockiert.";

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

  const {
    busy,
    setBusy,
    lastDebug,
    lastError,
    showAdvanced,
    setShowAdvanced,
    showDebug,
    setShowDebug,
    showError,
    setShowError,
    activeActionRef,
    isMountedRef,
    safeSetLastError,
    safeSetLastDebug,
    setLastError,
    setLastDebug,
  } = useCredentialsWizardUiState();

  const projectCredentialScope = useMemo(
    () =>
      resolveProjectCredentialScope({
        projectId: project?.projectData?.id,
        linkedRepo: project?.projectData?.linkedRepo,
      }),
    [project?.projectData?.id, project?.projectData?.linkedRepo],
  );

  const [statusByMode, setStatusByMode] = useState<Record<UiModeId, StatusResult | null>>(
    getEmptyStatusByMode(),
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
      const k = await getAndroidKeystoreExportAdminKey();
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
    return isWizardRunInputReady({
      supabaseUrl,
      adminKey,
      repoFullName,
    });
  }, [supabaseUrl, adminKey, repoFullName]);

  const ensureCanRunOrAlert = useCallback((): boolean => {
    const issue = validateWizardRunInputs({
      supabaseUrl,
      adminKey,
      repoFullName,
    });
    if (issue) {
      Alert.alert(issue.title, issue.message);
      return false;
    }

    return true;
  }, [supabaseUrl, adminKey, repoFullName]);

  const requireUserJwtOrAlert = useCallback(
    async (): Promise<string | null> => {
      const jwt = await readCurrentUserJwt({ onError: safeSetLastError });
      if (jwt) return jwt;
      Alert.alert(MISSING_OPERATOR_JWT_TITLE, MISSING_OPERATOR_JWT_MESSAGE);
      return null;
    },
    [safeSetLastError],
  );

  useEffect(() => {
    let cancelled = false;

    // Scope changed (project/repo switch): clear old in-memory status immediately
    // so another project's last-known state does not leak into this screen.
    // Legacy-fallback invariant stays unchanged: credKeyForProjectUiMode + scopedKey !== legacyKey.
    setStatusByMode(getEmptyStatusByMode());

    (async () => {
      if (cancelled) return;
      const next = await hydratePersistedStatusByMode(projectCredentialScope);
      if (cancelled) return;
      setStatusByMode(next);
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
    async (mode: UiModeId, status: StatusResult | null) =>
      persistWizardStatusByMode({ mode, status, projectScope: projectCredentialScope }),
    [projectCredentialScope],
  );

  const refreshStatusCore = useCallback(
    async (
      mode: UiModeId,
      userJwt: string,
      opts?: { preservePendingOnError?: boolean },
    ) =>
      runStatusRefreshAction({
        mode,
        userJwt,
        opts,
        supabaseUrl,
        adminKey,
        repoFullName,
        isMounted: () => isMountedRef.current,
        setStatusByMode,
        safeSetLastError,
        safeSetLastDebug,
        persistWizardStatus,
      }),
    [adminKey, persistWizardStatus, repoFullName, safeSetLastDebug, safeSetLastError, supabaseUrl],
  );

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

    try {
      await runGenerateAction({
        mode,
        userJwt,
        supabaseUrl,
        adminKey,
        repoFullName,
        isMounted: () => isMountedRef.current,
        setStatusByMode,
        safeSetLastError,
        safeSetLastDebug,
        persistWizardStatus,
        onGeneratedPending: () => {
          toast.show("Keystore erzeugt - Verifikation laeuft/steht noch aus");
        },
        refreshStatusAfterGenerate: () =>
          refreshStatusCore(mode, userJwt, { preservePendingOnError: true }),
      });
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
