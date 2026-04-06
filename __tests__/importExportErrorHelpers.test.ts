import {
  getImportExportErrorMessage,
  isIgnorableImportExportCleanupError,
  isImportExportAborted,
} from "../screens/AppInfoScreen/hooks/importExportErrorHelpers";

describe("importExportErrorHelpers", () => {
  describe("getImportExportErrorMessage", () => {
    it("returns trimmed error message from Error", () => {
      expect(getImportExportErrorMessage(new Error("  kaputt  "), "fallback")).toBe("kaputt");
    });

    it("returns trimmed string error", () => {
      expect(getImportExportErrorMessage("  nope  ", "fallback")).toBe("nope");
    });

    it("falls back for empty or unsupported values", () => {
      expect(getImportExportErrorMessage("   ", "fallback")).toBe("fallback");
      expect(getImportExportErrorMessage({ message: " hidden " }, "fallback")).toBe("hidden");
      expect(getImportExportErrorMessage({ message: "   " }, "fallback")).toBe("fallback");
      expect(getImportExportErrorMessage({ nope: true }, "fallback")).toBe("fallback");
    });
  });

  describe("isImportExportAborted", () => {
    it("detects german aborted message", () => {
      expect(isImportExportAborted(new Error("Import abgebrochen"))).toBe(true);
    });

    it("detects common english cancel variants", () => {
      expect(isImportExportAborted(new Error("User cancelled document picker"))).toBe(true);
      expect(isImportExportAborted("Operation canceled by user")).toBe(true);
    });

    it("does not classify regular failures as aborted", () => {
      expect(isImportExportAborted(new Error("Datei defekt"))).toBe(false);
    });
  });

  describe("isIgnorableImportExportCleanupError", () => {
    it("treats abort-like cleanup failures as ignorable", () => {
      expect(isIgnorableImportExportCleanupError(new Error("Import abgebrochen"))).toBe(true);
    });

    it("treats missing-file cleanup failures as ignorable", () => {
      expect(isIgnorableImportExportCleanupError(new Error("ENOENT: no such file or directory"))).toBe(true);
      expect(isIgnorableImportExportCleanupError("File does not exist")).toBe(true);
    });

    it("keeps unexpected cleanup failures visible", () => {
      expect(isIgnorableImportExportCleanupError(new Error("permission denied"))).toBe(false);
    });
  });
});
