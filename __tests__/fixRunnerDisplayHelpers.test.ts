import {
  formatBatchFixResultDetail,
  formatBatchFixSubtitle,
  formatIssueFixResultDetail,
  formatSingleFixResultDetail,
} from "../screens/DiagnosticScreen/hooks/fixRunnerDisplayHelpers";

describe("fixRunnerDisplayHelpers", () => {
  describe("formatBatchFixSubtitle", () => {
    it("shows count without duplicate suffix by default", () => {
      expect(formatBatchFixSubtitle(3)).toBe("3 Fixes");
    });

    it("appends duplicate suffix when skipped items exist", () => {
      expect(formatBatchFixSubtitle(4, 2)).toBe("4 Fixes (skipped 2 dup)");
    });
  });

  describe("formatIssueFixResultDetail", () => {
    it("prefers workflow recheck text when only workflow dispatch happened", () => {
      expect(
        formatIssueFixResultDetail({ hasDispatch: true, patchApplied: false, rerunAfterFix: false }),
      ).toBe("Workflow wurde gestartet; der tatsächliche Erfolg muss per Re-Check bestätigt werden.");
    });

    it("uses diagnostics recheck text when rerun is enabled", () => {
      expect(
        formatIssueFixResultDetail({ hasDispatch: false, patchApplied: true, rerunAfterFix: true }),
      ).toBe("Fix-Lauf abgeschlossen; prüfe den neuen Diagnostics-Report.");
    });

    it("returns undefined when no follow-up notice is needed", () => {
      expect(
        formatIssueFixResultDetail({ hasDispatch: false, patchApplied: true, rerunAfterFix: false }),
      ).toBeUndefined();
    });
  });

  it("formats single-fix rerun detail", () => {
    expect(formatSingleFixResultDetail(true)).toBe(
      "Patch angewendet; prüfe den neuen Diagnostics-Report.",
    );
    expect(formatSingleFixResultDetail(false)).toBeUndefined();
  });

  it("formats batch-fix rerun detail", () => {
    expect(formatBatchFixResultDetail(true)).toBe(
      "Batch-Fix abgeschlossen; prüfe den neuen Diagnostics-Report.",
    );
    expect(formatBatchFixResultDetail(false)).toBeUndefined();
  });
});
