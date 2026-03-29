import {
  filterWorkflowRunsByProfile,
  getWorkflowRunsEmptyStateText,
} from "../screens/EnhancedBuildScreen/hooks/runFilterState";
import type { WorkflowRun } from "../screens/EnhancedBuildScreen/types";

function mkRun(overrides: Partial<WorkflowRun>): WorkflowRun {
  return {
    id: Number(overrides.id ?? 1),
    name: String(overrides.name ?? "Build"),
    status: overrides.status ?? "completed",
    conclusion: overrides.conclusion ?? "success",
    html_url: String(overrides.html_url ?? "https://example.invalid/run/1"),
    run_number: Number(overrides.run_number ?? 1),
    created_at: String(overrides.created_at ?? "2026-03-29T00:00:00.000Z"),
    updated_at: String(overrides.updated_at ?? "2026-03-29T00:01:00.000Z"),
    ...overrides,
  };
}

describe("runFilterState", () => {
  it("returns an empty list when profile filter is active but no runs match", () => {
    const runs: WorkflowRun[] = [
      mkRun({ id: 1, name: "k1w1-triggered-build", display_title: "Build preview release" }),
      mkRun({ id: 2, name: "k1w1-triggered-build", display_title: "Build preview retry" }),
    ];

    const filtered = filterWorkflowRunsByProfile(runs, "production");

    expect(filtered).toEqual([]);
  });

  it("keeps unfiltered full list when actionsFilter is all", () => {
    const runs: WorkflowRun[] = [
      mkRun({ id: 1, display_title: "Build preview release" }),
      mkRun({ id: 2, display_title: "Build production release" }),
    ];

    const filtered = filterWorkflowRunsByProfile(runs, "all");

    expect(filtered).toHaveLength(2);
  });

  it("returns honest empty-state text only for active filter with zero matches", () => {
    expect(
      getWorkflowRunsEmptyStateText({
        actionsFilter: "preview",
        filteredRunsCount: 0,
        allRunsCount: 3,
      }),
    ).toBe("Keine Builds für dieses Profil gefunden (Filter: preview).");

    expect(
      getWorkflowRunsEmptyStateText({
        actionsFilter: "all",
        filteredRunsCount: 0,
        allRunsCount: 3,
      }),
    ).toBeNull();
  });
});
