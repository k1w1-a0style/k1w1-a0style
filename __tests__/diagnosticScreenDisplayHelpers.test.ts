import {
  getDiagnosticFailResults,
  getDiagnosticFailSummaryLines,
} from "../screens/DiagnosticScreen/diagnosticScreenDisplayHelpers";
import type { PreflightCheckResult } from "../lib/diagnostics/preflightTypes";

const RESULTS: PreflightCheckResult[] = [
  { id: "a", title: "A", status: "pass", severity: "low" },
  { id: "b", title: "B", status: "fail", severity: "high", message: "kaputt" },
  { id: "c", title: "C", status: "fail", severity: "normal" },
];

describe("diagnosticScreenDisplayHelpers", () => {
  it("filters fail results", () => {
    expect(getDiagnosticFailResults(RESULTS).map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("formats fail summary lines", () => {
    expect(getDiagnosticFailSummaryLines(RESULTS)).toEqual([
      "- B: kaputt",
      "- C:",
    ]);
  });
});
