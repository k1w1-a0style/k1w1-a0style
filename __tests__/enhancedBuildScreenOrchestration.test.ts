import {
  countHiddenRuns,
  isBuildActive,
  isFinalBuildStatus,
  mapWorkflowLogsToLines,
  resolveHistoryMatchForRun,
} from "../screens/EnhancedBuildScreen/hooks/enhancedBuildScreenOrchestration";
import type { LogEntry } from "../hooks/actionsLogsTypes";
import type { WorkflowRun } from "../screens/EnhancedBuildScreen/types";

describe("enhancedBuildScreenOrchestration", () => {
  test("maps raw and structured log lines without changing semantics", () => {
    const logs: LogEntry[] = [
      { timestamp: "", level: "raw", message: "npx expo prebuild" },
      { timestamp: "2026-04-05T11:22:33.000Z", level: "info", message: "Build started" },
    ];

    const result = mapWorkflowLogsToLines(logs);

    expect(result[0]).toBe("npx expo prebuild");
    expect(result[1]).toContain("[info] Build started");
  });

  test("finds history match by exact html url and preserves run contract fields", () => {
    const run = { id: 123, html_url: "https://github.com/o/r/actions/runs/123" } as WorkflowRun;
    const result = resolveHistoryMatchForRun(run, [
      {
        id: "hist-1",
        status: "success",
        startedAt: new Date().toISOString(),
        repoName: "o/r",
        htmlUrl: "https://github.com/o/r/actions/runs/123",
        jobId: "99",
        buildProfile: "preview",
        branch: "main",
      },
    ]);

    expect(result).toEqual({
      jobId: "99",
      buildProfile: "preview",
      branch: "main",
      repoName: "o/r",
    });
  });

  test("finds history match by run-id url fallback", () => {
    const run = { id: 456, html_url: "https://github.com/o/r/actions/runs/456" } as WorkflowRun;
    const result = resolveHistoryMatchForRun(run, [
      {
        id: "hist-2",
        status: "failed",
        startedAt: new Date().toISOString(),
        jobId: "",
        repoName: "o/r",
        htmlUrl: "https://github.com/o/r/actions/runs/456/attempts/1",
      },
    ]);

    expect(result?.repoName).toBe("o/r");
    expect(result?.jobId).toBe("");
  });

  test("keeps active/final status guards exact", () => {
    expect(isBuildActive("queued", Date.now())).toBe(true);
    expect(isBuildActive("building", Date.now())).toBe(true);
    expect(isBuildActive("idle", Date.now())).toBe(false);
    expect(isBuildActive("queued", null)).toBe(false);

    expect(isFinalBuildStatus("success")).toBe(true);
    expect(isFinalBuildStatus("failed")).toBe(true);
    expect(isFinalBuildStatus("error")).toBe(true);
    expect(isFinalBuildStatus("building")).toBe(false);
  });

  test("counts hidden runs only above max display", () => {
    expect(countHiddenRuns(8, 10)).toBe(0);
    expect(countHiddenRuns(10, 10)).toBe(0);
    expect(countHiddenRuns(17, 10)).toBe(7);
  });
});
