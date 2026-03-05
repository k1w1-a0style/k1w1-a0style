import { computeCiLiteOk } from "../components/ciLite/ciLiteUtils";

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
