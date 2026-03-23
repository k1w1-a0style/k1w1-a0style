import { fetchWithTimeout, TimeoutError } from "../network/fetchWithTimeout";

const mockFetch = jest.fn();

function createAbortAwareFetchMock() {
  return jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal;
    return new Promise<Response>((_resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason ?? Object.assign(new Error("Aborted"), { name: "AbortError" }));
        return;
      }

      signal?.addEventListener(
        "abort",
        () => {
          reject(signal.reason ?? Object.assign(new Error("Aborted"), { name: "AbortError" }));
        },
        { once: true },
      );
    });
  });
}

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as typeof fetch;
  });

  it("aborts requests that exceed the timeout", async () => {
    mockFetch.mockImplementation(createAbortAwareFetchMock());

    await expect(
      fetchWithTimeout("https://example.com/slow", {
        timeoutMs: 20,
        timeoutMessage: "Slow request timed out",
      }),
    ).rejects.toMatchObject<Partial<TimeoutError>>({
      name: "TimeoutError",
      message: "Slow request timed out",
      timeoutMs: 20,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]?.[1]).toMatchObject({
      signal: expect.any(AbortSignal),
    });
  });

  it("preserves caller abort reasons", async () => {
    mockFetch.mockImplementation(createAbortAwareFetchMock());

    const controller = new AbortController();
    const aborted = Object.assign(new Error("Caller cancelled"), { name: "AbortError" });

    const promise = fetchWithTimeout("https://example.com/cancel", {
      timeoutMs: 100,
      signal: controller.signal,
    });

    controller.abort(aborted);

    await expect(promise).rejects.toBe(aborted);
  });
});
