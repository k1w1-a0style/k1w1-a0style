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
});
