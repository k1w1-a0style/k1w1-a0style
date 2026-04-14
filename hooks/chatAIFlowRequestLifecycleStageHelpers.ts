import { getBuilderFailureMessage } from "./chatAIFlowNoticeHelpers";
import { getBuilderFlowErrorNoticeText } from "./chatAIFlowNoticeMessageHelpers";
import { BuilderNonOkError } from "./chatAIFlowRequestOrchestrator";

type MutableRef<T> = { current: T };

export const isAbortLikeError = (error: Error): boolean =>
  error.name === "AbortError" || /abgebrochen/i.test(error.message);

export const buildRequestFailureNotice = (error: Error): string => {
  const builderFallbackMessage = error instanceof BuilderNonOkError
    ? getBuilderFailureMessage(error.result)
    : error.message;

  return getBuilderFlowErrorNoticeText(builderFallbackMessage);
};

export const finalizeRequestCycle = ({
  safe,
  setIsAiLoading,
  inFlightRef,
  abortControllerRef,
  requestController,
  requestId,
  activeRequestIdRef,
  isMountedRef,
  drainAutoFixQueue,
}: {
  safe: <T>(fn: () => T) => T | undefined;
  setIsAiLoading: (value: boolean) => void;
  inFlightRef: MutableRef<boolean>;
  abortControllerRef: MutableRef<AbortController | null>;
  requestController: AbortController;
  requestId: number;
  activeRequestIdRef: MutableRef<number>;
  isMountedRef: MutableRef<boolean>;
  drainAutoFixQueue: () => void;
}): void => {
  if (activeRequestIdRef.current !== requestId) return;

  safe(() => setIsAiLoading(false));
  inFlightRef.current = false;
  if (abortControllerRef.current === requestController) {
    abortControllerRef.current = null;
  }

  setTimeout(() => {
    if (isMountedRef.current) drainAutoFixQueue();
  }, 0);
};
