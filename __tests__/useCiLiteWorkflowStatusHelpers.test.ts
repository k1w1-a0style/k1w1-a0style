import { deriveCiLiteHeaderState } from "../components/CiLiteHeaderButton/hooks/useCiLiteWorkflowStatusHelpers";

describe("useCiLiteWorkflowStatusHelpers", () => {
  it("returns running while dispatch/lookup/chain is active", () => {
    expect(
      deriveCiLiteHeaderState({
        dispatching: true,
        locatingRun: false,
        chainWaiting: false,
        workflowRun: null,
        hydratedDisplaySnapshot: null,
      }),
    ).toBe("running");
  });

  it("maps completed workflow conclusions to lamp states", () => {
    expect(
      deriveCiLiteHeaderState({
        dispatching: false,
        locatingRun: false,
        chainWaiting: false,
        workflowRun: { status: "completed", conclusion: "success" },
        hydratedDisplaySnapshot: null,
      }),
    ).toBe("success");

    expect(
      deriveCiLiteHeaderState({
        dispatching: false,
        locatingRun: false,
        chainWaiting: false,
        workflowRun: { status: "completed", conclusion: "failure" },
        hydratedDisplaySnapshot: null,
      }),
    ).toBe("failure");
  });

  it("falls back to hydrated snapshot and idle defaults", () => {
    expect(
      deriveCiLiteHeaderState({
        dispatching: false,
        locatingRun: false,
        chainWaiting: false,
        workflowRun: null,
        hydratedDisplaySnapshot: { conclusion: "success" },
      }),
    ).toBe("success");

    expect(
      deriveCiLiteHeaderState({
        dispatching: false,
        locatingRun: false,
        chainWaiting: false,
        workflowRun: { status: "completed", conclusion: "neutral" },
        hydratedDisplaySnapshot: null,
      }),
    ).toBe("idle");
  });
});
