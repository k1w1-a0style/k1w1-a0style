import {
  getScreenBlurAbortNotice,
  hasPreservedPendingState,
  shouldAbortOnScreenBlur,
} from "../hooks/chatAIFlowLifecycleHelpers";

describe("chatAIFlowLifecycleHelpers", () => {
  it("shouldAbortOnScreenBlur returns true for active request, abort controller or queued autofix", () => {
    expect(
      shouldAbortOnScreenBlur({
        inFlight: true,
        hasAbortController: false,
        queuedAutoFixCount: 0,
      }),
    ).toBe(true);

    expect(
      shouldAbortOnScreenBlur({
        inFlight: false,
        hasAbortController: true,
        queuedAutoFixCount: 0,
      }),
    ).toBe(true);

    expect(
      shouldAbortOnScreenBlur({
        inFlight: false,
        hasAbortController: false,
        queuedAutoFixCount: 1,
      }),
    ).toBe(true);

    expect(
      shouldAbortOnScreenBlur({
        inFlight: false,
        hasAbortController: false,
        queuedAutoFixCount: 0,
      }),
    ).toBe(false);
  });

  it("hasPreservedPendingState returns true when pending plan or pending change exists", () => {
    expect(
      hasPreservedPendingState({
        hasPendingPlan: true,
        hasPendingChange: false,
      }),
    ).toBe(true);

    expect(
      hasPreservedPendingState({
        hasPendingPlan: false,
        hasPendingChange: true,
      }),
    ).toBe(true);

    expect(
      hasPreservedPendingState({
        hasPendingPlan: false,
        hasPendingChange: false,
      }),
    ).toBe(false);
  });

  it("returns deterministic blur abort notice based on preserved pending state", () => {
    expect(getScreenBlurAbortNotice(true)).toContain("bleiben erhalten");
    expect(getScreenBlurAbortNotice(false)).not.toContain("bleiben erhalten");
  });
});
