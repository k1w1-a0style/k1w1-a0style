import React from "react";
import { act, render } from "@testing-library/react-native";

import { useDiagnosticFixRunner } from "../screens/DiagnosticScreen/hooks/useDiagnosticFixRunner";
import type { ProjectData } from "../shared/types/project";
import type { PreflightCheckResult } from "../lib/diagnostics/preflightTypes";

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
    const projectRef = {
      current: {
        id: "p1",
        name: "demo",
        files: [{ path: "app.json", content: "{}" }],
      } as any as ProjectData,
    };

    const fixableResults: PreflightCheckResult[] = [
      {
        id: "fixable",
        title: "Fixable",
        status: "fail",
        fix: { patch: { upsert: [{ path: "app.json", content: '{"expo":{}}' }] } as any, label: "fix" },
      } as any,
      {
        id: "not-fixable",
        title: "Not fixable",
        status: "fail",
      } as any,
    ];

    const getApi = createHarness(() =>
      useDiagnosticFixRunner({
        projectRef: projectRef as any,
        mountedRef: { current: true } as any,
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
});
