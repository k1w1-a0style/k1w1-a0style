export const formatBatchFixSubtitle = (count: number, skipped = 0): string =>
  `${count} Fixes${skipped > 0 ? ` (skipped ${skipped} dup)` : ""}`;

export const formatIssueFixResultDetail = (params: {
  hasDispatch: boolean;
  patchApplied: boolean;
  rerunAfterFix: boolean;
}): string | undefined => {
  const { hasDispatch, patchApplied, rerunAfterFix } = params;
  if (hasDispatch && !patchApplied) {
    return "Workflow wurde gestartet; der tatsächliche Erfolg muss per Re-Check bestätigt werden.";
  }
  if (rerunAfterFix) {
    return "Fix-Lauf abgeschlossen; prüfe den neuen Diagnostics-Report.";
  }
  return undefined;
};

export const formatSingleFixResultDetail = (rerunAfterFix: boolean): string | undefined =>
  rerunAfterFix ? "Patch angewendet; prüfe den neuen Diagnostics-Report." : undefined;

export const formatBatchFixResultDetail = (rerunAfterFix: boolean): string | undefined =>
  rerunAfterFix ? "Batch-Fix abgeschlossen; prüfe den neuen Diagnostics-Report." : undefined;
