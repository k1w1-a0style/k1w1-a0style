import {
  buildRequestFailureNotice,
  finalizeRequestCycle,
  isAbortLikeError,
} from "../hooks/chatAIFlowRequestLifecycleStageHelpers";
import { BuilderNonOkError } from "../hooks/chatAIFlowRequestOrchestrator";

describe("chatAIFlowRequestLifecycleStageHelpers", () => {
  it("classifies abort-like errors via name or localized message", () => {
    expect(isAbortLikeError(Object.assign(new Error("cancelled"), { name: "AbortError" }))).toBe(true);
    expect(isAbortLikeError(new Error("Request wurde abgebrochen"))).toBe(true);
    expect(isAbortLikeError(new Error("regular failure"))).toBe(false);
  });

  it("normalizes builder failures into flow notice text", () => {
    const builderError = new BuilderNonOkError({ ok: false, error: "429 Too many requests" });
    const notice = buildRequestFailureNotice(builderError);
    expect(notice).toContain("KI-Request fehlgeschlagen");

    const genericNotice = buildRequestFailureNotice(new Error("network down"));
    expect(genericNotice).toContain("network down");
  });

  it("finalizes loading/inflight/controller and drains queue only when mounted", () => {
    jest.useFakeTimers();
    const setIsAiLoading = jest.fn();
    const safe = <T>(fn: () => T) => fn();
    const drainAutoFixQueue = jest.fn();

    const requestController = new AbortController();
    const abortControllerRef = { current: requestController as AbortController | null };
    const inFlightRef = { current: true };
    const isMountedRef = { current: true };

    finalizeRequestCycle({
      safe,
      setIsAiLoading,
      inFlightRef,
      abortControllerRef,
      requestController,
      isMountedRef,
      drainAutoFixQueue,
    });

    expect(setIsAiLoading).toHaveBeenCalledWith(false);
    expect(inFlightRef.current).toBe(false);
    expect(abortControllerRef.current).toBeNull();

    jest.runAllTimers();
    expect(drainAutoFixQueue).toHaveBeenCalledTimes(1);

    const requestController2 = new AbortController();
    const abortControllerRef2 = { current: requestController2 as AbortController | null };
    const inFlightRef2 = { current: true };
    const isMountedRef2 = { current: false };

    finalizeRequestCycle({
      safe,
      setIsAiLoading,
      inFlightRef: inFlightRef2,
      abortControllerRef: abortControllerRef2,
      requestController: requestController2,
      isMountedRef: isMountedRef2,
      drainAutoFixQueue,
    });

    jest.runAllTimers();
    expect(drainAutoFixQueue).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});
