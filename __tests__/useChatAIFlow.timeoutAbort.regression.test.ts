import { CHAT_AI_REQUEST_TIMEOUT_MS, runOrchestratorWithHardTimeout } from "../hooks/useChatAIFlow";

const mockRunOrchestrator = jest.fn();

jest.mock("../lib/orchestrator", () => ({
  runOrchestrator: (...args: unknown[]) => mockRunOrchestrator(...args),
}));

describe("useChatAIFlow hard timeout wrapper", () => {
  beforeEach(() => {
    mockRunOrchestrator.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("aborts hanging orchestrator requests and reports timeout", async () => {
    jest.useFakeTimers();

    mockRunOrchestrator.mockImplementation(
      (_provider: string, _model: string, _quality: string, _messages: unknown[], signal?: AbortSignal) =>
        new Promise((resolve) => {
          signal?.addEventListener("abort", () => {
            resolve({ ok: false, error: "Request abgebrochen" });
          });
        }),
    );

    const pending = runOrchestratorWithHardTimeout(
      "groq",
      "llama-3.1-8b-instant",
      "speed",
      [{ role: "user", content: "hi" }],
      undefined,
      50,
    );

    await jest.advanceTimersByTimeAsync(51);
    const result = await pending;

    expect(result.ok).toBe(false);
    expect(String(result.error || "")).toMatch(/timeout/i);
    expect(mockRunOrchestrator).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it("keeps external abort semantics as abgebrochen", async () => {
    mockRunOrchestrator.mockImplementation(
      (_provider: string, _model: string, _quality: string, _messages: unknown[], signal?: AbortSignal) =>
        new Promise((resolve) => {
          signal?.addEventListener("abort", () => {
            resolve({ ok: false, error: "Request abgebrochen" });
          });
        }),
    );

    const controller = new AbortController();
    const pending = runOrchestratorWithHardTimeout(
      "groq",
      "llama-3.1-8b-instant",
      "speed",
      [{ role: "user", content: "hi" }],
      controller.signal,
      CHAT_AI_REQUEST_TIMEOUT_MS,
    );

    controller.abort();
    const result = await pending;

    expect(result.ok).toBe(false);
    expect(String(result.error || "")).toMatch(/abgebrochen/i);
  });
});
