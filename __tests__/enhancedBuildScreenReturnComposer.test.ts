import { composeEnhancedBuildScreenReturn } from "../screens/EnhancedBuildScreen/hooks/enhancedBuildScreenReturnComposer";
import type { WorkflowRun } from "../screens/EnhancedBuildScreen/types";

describe("enhancedBuildScreenReturnComposer", () => {
  test("returns null runMatch when no selected run exists", () => {
    const result = composeEnhancedBuildScreenReturn({
      selectedRun: null,
      findHistoryMatchForRun: () => ({
        jobId: "1",
        buildProfile: "preview",
        branch: "main",
        repoName: "o/r",
      }),
      status: "idle",
    });

    expect(result.runMatch).toBeNull();
    expect(result.status).toBe("idle");
  });

  test("resolves runMatch for selected run", () => {
    const selectedRun = { id: 123, html_url: "https://github.com/o/r/actions/runs/123" } as WorkflowRun;
    const result = composeEnhancedBuildScreenReturn({
      selectedRun,
      findHistoryMatchForRun: (run) => ({
        jobId: String(run.id),
        buildProfile: "preview",
        branch: "main",
        repoName: "o/r",
      }),
      status: "building",
    });

    expect(result.runMatch).toEqual({
      jobId: "123",
      buildProfile: "preview",
      branch: "main",
      repoName: "o/r",
    });
  });
});
