import {
  filterBuildHistoryByMode,
  summarizeBuildHistoryStats,
} from "../screens/EnhancedBuildScreen/hooks/enhancedBuildScreenHistory";

describe("enhancedBuildScreenHistory", () => {
  const history = [
    {
      id: "1",
      jobId: "1",
      repoName: "o/r",
      status: "success" as const,
      startedAt: "2026-04-05T00:00:00.000Z",
      buildProfile: "preview",
    },
    {
      id: "2",
      jobId: "2",
      repoName: "o/r",
      status: "failed" as const,
      startedAt: "2026-04-05T01:00:00.000Z",
      buildProfile: "production",
    },
    {
      id: "3",
      jobId: "3",
      repoName: "o/r",
      status: "starting" as const,
      startedAt: "2026-04-05T02:00:00.000Z",
      buildProfile: "preview",
    },
  ];

  test("filters history by selected profile", () => {
    const filtered = filterBuildHistoryByMode(history, "preview");
    expect(filtered).toHaveLength(2);
    expect(filtered.every((entry) => entry.buildProfile === "preview")).toBe(true);
  });

  test("returns full history when filter is all", () => {
    const filtered = filterBuildHistoryByMode(history, "all");
    expect(filtered).toHaveLength(3);
  });

  test("summarizes success/failed/building counters", () => {
    const stats = summarizeBuildHistoryStats(history);
    expect(stats).toEqual({ total: 3, success: 1, failed: 1, building: 1 });
  });
});
