import { act, renderHook } from "@testing-library/react-native";
import { useCiLiteDispatch } from "../components/CiLiteHeaderButton/hooks/useCiLiteDispatch";

const mockMultiSet = jest.fn();
const mockBuildPersist = jest.fn(() => [["k", "v"]]);
const mockFetchWithTimeout = jest.fn();
const mockGetRepoSyncState = jest.fn(async () => "in_sync");
const mockGetBranchHeadSha = jest.fn(async () => "a".repeat(40));
const mockRequireEdgeUrl = jest.fn(async () => "https://edge.local");

jest.mock("@react-native-async-storage/async-storage", () => ({
  multiSet: (...args: unknown[]) => mockMultiSet(...(args as [Array<[string, string]>])),
}));
jest.mock("../lib/ciLitePersistence", () => ({
  CI_LITE_WORKFLOW_ID: "k1w1-ci-lite.yml",
  buildPersistCiLiteEntries: (arg: unknown) => (mockBuildPersist as any)(arg),
}));
jest.mock("../lib/network/fetchWithTimeout", () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}));
jest.mock("../lib/repoSyncOrchestration", () => ({
  getRepoSyncState: (arg: unknown) => (mockGetRepoSyncState as any)(arg),
}));
jest.mock("../infra/github/githubService", () => ({
  getBranchHeadSha: (a: unknown, b: unknown, c: unknown) => (mockGetBranchHeadSha as any)(a, b, c),
}));
jest.mock("../lib/supabaseEdge", () => ({
  requireSupabaseEdgeUrl: () => mockRequireEdgeUrl(),
}));

describe("useCiLiteDispatch queued persistence workflow gating", () => {
  const baseParams = () => ({
    dispatching: false,
    githubRepo: "owner/repo",
    branch: "main",
    projectFiles: [],
    resolveOperatorAccess: async () => ({ authMode: "jwt" as const, adminKey: null, userJwt: "jwt" }),
    startLookupTracking: jest.fn(async () => undefined),
    stopLookupWithError: jest.fn(),
    stopRunLookup: jest.fn(),
    updateLookupDiagnosis: jest.fn(),
    setLocalError: jest.fn(),
    setVisible: jest.fn(),
    setDispatching: jest.fn(),
    setRunId: jest.fn(),
    setRunUrl: jest.fn(),
    setWorkflowId: jest.fn(),
    setChainWaiting: jest.fn(),
    setJobId: jest.fn(),
    setTargetRef: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchWithTimeout.mockResolvedValue({ ok: true, status: 200, statusText: "OK", text: async () => "" });
    mockMultiSet.mockResolvedValue(undefined);
  });

  it("writes queued persistence only for k1w1-ci-lite.yml and starts lookup", async () => {
    const params = baseParams();
    const { result } = renderHook(() => useCiLiteDispatch(params));
    await act(async () => {
      await result.current("k1w1-ci-lite.yml");
    });
    expect(mockBuildPersist).toHaveBeenCalledTimes(1);
    expect(mockMultiSet).toHaveBeenCalledTimes(1);
    expect(params.startLookupTracking).toHaveBeenCalledTimes(1);
  });

  it("skips CI-Lite readiness persistence for autofix but still starts lookup", async () => {
    const params = baseParams();
    const { result } = renderHook(() => useCiLiteDispatch(params));
    await act(async () => {
      await result.current("k1w1-ci-lite-autofix.yml");
    });
    expect(mockBuildPersist).not.toHaveBeenCalled();
    expect(mockMultiSet).not.toHaveBeenCalled();
    expect(params.startLookupTracking).toHaveBeenCalledTimes(1);
  });
});
