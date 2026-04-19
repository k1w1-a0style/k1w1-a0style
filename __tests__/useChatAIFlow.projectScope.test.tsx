import { act, renderHook } from "@testing-library/react-native";
import { useChatAIFlow } from "../hooks/useChatAIFlow";
import type { AIConfig } from "../contexts/AIContext/models";
import type { ChatMessage } from "../shared/types/chat";
import type { ProjectFile } from "../shared/types/project";

const mockExecuteChatRequestPipeline = jest.fn();

jest.mock("../hooks/chatAIFlowRequestPipeline", () => ({
  executeChatRequestPipeline: (...args: unknown[]) => mockExecuteChatRequestPipeline(...args),
}));

const makeConfig = (): AIConfig => ({
  version: 1,
  selectedChatProvider: "openai",
  selectedChatMode: "gpt-5.4-mini",
  selectedAgentProvider: "openai",
  selectedAgentMode: "gpt-5.4-mini",
  qualityMode: "speed",
  agentEnabled: false,
  apiKeys: { groq: [], gemini: [], openai: [], anthropic: [], huggingface: [] },
});

const baseFiles: ProjectFile[] = [{ path: "App.tsx", content: "export default function App() { return null; }" }];
const baseMessages: ChatMessage[] = [];

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useChatAIFlow project scoping", () => {
  beforeEach(() => {
    mockExecuteChatRequestPipeline.mockReset();
  });

  test("ignores stale pipeline writeback after project switch", async () => {
    const delayed = createDeferred<{
      kind: "planner_preview";
      message: string;
      pendingPlan: { originalRequest: string; planText: string; mode: "advice" };
    }>();
    mockExecuteChatRequestPipeline.mockReturnValue(delayed.promise);

    const addChatMessage = jest.fn();
    const setIsAiLoading = jest.fn();

    const { result, rerender } = renderHook(
      ({ projectId }: { projectId: string }) =>
        useChatAIFlow({
          config: makeConfig(),
          projectId,
          messages: baseMessages,
          projectFiles: baseFiles,
          addChatMessage,
          updateProjectFiles: jest.fn().mockResolvedValue(undefined),
          autoFixRequest: null,
          clearAutoFixRequest: jest.fn(),
          hardScrollToBottom: jest.fn(),
          setIsStreaming: jest.fn(),
          setStreamingMessage: jest.fn(),
          setIsAiLoading,
          setError: jest.fn(),
          setShowConfirmModal: jest.fn(),
        }),
      { initialProps: { projectId: "project-a" } },
    );

    const requestPromise = act(async () => {
      await result.current.handleSendWithMeta("Bitte plane den nächsten Schritt.");
    });

    rerender({ projectId: "project-b" });
    delayed.resolve({
      kind: "planner_preview",
      message: "Plan für Projekt A",
      pendingPlan: { originalRequest: "x", planText: "y", mode: "advice" },
    });
    await requestPromise;

    expect(result.current.pendingPlan).toBeNull();
  });

  test("manual abort clears loading state and emits visible notice", async () => {
    const addChatMessage = jest.fn();
    const setIsAiLoading = jest.fn();

    const { result } = renderHook(() =>
      useChatAIFlow({
        config: makeConfig(),
        projectId: "project-a",
        messages: baseMessages,
        projectFiles: baseFiles,
        addChatMessage,
        updateProjectFiles: jest.fn().mockResolvedValue(undefined),
        autoFixRequest: null,
        clearAutoFixRequest: jest.fn(),
        hardScrollToBottom: jest.fn(),
        setIsStreaming: jest.fn(),
        setStreamingMessage: jest.fn(),
        setIsAiLoading,
        setError: jest.fn(),
        setShowConfirmModal: jest.fn(),
      }),
    );

    act(() => {
      result.current.abortCurrentRequest();
    });

    expect(setIsAiLoading).toHaveBeenCalledWith(false);
    expect(addChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining("manuell abgebrochen"),
      }),
    );
  });

  test("old aborted request finalizer does not clear loading for a newer request", async () => {
    const first = createDeferred<{ kind: "confirmation_required"; message: string }>();
    const second = createDeferred<{ kind: "confirmation_required"; message: string }>();
    mockExecuteChatRequestPipeline
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const setIsAiLoading = jest.fn();

    const { result } = renderHook(() =>
      useChatAIFlow({
        config: makeConfig(),
        projectId: "project-a",
        messages: baseMessages,
        projectFiles: baseFiles,
        addChatMessage: jest.fn(),
        updateProjectFiles: jest.fn().mockResolvedValue(undefined),
        autoFixRequest: null,
        clearAutoFixRequest: jest.fn(),
        hardScrollToBottom: jest.fn(),
        setIsStreaming: jest.fn(),
        setStreamingMessage: jest.fn(),
        setIsAiLoading,
        setError: jest.fn(),
        setShowConfirmModal: jest.fn(),
      }),
    );

    let firstRun!: Promise<boolean>;
    act(() => {
      firstRun = result.current.handleSendWithMeta("run 1");
    });

    act(() => {
      result.current.abortCurrentRequest();
    });

    let secondRun!: Promise<boolean>;
    act(() => {
      secondRun = result.current.handleSendWithMeta("run 2");
    });

    await act(async () => {
      first.resolve({ kind: "confirmation_required", message: "old" });
      await Promise.resolve();
    });

    expect(setIsAiLoading).toHaveBeenLastCalledWith(true);

    await act(async () => {
      second.resolve({ kind: "confirmation_required", message: "new" });
      await Promise.resolve();
    });

    await act(async () => {
      await firstRun;
      await secondRun;
    });
    expect(setIsAiLoading).toHaveBeenLastCalledWith(false);
  });

  test("stale send-handler reference does not forward an old pending plan after project switch", async () => {
    mockExecuteChatRequestPipeline
      .mockReturnValueOnce(Promise.resolve({
        kind: "planner_preview",
        message: "Plan for A",
        pendingPlan: { originalRequest: "x", planText: "1) Schritt", mode: "advice" },
      }))
      .mockReturnValueOnce(Promise.resolve({
        kind: "confirmation_required",
        message: "Weiter bitte",
      }));

    const { result, rerender } = renderHook(
      ({ projectId }: { projectId: string }) =>
        useChatAIFlow({
          config: makeConfig(),
          projectId,
          messages: baseMessages,
          projectFiles: baseFiles,
          addChatMessage: jest.fn(),
          updateProjectFiles: jest.fn().mockResolvedValue(undefined),
          autoFixRequest: null,
          clearAutoFixRequest: jest.fn(),
          hardScrollToBottom: jest.fn(),
          setIsStreaming: jest.fn(),
          setStreamingMessage: jest.fn(),
          setIsAiLoading: jest.fn(),
          setError: jest.fn(),
          setShowConfirmModal: jest.fn(),
        }),
      { initialProps: { projectId: "project-a" } },
    );

    await act(async () => {
      await result.current.handleSendWithMeta("Bitte plane den nächsten Schritt.");
    });
    expect(result.current.pendingPlan).not.toBeNull();

    const staleHandlerRef = result.current.handleSendWithMeta;
    rerender({ projectId: "project-b" });
    expect(result.current.pendingPlan).toBeNull();

    await act(async () => {
      await staleHandlerRef("weiter");
    });

    expect(mockExecuteChatRequestPipeline).toHaveBeenCalledTimes(2);
    const secondCallArg = mockExecuteChatRequestPipeline.mock.calls[1]?.[0];
    expect(secondCallArg?.currentPendingPlan).toBeNull();
    expect(secondCallArg?.sanitizedRequestContent).toBe("weiter");
  });

  test("project switch resets stale plan context and rebuilds send handler scope", async () => {
    mockExecuteChatRequestPipeline
      .mockReturnValueOnce(Promise.resolve({
        kind: "planner_preview",
        message: "Plan for A",
        pendingPlan: { originalRequest: "x", planText: "1) Schritt", mode: "advice" },
      }))
      .mockReturnValueOnce(Promise.resolve({
        kind: "confirmation_required",
        message: "Weiter bitte",
      }));

    const addChatMessage = jest.fn();
    const setIsAiLoading = jest.fn();
    const setError = jest.fn();
    const setShowConfirmModal = jest.fn();

    const { result, rerender } = renderHook(
      ({ projectId }: { projectId: string }) =>
        useChatAIFlow({
          config: makeConfig(),
          projectId,
          messages: baseMessages,
          projectFiles: baseFiles,
          addChatMessage,
          updateProjectFiles: jest.fn().mockResolvedValue(undefined),
          autoFixRequest: null,
          clearAutoFixRequest: jest.fn(),
          hardScrollToBottom: jest.fn(),
          setIsStreaming: jest.fn(),
          setStreamingMessage: jest.fn(),
          setIsAiLoading,
          setError,
          setShowConfirmModal,
        }),
      { initialProps: { projectId: "project-a" } },
    );

    await act(async () => {
      await result.current.handleSendWithMeta("Bitte plane den nächsten Schritt.");
    });

    expect(result.current.pendingPlan).not.toBeNull();
    const handlerBeforeSwitch = result.current.handleSendWithMeta;

    rerender({ projectId: "project-b" });

    expect(result.current.pendingPlan).toBeNull();
    expect(result.current.handleSendWithMeta).not.toBe(handlerBeforeSwitch);

    await act(async () => {
      await result.current.handleSendWithMeta("weiter");
    });

    expect(mockExecuteChatRequestPipeline).toHaveBeenCalledTimes(2);
    const secondCallArg = mockExecuteChatRequestPipeline.mock.calls[1]?.[0];
    expect(secondCallArg?.currentPendingPlan).toBeNull();
    expect(secondCallArg?.sanitizedRequestContent).toBe("weiter");
  });
});
