import { act, renderHook } from "@testing-library/react-native";

import { useChatAIFlow } from "../hooks/useChatAIFlow";
import * as validators from "../lib/validators";
import { runOrchestrator } from "../lib/orchestrator";

jest.mock("../lib/orchestrator", () => ({
  runOrchestrator: jest.fn(),
}));

const mockedRunOrchestrator = runOrchestrator as jest.MockedFunction<typeof runOrchestrator>;

beforeAll(() => {
  global.requestAnimationFrame = ((cb: any) => {
    cb(0);
    return 0;
  }) as any;
});

const createFlow = () => {
  const addChatMessage = jest.fn();
  const updateProjectFiles = jest.fn().mockResolvedValue(undefined);
  const hardScrollToBottom = jest.fn();
  const setIsStreaming = jest.fn();
  const setStreamingMessage = jest.fn();
  const setIsAiLoading = jest.fn();
  const setError = jest.fn();
  const setShowConfirmModal = jest.fn();

  const hook = renderHook(() =>
    useChatAIFlow({
      config: {
        selectedChatProvider: "openai",
        selectedChatMode: "gpt-4.1-mini",
        selectedAgentProvider: "openai",
        selectedAgentMode: "gpt-4.1-mini",
        qualityMode: "speed",
        agentEnabled: false,
      } as any,
      messages: [],
      projectFiles: [{ path: "App.tsx", content: "export default function App() { return null; }" }],
      addChatMessage,
      updateProjectFiles,
      autoFixRequest: null,
      clearAutoFixRequest: jest.fn(),
      hardScrollToBottom,
      setIsStreaming,
      setStreamingMessage,
      setIsAiLoading,
      setError,
      setShowConfirmModal,
    }),
  );

  return {
    ...hook,
    addChatMessage,
    setError,
  };
};

describe("useChatAIFlow input validation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedRunOrchestrator.mockReset();
    mockedRunOrchestrator
      .mockResolvedValueOnce({
        ok: true,
        text: JSON.stringify([
          { path: "components/Button.tsx", content: "export const Button = () => null;" },
        ]),
        provider: "openai",
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        text: "Kurz erklärt",
        provider: "openai",
      } as any);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("handleSendWithMeta uses validateChatInput on the real send path", async () => {
    const spy = jest.spyOn(validators, "validateChatInput");
    const { result } = createFlow();

    await act(async () => {
      await result.current.handleSendWithMeta("Bitte aktualisiere App.tsx");
    });

    expect(spy).toHaveBeenCalledWith("Bitte aktualisiere App.tsx");
    expect(mockedRunOrchestrator).toHaveBeenCalled();
  });

  it("blocks too long input with a clear message", async () => {
    const { result, addChatMessage, setError } = createFlow();
    const input = "a".repeat(10_001);

    await act(async () => {
      const ok = await result.current.handleSendWithMeta(input);
      expect(ok).toBe(false);
    });

    expect(mockedRunOrchestrator).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith(expect.stringContaining("zu lang"));
    expect(addChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "assistant",
        content: expect.stringContaining("zu lang"),
      }),
    );
  });

  it("sanitizes xss-like input before it reaches the provider", async () => {
    const { result, addChatMessage } = createFlow();

    await act(async () => {
      await result.current.handleSendWithMeta(
        '<script>alert("x")</script> Bitte aktualisiere App.tsx',
      );
    });

    const builderMessages = mockedRunOrchestrator.mock.calls[0]?.[3] ?? [];
    const joined = JSON.stringify(builderMessages);
    expect(joined).not.toContain("<script>");
    expect(joined).toContain("Bitte aktualisiere App.tsx");
    expect(addChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining("bereinigt"),
      }),
    );
    expect(addChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "user",
        content: expect.not.stringContaining("<script>"),
      }),
    );
  });
});
