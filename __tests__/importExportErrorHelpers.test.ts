import {
  getImportExportErrorMessage,
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
});
