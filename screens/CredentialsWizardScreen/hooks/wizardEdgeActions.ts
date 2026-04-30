import { SUPABASE_EDGE_FUNCTIONS } from "../../../shared/constants/supabase";

import type { StatusResult, UiModeId, WizardHttpDebug } from "../types";
import { describeLocalEdgeAdminKeyIssue } from "../utils/localAdminKey";
import {
  toGeneratedPendingStatus,
  toGeneratedPendingStatusWithReason,
  toWizardErrorStatus,
  toWizardStatusResult,
} from "../statusContract";
import { invokeEdgeJson, normalizeModeForApi } from "./credentialHelpers";

type SetStatusByMode = (
  updater: (prev: Record<UiModeId, StatusResult | null>) => Record<UiModeId, StatusResult | null>,
) => void;

type RefreshStatusCoreParams = {
  mode: UiModeId;
  userJwt: string | null | undefined;
  supabaseUrl: string;
  adminKey: string;
  repoFullName: string;
  isMounted: () => boolean;
  setStatusByMode: SetStatusByMode;
  safeSetLastError: (error: unknown) => void;
  safeSetLastDebug: (debug: WizardHttpDebug | null) => void;
  persistWizardStatus: (mode: UiModeId, status: StatusResult | null) => Promise<void>;
  getCurrentStatusForMode: (mode: UiModeId) => StatusResult | null;
  opts?: { preservePendingOnError?: boolean };
};

export async function runStatusRefreshAction(params: RefreshStatusCoreParams): Promise<boolean> {
  const {
    mode,
    userJwt,
    supabaseUrl,
    adminKey,
    repoFullName,
    isMounted,
    setStatusByMode,
    safeSetLastError,
    safeSetLastDebug,
    persistWizardStatus,
    getCurrentStatusForMode,
    opts,
  } = params;

  safeSetLastError(null);
  safeSetLastDebug(null);

  try {
    const apiMode = normalizeModeForApi(mode);
    const r = await invokeEdgeJson(
      supabaseUrl,
      SUPABASE_EDGE_FUNCTIONS.ANDROID_KEYSTORE_STATUS,
      adminKey,
      userJwt,
      { repo: repoFullName, mode: apiMode },
    );

    safeSetLastDebug(r.debug);
    if (!r.ok) {
      safeSetLastError(r.error);
      if (isMounted()) {
        const previous = getCurrentStatusForMode(mode);
        const nextStatus =
          opts?.preservePendingOnError && previous?.credentialState === "generated_pending_verification"
            ? toGeneratedPendingStatusWithReason(
                previous,
                "Statuscheck konnte den neuen Keystore noch nicht bestaetigen.",
              )
            : toWizardErrorStatus({
                previous,
                statusCode: r.debug.status ?? null,
                error: r.error,
                detail: describeLocalEdgeAdminKeyIssue({
                  adminKey,
                  statusCode: r.debug.status ?? null,
                  error: r.error,
                  surface: "keystore",
                }),
              });
        setStatusByMode((prev) => ({ ...prev, [mode]: nextStatus }));
        await persistWizardStatus(mode, nextStatus);
      }
      return false;
    }

    const data = toWizardStatusResult(r.data as StatusResult);
    if (isMounted()) {
      setStatusByMode((prev) => ({ ...prev, [mode]: data }));
    }
    await persistWizardStatus(mode, data);
    return true;
  } catch (error: unknown) {
    safeSetLastError(error);
    if (isMounted()) {
      const previous = getCurrentStatusForMode(mode);
      const nextStatus =
        previous?.credentialState === "generated_pending_verification"
          ? toGeneratedPendingStatusWithReason(
              previous,
              "Statuscheck konnte den neuen Keystore noch nicht bestaetigen.",
            )
          : toWizardErrorStatus({
              previous,
              error,
              detail: describeLocalEdgeAdminKeyIssue({ adminKey, error, surface: "keystore" }),
            });
      setStatusByMode((prev) => ({ ...prev, [mode]: nextStatus }));
      await persistWizardStatus(mode, nextStatus);
    }
    return false;
  }
}

type GenerateActionParams = {
  mode: UiModeId;
  userJwt: string | null | undefined;
  supabaseUrl: string;
  adminKey: string;
  repoFullName: string;
  isMounted: () => boolean;
  setStatusByMode: SetStatusByMode;
  safeSetLastError: (error: unknown) => void;
  safeSetLastDebug: (debug: WizardHttpDebug | null) => void;
  persistWizardStatus: (mode: UiModeId, status: StatusResult | null) => Promise<void>;
  getCurrentStatusForMode: (mode: UiModeId) => StatusResult | null;
  onGeneratedPending: () => void;
  refreshStatusAfterGenerate: () => Promise<boolean>;
};

export async function runGenerateAction(params: GenerateActionParams): Promise<void> {
  const {
    mode,
    userJwt,
    supabaseUrl,
    adminKey,
    repoFullName,
    isMounted,
    setStatusByMode,
    safeSetLastError,
    safeSetLastDebug,
    persistWizardStatus,
    getCurrentStatusForMode,
    onGeneratedPending,
    refreshStatusAfterGenerate,
  } = params;

  safeSetLastError(null);
  safeSetLastDebug(null);

  try {
    const apiMode = normalizeModeForApi(mode);
    const r = await invokeEdgeJson(
      supabaseUrl,
      SUPABASE_EDGE_FUNCTIONS.ANDROID_KEYSTORE_GENERATE,
      adminKey,
      userJwt,
      { repo: repoFullName, mode: apiMode },
    );

    safeSetLastDebug(r.debug);
    if (!r.ok) {
      safeSetLastError(r.error);
      if (isMounted()) {
        const nextStatus = toWizardErrorStatus({
          previous: getCurrentStatusForMode(mode),
          statusCode: r.debug.status ?? null,
          error: r.error,
          detail: describeLocalEdgeAdminKeyIssue({
            adminKey,
            statusCode: r.debug.status ?? null,
            error: r.error,
            surface: "keystore",
          }),
        });
        setStatusByMode((prev) => ({ ...prev, [mode]: nextStatus }));
        await persistWizardStatus(mode, nextStatus);
      }
      return;
    }

    const data = r.data as { ok?: boolean; error?: string } | null;
    if (data?.ok === false) {
      safeSetLastError(data.error ?? "Generate fehlgeschlagen");
      return;
    }

    if (isMounted()) {
      const nextStatus = toGeneratedPendingStatus(getCurrentStatusForMode(mode));
      setStatusByMode((prev) => ({ ...prev, [mode]: nextStatus }));
      await persistWizardStatus(mode, nextStatus);
    }

    onGeneratedPending();
    await refreshStatusAfterGenerate();
  } catch (error: unknown) {
    safeSetLastError(error);
    if (isMounted()) {
      const previous = getCurrentStatusForMode(mode);
      const nextStatus =
        previous?.credentialState === "generated_pending_verification"
          ? toGeneratedPendingStatusWithReason(
              previous,
              "Statuscheck konnte den neuen Keystore noch nicht bestaetigen.",
            )
          : toWizardErrorStatus({
              previous,
              error,
              detail: describeLocalEdgeAdminKeyIssue({ adminKey, error, surface: "keystore" }),
            });
      setStatusByMode((prev) => ({ ...prev, [mode]: nextStatus }));
      await persistWizardStatus(mode, nextStatus);
    }
  }
}
