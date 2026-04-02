import { getDiagnosticUiErrorMessage } from "../screens/DiagnosticScreen/hooks/diagnosticErrorHelpers";

describe("diagnosticErrorHelpers", () => {
  it("reads Error messages", () => {
    expect(getDiagnosticUiErrorMessage(new Error("kaputt"))).toBe("kaputt");
  });

  it("falls back for unknown values", () => {
    expect(getDiagnosticUiErrorMessage({})).toBe("Unbekannter Fehler");
  });

  it("uses explicit fallback", () => {
    expect(getDiagnosticUiErrorMessage(null, "Fallback")).toBe("Fallback");
  });
});
