import {
  isRetryableBuilderError,
  parseRetryAfterMs,
  readOrchestratorErrorText,
  readOrchestratorRuntimeNote,
  shouldRetryBuilderAttempt,
} from "../hooks/useChatAIFlowRetryHelpers";

describe("useChatAIFlowRetryHelpers", () => {
  it("combines orchestrator error fields into one text block", () => {
    expect(
      readOrchestratorErrorText({
        ok: false,
        error: "rate limited",
        errors: ["retry-after 2s", "network"],
      }),
    ).toBe("rate limited\nretry-after 2s\nnetwork");
    expect(readOrchestratorErrorText(null)).toBe("");
  });

  it("reads runtime note as trimmed text", () => {
    expect(readOrchestratorRuntimeNote({ ok: false, error: "x", runtimeNote: "  hint  " })).toBe("hint");
    expect(readOrchestratorRuntimeNote({ ok: false, error: "x" })).toBe("");
  });

  it("parses retry-after in seconds and milliseconds", () => {
    expect(parseRetryAfterMs("retry-after: 1.5s")).toBe(1500);
    expect(parseRetryAfterMs("Retry-After 250 ms")).toBe(250);
    expect(parseRetryAfterMs("no hint")).toBeNull();
  });

  it("marks retryable builder error patterns", () => {
    expect(isRetryableBuilderError("HTTP 429 rate limit")).toBe(true);
    expect(isRetryableBuilderError("ECONNRESET")).toBe(true);
    expect(isRetryableBuilderError("validation failed")).toBe(false);
  });

  it("retries only while attempts remain and error is retryable", () => {
    expect(
      shouldRetryBuilderAttempt({
        attempt: 1,
        maxAttempts: 3,
        errorText: "429 rate limit",
      }),
    ).toBe(true);
    expect(
      shouldRetryBuilderAttempt({
        attempt: 3,
        maxAttempts: 3,
        errorText: "429 rate limit",
      }),
    ).toBe(false);
    expect(
      shouldRetryBuilderAttempt({
        attempt: 1,
        maxAttempts: 3,
        errorText: "validation failed",
      }),
    ).toBe(false);
  });
});
