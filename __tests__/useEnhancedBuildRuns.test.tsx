import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useEnhancedBuildRuns } from "../screens/EnhancedBuildScreen/hooks/useEnhancedBuildRuns";
import type { WorkflowRun } from "../screens/EnhancedBuildScreen/types";

describe("useEnhancedBuildRuns", () => {
  const isMountedRef = { current: true };

  beforeEach(() => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("blocks fetchRuns on invalid repo and shows guard alert", async () => {
    const getWorkflowRuns = jest.fn();
    const { result } = renderHook(() =>
      useEnhancedBuildRuns({
        canFetch: false,
        owner: "",
        repo: "",
        repoValidationError: 'Format muss "owner/repo" sein (genau ein /).',
        getWorkflowRuns,
        isMountedRef,
        openRun: async () => {},
        history: [],
      }),
    );

    await act(async () => {
      await result.current.fetchRuns();
    });

    expect(getWorkflowRuns).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Ungültiges Repo",
      expect.stringContaining("owner/repo"),
    );
  });

  test("falls back to openRun when opening run details without fetch context", async () => {
    const openRun = jest.fn(async () => {});
    const { result } = renderHook(() =>
      useEnhancedBuildRuns({
        canFetch: false,
        owner: "owner",
        repo: "repo",
        repoValidationError: "",
        getWorkflowRuns: jest.fn(),
        isMountedRef,
        openRun,
        history: [],
      }),
    );

    await act(async () => {
      await result.current.openRunDetails({
        id: 123,
        html_url: "https://github.com/o/r/actions/runs/123",
      } as WorkflowRun);
    });

    expect(openRun).toHaveBeenCalledWith("https://github.com/o/r/actions/runs/123");
  });
});
