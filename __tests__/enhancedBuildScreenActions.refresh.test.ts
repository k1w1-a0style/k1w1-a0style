import { refreshBuildScreenData } from "../screens/EnhancedBuildScreen/hooks/enhancedBuildScreenActions";

describe("refreshBuildScreenData", () => {
  it("refreshes history and preconditions even when runs refresh throws", async () => {
    const fetchRuns = jest.fn(async () => {
      throw new Error("runs unavailable");
    });
    const refreshHistory = jest.fn(async () => undefined);
    const refreshPreconditions = jest.fn(async () => undefined);

    await refreshBuildScreenData({
      fetchRuns,
      refreshHistory,
      refreshPreconditions,
    });

    expect(fetchRuns).toHaveBeenCalledTimes(1);
    expect(refreshHistory).toHaveBeenCalledTimes(1);
    expect(refreshPreconditions).toHaveBeenCalledTimes(1);
  });
});
