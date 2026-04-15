import { act, renderHook } from "@testing-library/react-native";

import { useProjectBuildController } from "../contexts/projectContext/useProjectBuildController";

const mockStartBuildJob: jest.Mock = jest.fn();
const mockAddBuildToHistory: jest.Mock = jest.fn(async () => undefined);
const mockUpdateBuildInHistory: jest.Mock = jest.fn(async () => undefined);

jest.mock("../project/services/buildStartService", () => ({
  startBuildJob: (...args: any[]) => mockStartBuildJob(...args),
}));

jest.mock("../hooks/useBuildStatus", () => ({
  useBuildStatus: () => ({
    status: "queued",
    details: null,
    lastError: null,
  }),
}));

jest.mock("../lib/buildHistoryStorage", () => ({
  addBuildToHistory: (payload: any) => mockAddBuildToHistory(payload),
  updateBuildInHistory: (jobId: any, payload: any) => mockUpdateBuildInHistory(jobId, payload),
}));

describe("useProjectBuildController startBuild reentry guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks a second start attempt while first start is in honest pre-start phase", async () => {
    const resolveStartRef: {
      current: ((value: { jobId: string; githubRepo: string; branch: string }) => void) | null;
    } = { current: null };
    mockStartBuildJob.mockImplementation(
      () =>
        new Promise<{ jobId: string; githubRepo: string; branch: string }>((resolve) => {
          resolveStartRef.current = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useProjectBuildController({
        projectData: {
          id: "p1",
          name: "Demo",
          files: [{ path: "App.tsx", content: "export default 1;" }],
          chatHistory: [],
          createdAt: "2026-04-06T00:00:00.000Z",
          linkedRepo: "owner/repo",
          linkedBranch: "main",
          preferredBuildProfile: "preview",
          lastModified: "2026-04-06T00:00:00.000Z",
        },
      }),
    );

    let firstPromise: Promise<void>;
    await act(async () => {
      firstPromise = result.current.startBuild("preview");
      await Promise.resolve();
    });

    await expect(result.current.startBuild("preview")).rejects.toThrow(
      "Build-Start bereits in Vorbereitung. Bitte kurz warten.",
    );
    expect(mockStartBuildJob).toHaveBeenCalledTimes(1);
    expect(result.current.currentBuild?.status).toBe("starting");

    expect(resolveStartRef.current).toBeTruthy();
    if (resolveStartRef.current) {
      resolveStartRef.current({ jobId: "job-1", githubRepo: "owner/repo", branch: "main" });
    }
    await act(async () => {
      await firstPromise!;
    });
    expect(mockAddBuildToHistory).toHaveBeenCalledTimes(1);
  });
});
