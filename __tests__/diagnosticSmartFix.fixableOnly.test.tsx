import React from "react";
import { act, render } from "@testing-library/react-native";

import { useDiagnosticFixRunner } from "../screens/DiagnosticScreen/hooks/useDiagnosticFixRunner";
import type { PreflightCheckResult } from "../lib/diagnostics/preflightTypes";
import { createMountedRef } from "./helpers/projectTestHelpers";
import { makePreflightPatch, makePreflightResult, makeProjectRef } from "./helpers/preflightTestHelpers";

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

describe("useDiagnosticFixRunner smartFix", () => {
  test("applies only fixable fail issues", async () => {
    const updateProjectFiles = jest.fn(async () => undefined);
    const projectRef = makeProjectRef({
      id: "p1",
      name: "demo",
      files: [{ path: "app.json", content: "{}" }],
    });

    const fixableResults: PreflightCheckResult[] = [
      makePreflightResult({
        id: "fixable",
        title: "Fixable",
        fix: { patch: makePreflightPatch({ upsert: [{ path: "app.json", content: '{"expo":{}}' }] }), label: "fix" },
      }),
      makePreflightResult({
        id: "not-fixable",
        title: "Not fixable",
        fix: undefined,
      }),
    ];

    const getApi = createHarness(() =>
      useDiagnosticFixRunner({
        projectRef,
        mountedRef: createMountedRef(),
        linkedRepo: "",
        linkedBranch: "main",
        updateProjectFiles,
        deleteFile: jest.fn(async () => undefined),
        syncFixesToGitHub: false,
        rerunAfterFix: false,
        autoFixIncludeWarn: false,
        autoFixScope: "all",
        sortedResults: fixableResults,
        visibleResults: fixableResults,
        fixableResults,
        selected: {},
        setSelected: jest.fn(),
        runDiagnostics: jest.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await getApi().smartFix();
    });

    expect(updateProjectFiles).toHaveBeenCalledTimes(1);
  });


  test("does not auto-apply warn-only fixes in smartFix", async () => {
    const updateProjectFiles = jest.fn(async () => undefined);
    const projectRef = makeProjectRef({
      id: "p1",
      name: "demo",
      files: [{ path: "app.json", content: "{}" }],
    });

    const warnOnly: PreflightCheckResult[] = [
      makePreflightResult({
        id: "warn-fixable",
        title: "Warn fixable",
        status: "warn",
        fix: { patch: makePreflightPatch({ upsert: [{ path: "app.json", content: '{"expo":{}}' }] }), label: "fix" },
      }),
    ];

    const alertSpy = jest.spyOn(require("react-native").Alert, "alert").mockImplementation(() => {});

    const getApi = createHarness(() =>
      useDiagnosticFixRunner({
        projectRef,
        mountedRef: createMountedRef(),
        linkedRepo: "",
        linkedBranch: "main",
        updateProjectFiles,
        deleteFile: jest.fn(async () => undefined),
        syncFixesToGitHub: false,
        rerunAfterFix: false,
        autoFixIncludeWarn: true,
        autoFixScope: "all",
        sortedResults: warnOnly,
        visibleResults: warnOnly,
        fixableResults: warnOnly,
        selected: {},
        setSelected: jest.fn(),
        runDiagnostics: jest.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await getApi().smartFix();
    });

    expect(updateProjectFiles).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

});
