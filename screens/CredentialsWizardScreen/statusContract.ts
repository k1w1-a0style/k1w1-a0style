import {
  classifyVerificationError,
  normalizeVerificationContract,
  type VerificationContractState,
} from "../../lib/status/verificationContract";

import type { StatusResult, UiModeId } from "./types";

export type WizardCredentialState =
  | VerificationContractState
  | "generated_pending_verification"
  | "busy";

export type WizardStatusTone = "ok" | "error" | "warn" | "neutral";

export type WizardStatusResult = StatusResult & {
  credentialState?: Exclude<WizardCredentialState, "busy">;
  stateDetail?: string;
};

export type WizardStatusPresentation = {
  state: WizardCredentialState;
  icon: "checkmark-circle-outline" | "close-circle-outline" | "help-circle-outline" | "warning-outline" | "time-outline";
  text: string;
  colorToken: WizardStatusTone;
  detail: string;
  requiresManualRecheck: boolean;
  treatsAsMissing: boolean;
  treatsAsVerified: boolean;
};

export function toWizardStatusResult(status: StatusResult): WizardStatusResult {
  const contract = normalizeVerificationContract({
    configured: status.exists,
    verified: status.exists,
  });

  return {
    ...status,
    credentialState: contract.state,
    stateDetail: contract.state === "verified" ? "Backend hat den Keystore bestaetigt." : "Backend meldet keinen Keystore fuer diesen Modus.",
  };
}

export function toWizardErrorStatus(params: {
  previous: WizardStatusResult | StatusResult | null;
  statusCode?: number | null;
  error?: unknown;
  detail?: string;
}): WizardStatusResult {
  const state = classifyVerificationError({
    statusCode: params.statusCode,
    error: params.error,
  });

  const detail =
    params.detail?.trim() ||
    (state === "auth_error"
      ? "Status konnte wegen Auth-/Berechtigungsproblem nicht bestaetigt werden."
      : "Status ist derzeit nicht sicher verifizierbar.");

  return {
    ...(params.previous ?? { exists: false }),
    credentialState: state,
    stateDetail: detail,
  };
}

export function toGeneratedPendingStatus(
  previous: WizardStatusResult | StatusResult | null,
): WizardStatusResult {
  return {
    ...(previous ?? { exists: false }),
    credentialState: "generated_pending_verification",
    stateDetail: "Generate war erfolgreich, aber der neue Keystore ist noch nicht nachverifiziert.",
  };
}

export function toGeneratedPendingStatusWithReason(
  previous: WizardStatusResult | StatusResult | null,
  reason: string,
): WizardStatusResult {
  return {
    ...toGeneratedPendingStatus(previous),
    stateDetail: `Generate war erfolgreich, aber die Nachverifikation ist noch offen: ${reason}`,
  };
}

export function resolveWizardCredentialState(
  status: WizardStatusResult | StatusResult | null,
): Exclude<WizardCredentialState, "busy"> {
  if (status?.credentialState) return status.credentialState;

  return normalizeVerificationContract({
    configured: status?.exists,
    verified: status?.exists,
  }).state;
}

export function resolveWizardStatusPresentation(params: {
  status: WizardStatusResult | StatusResult | null;
  mode: UiModeId;
  busy: string | null;
}): WizardStatusPresentation {
  const isBusy =
    params.busy === `status:${params.mode}` ||
    params.busy === `generate:${params.mode}` ||
    params.busy === "status:all";

  if (isBusy) {
    return {
      state: "busy",
      icon: "time-outline",
      text: "laeuft",
      colorToken: "neutral",
      detail:
        params.busy === `generate:${params.mode}`
          ? "Generate/Verifikation laeuft gerade. Bitte auf Abschluss warten."
          : "Backend-Status wird gerade neu geprueft.",
      requiresManualRecheck: false,
      treatsAsMissing: false,
      treatsAsVerified: false,
    };
  }

  const state = resolveWizardCredentialState(params.status);
  const baseDetail = params.status?.stateDetail?.trim();

  if (state === "verified") {
    return {
      state,
      icon: "checkmark-circle-outline",
      text: "verifiziert",
      colorToken: "ok",
      detail: baseDetail || "Keystore ist vorhanden und wurde vom Backend bestaetigt.",
      requiresManualRecheck: false,
      treatsAsMissing: false,
      treatsAsVerified: true,
    };
  }

  if (state === "missing") {
    return {
      state,
      icon: "close-circle-outline",
      text: "fehlt",
      colorToken: "error",
      detail: baseDetail || "Backend meldet fuer diesen Modus keinen Keystore.",
      requiresManualRecheck: false,
      treatsAsMissing: true,
      treatsAsVerified: false,
    };
  }

  if (state === "auth_error") {
    const normalizedDetail = (baseDetail || "").toLowerCase();
    const authText = normalizedDetail.includes("lokaler android keystore export admin key fehlt")
      ? "lokaler Key fehlt"
      : normalizedDetail.includes("lokaler android keystore export admin key wirkt ungueltig")
        ? "lokaler Key ungueltig"
        : normalizedDetail.includes("lokaler android keystore export admin key ist lokal vorhanden")
          ? "lokaler Key abgelehnt"
          : "zugriff unklar";
    return {
      state,
      icon: "warning-outline",
      text: authText,
      colorToken: "warn",
      detail: baseDetail || "Statuscheck scheiterte an Auth oder Berechtigungen; nicht als 'fehlt' interpretieren.",
      requiresManualRecheck: true,
      treatsAsMissing: false,
      treatsAsVerified: false,
    };
  }

  if (state === "generated_pending_verification") {
    return {
      state,
      icon: "time-outline",
      text: "generiert, noch offen",
      colorToken: "warn",
      detail: baseDetail || "Generate war erfolgreich, aber eine frische Statuspruefung muss den Keystore noch bestaetigen.",
      requiresManualRecheck: true,
      treatsAsMissing: false,
      treatsAsVerified: false,
    };
  }

  return {
    state,
    icon: "help-circle-outline",
    text: state === "stale" ? "veraltet" : "unklar",
    colorToken: "neutral",
    detail:
      baseDetail ||
      (state === "stale"
        ? "Letzter Check ist nicht mehr frisch bestaetigt. Bitte erneut pruefen."
        : "Status ist derzeit nicht sicher verifizierbar. Bitte manuell neu pruefen."),
    requiresManualRecheck: true,
    treatsAsMissing: false,
    treatsAsVerified: false,
  };
}

export function formatWizardBusyLabel(busy: string): string {
  if (busy === "status:all") return "Alle Keystore-Status werden geprueft…";
  if (busy.startsWith("status:")) {
    return `Keystore-Status wird geprueft (${busy.replace("status:", "")})…`;
  }
  if (busy.startsWith("generate:")) {
    return `Keystore wird erzeugt und nachverifiziert (${busy.replace("generate:", "")})…`;
  }
  return busy;
}
