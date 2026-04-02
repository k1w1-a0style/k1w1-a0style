import React from "react";
import { act, render } from "@testing-library/react-native";

import type { PreflightCheckResult } from "../lib/diagnostics/preflightTypes";
import { useDiagnosticIssueFiltering } from "../screens/DiagnosticScreen/hooks/useDiagnosticIssueFiltering";
import { pluckIds } from "./helpers/diagnosticTestHelpers";

function createHarness<T>(useHook: () => T) {
  let api: T | null = null;
  function Harness() {
    api = useHook();
    return null;
  }
  render(<Harness />);
  if (!api) throw new Error("Harness did not initialize");
  return () => api as T;
}

const baseResults: PreflightCheckResult[] = [
  { id: "pass", title: "Pass", status: "pass", severity: "normal" },
  { id: "fail", title: "Fail", status: "fail", severity: "critical" },
  { id: "warn", title: "Warn", status: "warn", severity: "high" },
];

describe("useDiagnosticIssueFiltering", () => {
  test("defaults to non-pass results (all)", () => {
    const getApi = createHarness(() => useDiagnosticIssueFiltering(baseResults));
    expect(getApi().issuesFilter).toBe("all");
    expect(pluckIds(getApi().visibleResults)).toEqual(["fail", "warn"]);
  });

  test("filters critical and warning correctly", () => {
    const getApi = createHarness(() => useDiagnosticIssueFiltering(baseResults));

    act(() => {
      getApi().setIssuesFilter("critical");
    });
    expect(pluckIds(getApi().visibleResults)).toEqual(["fail"]);

    act(() => {
      getApi().setIssuesFilter("warning");
    });
    expect(pluckIds(getApi().visibleResults)).toEqual(["warn"]);
  });
});
