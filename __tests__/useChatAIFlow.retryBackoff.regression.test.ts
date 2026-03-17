import { computeBuilderRetryDelayMs } from "../hooks/useChatAIFlow";

describe("useChatAIFlow builder retry backoff", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("honors retry-after seconds hints from provider errors", () => {
    const delay = computeBuilderRetryDelayMs(1, "429 Too Many Requests. Retry-After: 2s");
    expect(delay).toBe(2000);
  });

  it("uses capped exponential backoff with jitter", () => {
    jest.spyOn(Math, "random").mockReturnValue(0);

    expect(computeBuilderRetryDelayMs(1, "429 rate limit")).toBe(630);
    expect(computeBuilderRetryDelayMs(2, "timeout")).toBe(1260);
  });

  it("caps very large retry-after values", () => {
    const delay = computeBuilderRetryDelayMs(1, "retry-after=120s");
    expect(delay).toBe(3500);
  });
});
