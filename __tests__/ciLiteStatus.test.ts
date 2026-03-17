import { computeCiLiteOk, findWorkflowRunByJobId, inferStepStates } from "../components/ciLite/ciLiteUtils";

describe("computeCiLiteOk", () => {
  it("is false when not done", () => {
    expect(
      computeCiLiteOk({
        done: false,
        workflowRun: null,
        onlyErrorsCount: 0,
        hasErrorText: false,
      }),
    ).toBe(false);
  });

  it("trusts GitHub completed conclusion", () => {
    expect(
      computeCiLiteOk({
        done: true,
        workflowRun: { status: "completed", conclusion: "failure" },
        onlyErrorsCount: 0,
        hasErrorText: false,
      }),
    ).toBe(false);

    expect(
      computeCiLiteOk({
        done: true,
        workflowRun: { status: "completed", conclusion: "success" },
        onlyErrorsCount: 999,
        hasErrorText: true,
      }),
    ).toBe(true);
  });

  it("falls back to parsed output when no run metadata", () => {
    expect(
      computeCiLiteOk({
        done: true,
        workflowRun: null,
        onlyErrorsCount: 0,
        hasErrorText: false,
      }),
    ).toBe(true);

    expect(
      computeCiLiteOk({
        done: true,
        workflowRun: null,
        onlyErrorsCount: 1,
        hasErrorText: false,
      }),
    ).toBe(false);
  });
});


describe("findWorkflowRunByJobId", () => {
  it("prefers exact job-id markers over loose substring matches", () => {
    const runs = [
      { id: 1, display_title: "CI Lite [abc]" },
      { id: 2, display_title: "CI Lite [abc-123]" },
    ];

    expect(findWorkflowRunByJobId(runs, "abc-123")).toEqual(runs[1]);
  });

  it("falls back to generic includes matching when exact markers are absent", () => {
    const runs = [
      { id: 7, name: "CI Lite run abc-123" },
    ];

    expect(findWorkflowRunByJobId(runs, "abc-123")).toEqual(runs[0]);
  });

  it("returns null when run list or job-id is invalid", () => {
    expect(findWorkflowRunByJobId([], "")).toBeNull();
    expect(findWorkflowRunByJobId(null as any, "abc")).toBeNull();
  });
});

describe("inferStepStates", () => {
  it("prefers deterministic LINT_EXIT/TSC_EXIT markers when available", () => {
    const steps = inferStepStates([
      "npm run lint:ci",
      "LINT_EXIT=1",
      "npm run typecheck",
      "TSC_EXIT=0",
    ]);

    expect(steps.lint).toBe("failure");
    expect(steps.typecheck).toBe("success");
  });


  it("treats exit markers as authoritative even without explicit command start lines", () => {
    const steps = inferStepStates([
      "metadata.env",
      "LINT_EXIT=0",
      "TSC_EXIT=1",
    ]);

    expect(steps.lint).toBe("success");
    expect(steps.typecheck).toBe("failure");
  });
});

