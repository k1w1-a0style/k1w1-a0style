import React from "react";
import { act, render } from "@testing-library/react-native";

import { useDiagnosticFixRunner } from "../screens/DiagnosticScreen/hooks/useDiagnosticFixRunner";
import type { PreflightCheckResult } from "../lib/diagnostics/preflightTypes";
import { createMountedRef } from "./helpers/projectTestHelpers";
import { makePreflightPatch, makePreflightResult, makeProjectRef } from "./helpers/preflightTestHelpers";

jest.mock("../infra/github/githubService", () => ({
  createOrUpdateFile: jest.fn(async () => undefined),
  deleteRepoFile: jest.fn(async () => undefined),
  triggerWorkflow: jest.fn(async () => undefined),
}));

const { triggerWorkflow: mockTriggerWorkflow } = jest.requireMock("../infra/github/githubService") as {
  triggerWorkflow: jest.Mock;
};

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

function baseProjectRef() {
  return makeProjectRef({
    id: "p1",
    name: "demo",
    files: [{ path: "app.json", content: '{"expo":{"name":"demo"}}' }],
  });
}

function renderRunner(params?: {
  updateProjectFiles?: jest.Mock;
  deleteFile?: jest.Mock;
  rerunAfterFix?: boolean;
  linkedRepo?: string;
  linkedBranch?: string;
  toast?: { show: jest.Mock };
}) {
  const updateProjectFiles = params?.updateProjectFiles ?? jest.fn(async () => undefined);
  const deleteFile = params?.deleteFile ?? jest.fn(async () => undefined);
  const toast = params?.toast ?? { show: jest.fn() };
  const projectRef = baseProjectRef();

  const getApi = createHarness(() =>
    useDiagnosticFixRunner({
      projectRef,
      mountedRef: createMountedRef(),
      linkedRepo: params?.linkedRepo ?? "owner/repo",
      linkedBranch: params?.linkedBranch ?? "main",
      updateProjectFiles,
      deleteFile,
      syncFixesToGitHub: false,
      rerunAfterFix: params?.rerunAfterFix ?? false,
      autoFixIncludeWarn: false,
      autoFixScope: "all",
      sortedResults: [],
      visibleResults: [],
      fixableResults: [],
      selected: {},
      setSelected: jest.fn(),
      runDiagnostics: jest.fn(async () => undefined),
      toast,
    }),
  );

  return { getApi, updateProjectFiles, deleteFile, toast: toast.show, projectRef };
}

describe("useDiagnosticFixRunner fix semantics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("does not classify empty patches as success", async () => {
    const { getApi, updateProjectFiles, toast } = renderRunner();
    const result: PreflightCheckResult = makePreflightResult({
      id: "empty",
      title: "Empty patch",
      fix: { patch: makePreflightPatch() },
    });

    await act(async () => {
      await getApi().applyIssueFix(result);
    });

    expect(updateProjectFiles).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("Fix blockiert – nichts wurde als behoben markiert.");
    expect(getApi().fixSteps[0]?.status).toBe("failed");
  });

  test("fails without partial mutation when local commit write fails", async () => {
    const updateProjectFiles = jest.fn(async () => {
      throw new Error("Speichern fehlgeschlagen");
    });
    const deleteFile = jest.fn(async () => undefined);
    const { getApi, toast } = renderRunner({ updateProjectFiles, deleteFile });
    const result: PreflightCheckResult = makePreflightResult({
      id: "partial",
      title: "Partial patch",
      fix: {
        patch: makePreflightPatch({
          delete: ["app.json"],
          upsert: [{ path: "app.json", content: '{"expo":{"name":"changed"}}' }],
        }),
      },
    });

    await act(async () => {
      await getApi().applyIssueFix(result);
    });

    expect(deleteFile).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("Fix fehlgeschlagen.");
    expect(getApi().fixSteps[0]?.message).toContain("Speichern fehlgeschlagen");
  });

  test("handles unknown thrown objects fail-safe in fix error messaging", async () => {
    const updateProjectFiles = jest.fn(async () => {
      throw { localChangeApplied: true, partial: true };
    });
    const { getApi, toast } = renderRunner({ updateProjectFiles });
    const result: PreflightCheckResult = makePreflightResult({
      id: "unknown-error",
      title: "Unknown error patch",
      fix: {
        patch: makePreflightPatch({
          upsert: [{ path: "app.json", content: '{"expo":{"name":"changed"}}' }],
        }),
      },
    });

    await act(async () => {
      await getApi().applyIssueFix(result);
    });

    expect(toast).toHaveBeenCalledWith("Fix fehlgeschlagen.");
    expect(getApi().fixSteps[0]?.message).toContain("Patch konnte nicht angewendet werden.");
  });

  test("shows workflow-only fixes as started and recheck-needed, not locally fixed", async () => {
    const { getApi, updateProjectFiles, toast } = renderRunner();
    const result: PreflightCheckResult = makePreflightResult({
      id: "workflow",
      title: "Workflow only",
      fix: { workflowDispatch: { workflowFileName: "eas-link.yml" } },
    });

    await act(async () => {
      await getApi().applyIssueFix(result);
    });

    expect(mockTriggerWorkflow).toHaveBeenCalledWith("owner", "repo", "eas-link.yml", "main", {});
    expect(updateProjectFiles).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("Fix angestoßen – Re-Check noch nötig.");
  });

  test("marks workflow step failed when workflow fix is blocked by missing linked repo", async () => {
    const { getApi, toast } = renderRunner({ linkedRepo: "" });
    const result: PreflightCheckResult = makePreflightResult({
      id: "workflow-missing-repo",
      title: "Workflow missing repo",
      fix: { workflowDispatch: { workflowFileName: "eas-link.yml" } },
    });

    await act(async () => {
      await getApi().applyIssueFix(result);
    });

    expect(mockTriggerWorkflow).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("Fix blockiert – nichts wurde als behoben markiert.");
    expect(getApi().fixSteps[0]?.status).toBe("failed");
    expect(getApi().fixSteps[0]?.message).toContain("ohne verknüpftes Repo");
  });


  test("marks workflow step failed when workflow fix is blocked by missing linked branch", async () => {
    const { getApi, toast } = renderRunner({ linkedBranch: "" });
    const result: PreflightCheckResult = makePreflightResult({
      id: "workflow-missing-branch",
      title: "Workflow missing branch",
      fix: { workflowDispatch: { workflowFileName: "eas-link.yml" } },
    });

    await act(async () => {
      await getApi().applyIssueFix(result);
    });

    expect(mockTriggerWorkflow).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("Fix blockiert – nichts wurde als behoben markiert.");
    expect(getApi().fixSteps[0]?.status).toBe("failed");
    expect(getApi().fixSteps[0]?.message).toContain("ohne verknüpften Branch");
  });

  test("keeps real local patch success semantics for applied fixes", async () => {
    const { getApi, updateProjectFiles, toast, projectRef } = renderRunner();
    const result: PreflightCheckResult = makePreflightResult({
      id: "local-success",
      title: "Local patch",
      fix: {
        patch: makePreflightPatch({
          upsert: [{ path: "app.json", content: '{"expo":{"name":"patched"}}' }],
        }),
      },
    });

    await act(async () => {
      await getApi().applyIssueFix(result);
    });

    expect(updateProjectFiles).toHaveBeenCalledTimes(1);
    expect(projectRef.current?.files[0]?.content).toContain("patched");
    expect(toast).toHaveBeenCalledWith("Patch lokal angewendet.");
  });
});
