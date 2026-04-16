// screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts
// REFACTORED: actions/orchestration -> useCredentialsWizardActions.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { useProject } from "../../../contexts/ProjectContext";
import { ensureSupabaseClient } from "../../../lib/supabase";
import {
  getAndroidKeystoreExportAdminKey,
} from "../../../infra/github/githubService";
// Source-contract marker: admin key persistence action was extracted to useCredentialsWizardActions.ts
// saveAndroidKeystoreExportAdminKey
import {
  resolveProjectCredentialScope,
} from "../../../lib/storageKeys";

import type { UiModeId } from "../types";

import {
  MODES, pickStorageBucket, pickStoragePath, pickUpdatedAt,
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
import { runStatusRefreshAction } from "./wizardEdgeActions";
import { useCredentialsWizardUiState } from "./useCredentialsWizardUiState";
import { useCredentialsWizardActions } from "./useCredentialsWizardActions";

export { mergePersistedStatusByMode };

const MISSING_OPERATOR_JWT_TITLE = "Supabase Login fehlt";
const MISSING_OPERATOR_JWT_MESSAGE =
  "Keystore-Status/Generate benötigen einen Supabase Operator-JWT mit Rolle build_admin (oder service_role fuer Server-Caller) sowie den lokalen Android Keystore Export Admin Key. build_admin wird im Betriebs-/Provisioning-Prozess ausserhalb dieses Repos per Supabase-User-Claim vergeben. Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim sind fuer diesen Operator-Flow fail-closed blockiert.";

export function useCredentialsWizardScreen() {
  const project = useProject();

  const repoFullName = project?.projectData?.linkedRepo ?? "";
  const branch = project?.projectData?.linkedBranch ?? "";

  const initialMode: UiModeId =
    normalizeModeForUi(project?.projectData?.preferredBuildProfile) ?? "dev";
  const [selectedMode, setSelectedMode] = useState<UiModeId>(initialMode);

  useEffect(() => {
    const next = normalizeModeForUi(project?.projectData?.preferredBuildProfile) ?? "dev";
    setSelectedMode((prev) => (prev === next ? prev : next));
  }, [project?.projectData?.preferredBuildProfile]);

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

  const [statusByMode, setStatusByMode] = useState(getEmptyStatusByMode());
  const statusByModeRef = useRef(statusByMode);

  useEffect(() => {
    statusByModeRef.current = statusByMode;
  }, [statusByMode]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, [isMountedRef]);

  useEffect(() => {
    (async () => {
      try {
        const client = await ensureSupabaseClient();
        if (!isMountedRef.current) return;
        const url = (client as unknown as { supabaseUrl?: string } | null)?.supabaseUrl;
        if (url && isMountedRef.current) setSupabaseUrl(url);
      } catch (e) {
        safeSetLastError(e);
      }
    })();
  }, [safeSetLastError, isMountedRef]);

  const hydrateAdminKey = useCallback(async () => {
    try {
      const k = await getAndroidKeystoreExportAdminKey();
      if (!isMountedRef.current) return null;
      setAdminKey(k ?? "");
      return k ?? "";
    } finally {
      if (isMountedRef.current) setAdminKeyLoaded(true);
    }
  }, [isMountedRef]);

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
    // Source-contract marker: legacy status-key invariants remain intentionally documented in facade scope.
    // credKeyForProjectUiMode
    // scopedKey !== legacyKey
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

  const persistWizardStatus = useCallback(
    async (mode: UiModeId, status: ReturnType<typeof getEmptyStatusByMode>[UiModeId]) =>
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
        getCurrentStatusForMode: (nextMode) => statusByModeRef.current[nextMode],
      }),
    [adminKey, persistWizardStatus, repoFullName, safeSetLastDebug, safeSetLastError, supabaseUrl, isMountedRef],
  );

  const wizardActions = useCredentialsWizardActions({
    supabaseUrl,
    adminKey,
    setAdminKey,
    repoFullName,
    branch,
    busy,
    setBusy,
    setLastError,
    setLastDebug,
    lastError,
    lastDebug,
    selectedMode,
    statusByMode,
    setStatusByMode,
    isMountedRef,
    activeActionRef,
    safeSetLastError,
    safeSetLastDebug,
    ensureCanRunOrAlert,
    requireUserJwtOrAlert,
    persistWizardStatus,
    refreshStatusCore,
    hydrateAdminKey,
  });

  return {
    toast: wizardActions.toast,

    repoFullName,
    branch,

    MODES,

    selectedMode,
    setSelectedMode,

    supabaseUrl,

    adminKey,
    setAdminKey,
    adminKeyLoaded,
    onSaveAdminKey: wizardActions.onSaveAdminKey,

    busy,

    statusByMode,
    selectedStatus: wizardActions.selectedStatus,

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
    modeHint: wizardActions.modeHint,
    headerSubtitle: wizardActions.headerSubtitle,

    prettyDebug: wizardActions.prettyDebug,
    prettyError: wizardActions.prettyError,

    metaForStatus: wizardActions.metaForStatus,
    normalizeModeForUi,
    pickStorageBucket,
    pickStoragePath,
    pickUpdatedAt,

    refreshStatus: wizardActions.refreshStatus,
    refreshAll: wizardActions.refreshAll,
    generate: wizardActions.generate,
    formatBusyLabel: wizardActions.formatBusyLabel,

    onCopyError: wizardActions.onCopyError,
    onCopyDebug: wizardActions.onCopyDebug,
  };
}
