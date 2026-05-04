import { renderHook, act } from "@testing-library/react-native";

const mockEnsure = jest.fn();
jest.mock("../lib/ciLiteWorkflowBootstrap", () => ({
  ensureCiLiteWorkflowBootstrap: (...args: unknown[]) => mockEnsure(...args),
}));

jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
}));

import { useCiLiteWorkflowProvision } from "../components/CiLiteHeaderButton/hooks/useCiLiteWorkflowProvision";

describe("useCiLiteWorkflowProvision", () => {
  it("creates missing managed k1w1-ci-lite.yml in explicit repair flow", async () => {
    mockEnsure.mockResolvedValueOnce({ status: "created", workflowFile: "k1w1-ci-lite.yml" });
    const setLocalError = jest.fn();
    const { result } = renderHook(() => useCiLiteWorkflowProvision({ githubRepo: "o/r", branch: "main", setLocalError }));
    await act(async () => {
      await result.current("k1w1-ci-lite.yml");
    });
    expect(mockEnsure).toHaveBeenCalledWith({ owner: "o", repo: "r", branch: "main", workflowFile: "k1w1-ci-lite.yml" });
    expect(setLocalError).toHaveBeenCalledWith(null);
  });

  it("repairs stale managed workflow and supports autofix workflow file separately", async () => {
    mockEnsure.mockResolvedValueOnce({ status: "repaired", workflowFile: "k1w1-ci-lite-autofix.yml" });
    const { result } = renderHook(() => useCiLiteWorkflowProvision({ githubRepo: "o/r", branch: "main", setLocalError: jest.fn() }));
    await act(async () => {
      await result.current("k1w1-ci-lite-autofix.yml");
    });
    expect(mockEnsure).toHaveBeenCalledWith({ owner: "o", repo: "r", branch: "main", workflowFile: "k1w1-ci-lite-autofix.yml" });
  });

  it("returns actionable message for tokenless local auth in repair flow", async () => {
    mockEnsure.mockResolvedValueOnce({ status: "skipped_tokenless", workflowFile: "k1w1-ci-lite.yml" });
    const setLocalError = jest.fn();
    const { result } = renderHook(() => useCiLiteWorkflowProvision({ githubRepo: "o/r", branch: "main", setLocalError }));
    await act(async () => {
      await result.current("k1w1-ci-lite.yml");
    });
    expect(setLocalError.mock.calls.at(-1)?.[0]).toMatch(/GitHub verbinden/i);
  });

  it("fails unmanaged custom workflow only in explicit repair flow", async () => {
    mockEnsure.mockResolvedValueOnce({ status: "skipped_unknown_workflow", workflowFile: "custom.yml" });
    const setLocalError = jest.fn();
    const { result } = renderHook(() => useCiLiteWorkflowProvision({ githubRepo: "o/r", branch: "main", setLocalError }));
    await act(async () => {
      await result.current("custom.yml");
    });
    expect(setLocalError.mock.calls.at(-1)?.[0]).toMatch(/unmanaged/i);
  });
});
