import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";

import { saveAndroidKeystoreExportAdminKey } from "../../../infra/github/githubService";
import { useInlineToast } from "../../../components/diagnostics/useInlineToast";
import { theme } from "../../../theme";
import { isLikelyValidAdminKey } from "../../../lib/security/isLikelyValidAdminKey";

import type { StatusResult, UiModeId, WizardHttpDebug } from "../types";
import { MODES, paletteError, paletteSuccess, paletteTextMuted } from "./credentialHelpers";
import {
  formatWizardBusyLabel,
  resolveWizardStatusPresentation,
} from "../statusContract";
import { runGenerateAction, runStatusRefreshAction } from "./wizardEdgeActions";

export const useCredentialsWizardActions = (params: {
  supabaseUrl: string;
  adminKey: string;
  setAdminKey: (next: string) => void;
  repoFullName: string;
  branch: string;
  busy: string | null;
  setBusy: (next: string | ((prev: string | null) => string | null)) => void;
  setLastError: Dispatch<SetStateAction<string | null>>;
  setLastDebug: Dispatch<SetStateAction<WizardHttpDebug | null>>;
  lastError: string | null;
  lastDebug: WizardHttpDebug | null;
  selectedMode: UiModeId;
  statusByMode: Record<UiModeId, StatusResult | null>;
  setStatusByMode: Dispatch<SetStateAction<Record<UiModeId, StatusResult | null>>>;
  isMountedRef: React.MutableRefObject<boolean>;
  activeActionRef: React.MutableRefObject<string | null>;
  safeSetLastError: (value: unknown) => void;
  safeSetLastDebug: (value: WizardHttpDebug | null) => void;
  ensureCanRunOrAlert: () => boolean;
  requireUserJwtOrAlert: () => Promise<string | null>;
  persistWizardStatus: (mode: UiModeId, status: StatusResult | null) => Promise<void>;
  refreshStatusCore: (
    mode: UiModeId,
    userJwt: string,
    opts?: { preservePendingOnError?: boolean },
  ) => Promise<boolean>;
  hydrateAdminKey: () => Promise<string | null>;
}) => {
  const toast = useInlineToast();

  const selectedStatus = params.statusByMode[params.selectedMode];

  const prettyDebug = useMemo(() => {
    if (!params.lastDebug) return "";
    try {
      return JSON.stringify(params.lastDebug, null, 2);
    } catch {
      return String(params.lastDebug);
    }
  }, [params.lastDebug]);

  const prettyError = useMemo(() => {
    if (!params.lastError) return "";
    return String(params.lastError);
  }, [params.lastError]);

  const metaForStatus = useCallback((s: StatusResult | null, mode: UiModeId) => {
    const presentation = resolveWizardStatusPresentation({
      status: s,
      mode,
      busy: params.busy,
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
  }, [params.busy]);

  const tryBeginAction = useCallback((nextBusy: string): boolean => {
    if (params.activeActionRef.current) return false;
    params.activeActionRef.current = nextBusy;
    if (params.isMountedRef.current) params.setBusy(nextBusy);
    return true;
  }, [params.activeActionRef, params.isMountedRef, params.setBusy]);

  const finishAction = useCallback((nextBusy: string) => {
    if (params.activeActionRef.current === nextBusy) params.activeActionRef.current = null;
    if (params.isMountedRef.current) {
      params.setBusy((prev) => (prev === nextBusy ? null : prev));
    }
  }, [params.activeActionRef, params.isMountedRef, params.setBusy]);

  const refreshStatus = useCallback(async (mode: UiModeId) => {
    if (!params.ensureCanRunOrAlert()) return;
    const userJwt = await params.requireUserJwtOrAlert();
    if (!userJwt) return;

    const actionKey = `status:${mode}`;
    if (!tryBeginAction(actionKey)) return;

    try {
      await params.refreshStatusCore(mode, userJwt, { preservePendingOnError: true });
    } finally {
      finishAction(actionKey);
    }
  }, [finishAction, params, tryBeginAction]);

  const refreshAll = useCallback(async () => {
    if (!params.ensureCanRunOrAlert()) return;
    const userJwt = await params.requireUserJwtOrAlert();
    if (!userJwt) return;

    const actionKey = "status:all";
    if (!tryBeginAction(actionKey)) return;

    if (params.isMountedRef.current) {
      params.setLastError(null);
      params.setLastDebug(null);
    }

    try {
      for (const m of MODES) {
        await params.refreshStatusCore(m.id, userJwt);
      }
      toast.show("Status aktualisiert");
    } finally {
      finishAction(actionKey);
    }
  }, [finishAction, params, toast, tryBeginAction]);

  const generate = useCallback(async (mode: UiModeId) => {
    if (!params.ensureCanRunOrAlert()) return;
    const userJwt = await params.requireUserJwtOrAlert();
    if (!userJwt) return;

    const actionKey = `generate:${mode}`;
    if (!tryBeginAction(actionKey)) return;

    try {
      await runGenerateAction({
        mode,
        userJwt,
        supabaseUrl: params.supabaseUrl,
        adminKey: params.adminKey,
        repoFullName: params.repoFullName,
        isMounted: () => params.isMountedRef.current,
        setStatusByMode: params.setStatusByMode,
        safeSetLastError: params.safeSetLastError,
        safeSetLastDebug: params.safeSetLastDebug,
        persistWizardStatus: params.persistWizardStatus,
        onGeneratedPending: () => {
          toast.show("Keystore erzeugt - Verifikation laeuft/steht noch aus");
        },
        refreshStatusAfterGenerate: () =>
          params.refreshStatusCore(mode, userJwt, { preservePendingOnError: true }),
      });
    } finally {
      finishAction(actionKey);
    }
  }, [finishAction, params, toast, tryBeginAction]);

  const onSaveAdminKey = useCallback(async () => {
    const trimmed = params.adminKey.trim();
    params.setAdminKey(trimmed);

    if (trimmed && !isLikelyValidAdminKey(trimmed)) {
      Alert.alert(
        "Admin-Key wirkt ungültig",
        "Bitte nur einen formal gültigen lokalen Android Keystore Export Admin Key ohne Leerzeichen speichern.",
      );
      return;
    }

    await saveAndroidKeystoreExportAdminKey(trimmed);
    await params.hydrateAdminKey();
    toast.show(
      trimmed
        ? "Android Keystore Export Admin Key gespeichert und neu geladen"
        : "Android Keystore Export Admin Key gelöscht und neu geladen",
    );
  }, [params, toast]);

  const onCopyError = useCallback(async () => {
    await Clipboard.setStringAsync(prettyError);
    toast.show("Fehler kopiert");
  }, [prettyError, toast]);

  const onCopyDebug = useCallback(async () => {
    await Clipboard.setStringAsync(prettyDebug);
    toast.show("Debug kopiert");
  }, [prettyDebug, toast]);

  const modeHint = useMemo(() => MODES.find((m) => m.id === params.selectedMode)?.hint ?? "", [params.selectedMode]);

  const headerSubtitle = useMemo(() => {
    if (!params.repoFullName) return "Repo nicht verlinkt";
    const b = params.branch ? ` · ${params.branch}` : "";
    return `${params.repoFullName}${b}`;
  }, [params.branch, params.repoFullName]);

  return {
    toast,
    selectedStatus,
    prettyDebug,
    prettyError,
    metaForStatus,
    refreshStatus,
    refreshAll,
    generate,
    onSaveAdminKey,
    onCopyError,
    onCopyDebug,
    modeHint,
    headerSubtitle,
    formatBusyLabel: params.busy ? formatWizardBusyLabel(params.busy) : null,
  };
};
