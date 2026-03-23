const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

export class TimeoutError extends Error {
  timeoutMs: number;

  constructor(message: string, timeoutMs: number) {
    super(message);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export type FetchWithTimeoutInit = RequestInit & {
  timeoutMs?: number;
  timeoutMessage?: string;
};

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: FetchWithTimeoutInit = {},
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    timeoutMessage,
    signal,
    ...requestInit
  } = init;

  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new DOMException("Aborted", "AbortError");
  }

  const controller = new AbortController();
  const message = timeoutMessage ?? `Request timed out after ${timeoutMs}ms`;
  const timeoutError = new TimeoutError(message, timeoutMs);

  const onAbort = () => {
    if (!controller.signal.aborted) {
      controller.abort(signal?.reason);
    }
  };

  const timeoutId = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort(timeoutError);
    }
  }, timeoutMs);

  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    return await fetch(input, {
      ...requestInit,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onAbort);
  }
}
