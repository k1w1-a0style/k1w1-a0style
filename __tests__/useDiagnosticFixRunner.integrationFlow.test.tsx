import React from "react";
import { act, render } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useDiagnosticFixRunner } from "../screens/DiagnosticScreen/hooks/useDiagnosticFixRunner";
import { createMountedRef } from "./helpers/projectTestHelpers";
import { makePreflightPatch, makePreflightResult, makeProjectRef } from "./helpers/preflightTestHelpers";

jest.mock("../infra/github/githubService", () => ({
  createOrUpdateFile: jest.fn(async () => undefined),
  deleteRepoFile: jest.fn(async () => undefined),
  triggerWorkflow: jest.fn(async () => undefined),
}));

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

function renderRunner(params?: {
  updateProjectFiles?: jest.Mock;
  runDiagnostics?: jest.Mock;
  rerunAfterFix?: boolean;
  fixableResults?: ReturnType<typeof makePreflightResult>[];
  visibleResults?: ReturnType<typeof makePreflightResult>[];
  sortedResults?: ReturnType<typeof makePreflightResult>[];
  selected?: Record<string, boolean>;
}) {
  const updateProjectFiles = params?.updateProjectFiles ?? jest.fn(async () => undefined);
  const runDiagnostics = params?.runDiagnostics ?? jest.fn(async () => undefined);
  const toast = { show: jest.fn() };
  const projectRef = makeProjectRef({
    id: "p1",
    name: "demo",
    files: [{ path: "app.json", content: "{\"expo\":{\"name\":\"demo\"}}" }],
  });

  const getApi = createHarness(() =>
    useDiagnosticFixRunner({
      projectRef,
      mountedRef: createMountedRef(),
      linkedRepo: "owner/repo",
      linkedBranch: "main",
      updateProjectFiles,
      deleteFile: jest.fn(async () => undefined),
      syncFixesToGitHub: false,
      rerunAfterFix: params?.rerunAfterFix ?? false,
      autoFixIncludeWarn: false,
      autoFixScope: "all",
      sortedResults: params?.sortedResults ?? [],
      visibleResults: params?.visibleResults ?? [],
      fixableResults: params?.fixableResults ?? [],
      selected: params?.selected ?? {},
      setSelected: jest.fn(),
      runDiagnostics,
      toast,
    }),
  );

  return { getApi, updateProjectFiles, runDiagnostics, toast: toast.show };
}

describe("useDiagnosticFixRunner integration flows", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("applyFixList dedupes identical patches before apply", async () => {
    const { getApi, updateProjectFiles } = renderRunner();
    const patch = makePreflightPatch({
      upsert: [{ path: "app.json", content: "{\"expo\":{\"name\":\"demo-2\"}}" }],
    });
    const a = makePreflightResult({ id: "a", title: "A", fix: { patch } });
    const b = makePreflightResult({ id: "b", title: "B", fix: { patch } });

    await act(async () => {
      await getApi().applyFixList([a, b], "Batch");
    });

    expect(updateProjectFiles).toHaveBeenCalledTimes(1);
  });

  test("applyFixList surfaces pending_recheck when rerun fails", async () => {
    const runDiagnostics = jest.fn(async () => {
      throw new Error("verify kaputt");
    });
    const { getApi, toast } = renderRunner({ rerunAfterFix: true, runDiagnostics });
    const patch = makePreflightPatch({
      upsert: [{ path: "app.json", content: "{\"expo\":{\"name\":\"demo-3\"}}" }],
    });
    const a = makePreflightResult({ id: "a", title: "A", fix: { patch } });

    await act(async () => {
      await getApi().applyFixList([a], "Batch");
    });

    expect(runDiagnostics).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith("Patch angewendet – Re-Check noch nötig.");
  });

  test("autoFix cancel does not apply patch", async () => {
    jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      buttons?.[0]?.onPress?.();
    });
    const fixable = makePreflightResult({
      id: "f1",
      status: "fail",
      fix: { patch: makePreflightPatch({ upsert: [{ path: "app.json", content: "{\"expo\":{\"name\":\"x\"}}" }] }) },
    });
    const { getApi, updateProjectFiles } = renderRunner({ fixableResults: [fixable] });

    await act(async () => {
      await getApi().autoFix();
    });

    expect(updateProjectFiles).not.toHaveBeenCalled();
  });

  test("autoFix confirm applies patch", async () => {
    jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      buttons?.[1]?.onPress?.();
    });
    const fixable = makePreflightResult({
      id: "f2",
      status: "fail",
      fix: { patch: makePreflightPatch({ upsert: [{ path: "app.json", content: "{\"expo\":{\"name\":\"y\"}}" }] }) },
    });
    const { getApi, updateProjectFiles } = renderRunner({ fixableResults: [fixable] });

    await act(async () => {
      await getApi().autoFix();
    });

    expect(updateProjectFiles).toHaveBeenCalledTimes(1);
  });
});
