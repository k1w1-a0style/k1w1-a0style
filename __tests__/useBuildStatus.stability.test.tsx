import { renderHook, waitFor } from "@testing-library/react-native";

import { useBuildStatus } from "../hooks/useBuildStatus";
import { pollBuildStatusOnce } from "../project/services/buildPollingService";

jest.mock("react-native", () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock("../project/services/buildPollingService", () => ({
  pollBuildStatusOnce: jest.fn(),
  isFinalStatus: (status: string) => ["success", "failed", "error"].includes(status),
}));

const pollBuildStatusOnceMock = pollBuildStatusOnce as jest.MockedFunction<typeof pollBuildStatusOnce>;

describe("useBuildStatus stability", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    pollBuildStatusOnceMock.mockReset();
    pollBuildStatusOnceMock.mockResolvedValue({
      ok: true,
      status: "building",
      raw: null,
      details: {
        jobId: "job-1",
        status: "building",
        runId: 100,
        sourceCommitSha: null,
        urls: { html: null, artifacts: null, buildUrl: null },
        raw: null,
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not re-poll immediately when status state changes", async () => {
    renderHook(() => useBuildStatus("job-1"));

    await waitFor(() => {
      expect(pollBuildStatusOnceMock).toHaveBeenCalledTimes(1);
    });

    jest.advanceTimersByTime(1000);
    expect(pollBuildStatusOnceMock).toHaveBeenCalledTimes(1);
  });

  it("does not re-poll immediately when callback object identity changes", async () => {
    const { rerender } = renderHook(
      ({ callbackVersion }: { callbackVersion: number }) =>
        useBuildStatus("job-1", {
          onError: () => callbackVersion,
        }),
      { initialProps: { callbackVersion: 1 } },
    );

    await waitFor(() => {
      expect(pollBuildStatusOnceMock).toHaveBeenCalledTimes(1);
    });

    rerender({ callbackVersion: 2 });
    jest.advanceTimersByTime(1000);
    expect(pollBuildStatusOnceMock).toHaveBeenCalledTimes(1);
  });

  it("ignores stale in-flight responses after job id switch", async () => {
    pollBuildStatusOnceMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                status: "failed",
                raw: null,
                details: {
                  jobId: "job-1",
                  status: "failed",
                  runId: 100,
                  sourceCommitSha: null,
                  urls: { html: null, artifacts: null, buildUrl: null },
                  raw: null,
                },
              });
            }, 2_000);
          }),
      )
      .mockResolvedValueOnce({
        ok: true,
        status: "success",
        raw: null,
        details: {
          jobId: "job-2",
          status: "success",
          runId: 200,
          sourceCommitSha: null,
          urls: { html: null, artifacts: null, buildUrl: null },
          raw: null,
        },
      });

    const { result, rerender } = renderHook(({ jobId }: { jobId: string }) => useBuildStatus(jobId), {
      initialProps: { jobId: "job-1" },
    });

    await waitFor(() => {
      expect(pollBuildStatusOnceMock).toHaveBeenCalledTimes(1);
    });

    rerender({ jobId: "job-2" });

    await waitFor(() => {
      expect(pollBuildStatusOnceMock).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(result.current.details?.jobId).toBe("job-2");
      expect(result.current.status).toBe("success");
    });

    jest.advanceTimersByTime(2_500);
    await Promise.resolve();

    expect(result.current.details?.jobId).toBe("job-2");
    expect(result.current.status).toBe("success");
  });

  it("resets stale poll/detail/error state immediately when job id changes", async () => {
    const { result, rerender } = renderHook(({ jobId }: { jobId: string }) => useBuildStatus(jobId), {
      initialProps: { jobId: "job-1" },
    });

    await waitFor(() => {
      expect(result.current.status).toBe("building");
      expect(result.current.details?.jobId).toBe("job-1");
    });

    rerender({ jobId: "job-2" });
    expect(result.current.status).toBe("idle");
    expect(result.current.details).toBeNull();
    expect(result.current.lastError).toBeNull();
  });

  it("terminates immediately on non-retryable poll errors", async () => {
    pollBuildStatusOnceMock.mockResolvedValueOnce({
      ok: false,
      error: "Build-Status blockiert: Lokaler Workflow-Admin-Key fehlt. Bitte Verbindungen pruefen.",
      retryable: false,
    });

    const { result } = renderHook(() => useBuildStatus("job-terminal"));

    await waitFor(() => {
      expect(result.current.status).toBe("error");
      expect(result.current.errorCount).toBe(1);
    });

    jest.advanceTimersByTime(20_000);
    expect(pollBuildStatusOnceMock).toHaveBeenCalledTimes(1);
  });
});
