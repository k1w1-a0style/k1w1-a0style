import type { PendingChange, PendingChangeValidatorState } from "./chatAIFlowTypes";

const VALIDATOR_FALLBACK_WARNING_BY_STATE: Record<
  PendingChangeValidatorState,
  string | null
> = {
  disabled: null,
  validated: null,
  "builder-fallback-empty":
    "ℹ️ Validator war nur advisory und lieferte keine gültige Dateiliste. Es werden deshalb die Builder-Dateien geprüft/angeboten.",
  "builder-fallback-error":
    "ℹ️ Validator war nur advisory und konnte die Builder-Dateien diesmal nicht nachschärfen. Es werden daher die Builder-Dateien verwendet.",
  "builder-fallback-exception":
    "ℹ️ Validator war nur advisory und ist fehlgeschlagen. Es werden daher die Builder-Dateien verwendet.",
};

export const getValidatorFallbackWarning = (
  validatorState: PendingChangeValidatorState,
): string | null => {
  return VALIDATOR_FALLBACK_WARNING_BY_STATE[validatorState] ?? null;
};

export const getSourceSummaryText = (
  finalFileSource: PendingChange["finalFileSource"],
  agentEnabled: boolean,
): string => {
  if (finalFileSource === "validator") {
    return "Finale Dateiliste stammt aus dem Validator-Review (advisory Nachschärfer auf Builder-Basis).";
  }

  if (agentEnabled) {
    return "Finale Dateiliste stammt direkt vom Builder; der Validator war nur advisory und hat diesmal nicht übernommen.";
  }

  return "Finale Dateiliste stammt direkt vom Builder; kein separater Validator aktiv.";
};
