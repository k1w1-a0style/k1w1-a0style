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
});
