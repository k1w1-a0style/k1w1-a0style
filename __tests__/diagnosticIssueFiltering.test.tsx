import React from "react";
import { act, render } from "@testing-library/react-native";

import type { PreflightCheckResult } from "../lib/diagnostics/preflightTypes";
import { useDiagnosticIssueFiltering } from "../screens/DiagnosticScreen/hooks/useDiagnosticIssueFiltering";

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
  { id: "pass", title: "Pass", status: "pass" } as any,
  { id: "fail", title: "Fail", status: "fail" } as any,
  { id: "warn", title: "Warn", status: "warn" } as any,
];

describe("useDiagnosticIssueFiltering", () => {
  test("defaults to non-pass results (all)", () => {
    const getApi = createHarness(() => useDiagnosticIssueFiltering(baseResults));
    expect(getApi().issuesFilter).toBe("all");
    expect(getApi().visibleResults.map((r: any) => r.id)).toEqual(["fail", "warn"]);
  });

  test("filters critical and warning correctly", () => {
    const getApi = createHarness(() => useDiagnosticIssueFiltering(baseResults));

    act(() => {
      getApi().setIssuesFilter("critical");
    });
    expect(getApi().visibleResults.map((r: any) => r.id)).toEqual(["fail"]);

    act(() => {
      getApi().setIssuesFilter("warning");
    });
    expect(getApi().visibleResults.map((r: any) => r.id)).toEqual(["warn"]);
  });
});
