export const shouldAbortOnScreenBlur = ({
  inFlight,
  hasAbortController,
  queuedAutoFixCount,
}: {
  inFlight: boolean;
  hasAbortController: boolean;
  queuedAutoFixCount: number;
}): boolean => {
  return inFlight || hasAbortController || queuedAutoFixCount > 0;
};

export const hasPreservedPendingState = ({
  hasPendingPlan,
  hasPendingChange,
}: {
  hasPendingPlan: boolean;
  hasPendingChange: boolean;
}): boolean => {
  return hasPendingPlan || hasPendingChange;
};

export const getScreenBlurAbortNotice = (
  preservedPendingState: boolean,
): string => {
  return preservedPendingState
    ? "ℹ️ Laufender KI-Vorgang wurde beim Verlassen des Chat-Screens abgebrochen. Vorliegende Plan-/Änderungsstände bleiben erhalten."
    : "ℹ️ Laufender KI-Vorgang wurde beim Verlassen des Chat-Screens abgebrochen.";
};
