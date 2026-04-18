import { act, renderHook } from "@testing-library/react-native";
import { useChatAIFlow } from "../hooks/useChatAIFlow";
import { useChatAIRequestController } from "../hooks/chatAIFlow/useChatAIRequestController";
import type { AIConfig } from "../contexts/AIContext/models";

jest.mock("../hooks/chatAIFlow/useChatAIRequestController", () => ({
  useChatAIRequestController: jest.fn(),
}));

const mockedUseChatAIRequestController = useChatAIRequestController as jest.MockedFunction<
  typeof useChatAIRequestController
>;

const makeConfig = (): AIConfig => ({
  version: 1,
  selectedChatProvider: "openai",
  selectedChatMode: "gpt-5.4-mini",
  selectedAgentProvider: "openai",
  selectedAgentMode: "gpt-5.4-mini",
  qualityMode: "speed",
  agentEnabled: false,
  apiKeys: {
    groq: [],
    gemini: [],
    openai: [],
    anthropic: [],
    huggingface: [],
  },
});

const makePendingChange = (content: string) => ({
  files: [{ path: "App.tsx", content }],
  summary: "Block change",
  created: [],
  updated: ["App.tsx"],
  skipped: [],
  aiResponse: { ok: true, provider: "openai", text: "[]" },
});

describe("useChatAIFlow staged auto continue integration", () => {
  beforeEach(() => {
    mockedUseChatAIRequestController.mockReset();
  });

  it("auto-triggers the next staged block after applyChanges", async () => {
    const addChatMessage = jest.fn();
    const updateProjectFiles = jest.fn().mockResolvedValue(undefined);
    const setShowConfirmModal = jest.fn();

    const processCalls: string[] = [];
    mockedUseChatAIRequestController.mockImplementation((args) => {
      return async (userContent: string, _isAutoFix?: boolean, forceBuilder?: boolean) => {
        processCalls.push(userContent);
        if (!forceBuilder && userContent === "start staged flow") {
          args.setPendingPlan({
            originalRequest: "start staged flow",
            planText: "Block 1\nBlock 2\nBlock 3",
            mode: "staged",
            stagedLastBlockIndex: 0,
            stagedNextBlockIndex: 1,
            stagedTotalBlocks: 3,
          });
          return true;
        }

        if (forceBuilder && userContent.includes("Nur Block 1 umsetzen")) {
          args.setPendingChange(makePendingChange("export default function App(){return null;}"));
          return true;
        }

        if (forceBuilder && userContent.includes("Nur Block 2 umsetzen")) {
          args.setPendingChange(makePendingChange("export default function App(){return <></>;}"));
          return true;
        }

        return false;
      };
    });

    const { result } = renderHook(() =>
      useChatAIFlow({
        config: makeConfig(),
        messages: [],
        projectFiles: [{ path: "App.tsx", content: "export default function App(){return null;}" }],
        addChatMessage,
        updateProjectFiles,
        autoFixRequest: null,
        clearAutoFixRequest: jest.fn(),
        hardScrollToBottom: jest.fn(),
        setIsStreaming: jest.fn(),
        setStreamingMessage: jest.fn(),
        setIsAiLoading: jest.fn(),
        setError: jest.fn(),
        setShowConfirmModal,
      }),
    );

    await act(async () => {
      const ok = await result.current.handleSendWithMeta("start staged flow");
      expect(ok).toBe(true);
    });
    expect(result.current.pendingPlan?.mode).toBe("staged");

    await act(async () => {
      const ok = await result.current.handleSendWithMeta("weiter");
      expect(ok).toBe(true);
    });

    expect(result.current.pendingPlan?.stagedNextBlockIndex).toBe(1);
    expect(result.current.pendingChange).not.toBeNull();

    await act(async () => {
      await result.current.applyChanges();
    });

    expect(updateProjectFiles).toHaveBeenCalled();
    expect(result.current.pendingPlan?.stagedNextBlockIndex).toBe(2);
    expect(result.current.pendingChange).not.toBeNull();
    expect(processCalls.some((entry) => entry.includes("Nur Block 2 umsetzen"))).toBe(true);
    expect(addChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining("Auto-Fortsetzung: Starte jetzt Block 2"),
      }),
    );
  });

  it("keeps staged cursor stable and emits fallback notice when auto-continue fails", async () => {
    const addChatMessage = jest.fn();
    const updateProjectFiles = jest.fn().mockResolvedValue(undefined);

    mockedUseChatAIRequestController.mockImplementation((args) => {
      return async (userContent: string, _isAutoFix?: boolean, forceBuilder?: boolean) => {
        if (!forceBuilder && userContent === "start staged flow") {
          args.setPendingPlan({
            originalRequest: "start staged flow",
            planText: "Block 1\nBlock 2",
            mode: "staged",
            stagedLastBlockIndex: 0,
            stagedNextBlockIndex: 1,
            stagedTotalBlocks: 2,
          });
          return true;
        }

        if (forceBuilder && userContent.includes("Nur Block 1 umsetzen")) {
          args.setPendingChange(makePendingChange("export default function App(){return null;}"));
          return true;
        }

        if (forceBuilder && userContent.includes("Nur Block 2 umsetzen")) {
          return false;
        }

        return false;
      };
    });

    const { result } = renderHook(() =>
      useChatAIFlow({
        config: makeConfig(),
        messages: [],
        projectFiles: [{ path: "App.tsx", content: "export default function App(){return null;}" }],
        addChatMessage,
        updateProjectFiles,
        autoFixRequest: null,
        clearAutoFixRequest: jest.fn(),
        hardScrollToBottom: jest.fn(),
        setIsStreaming: jest.fn(),
        setStreamingMessage: jest.fn(),
        setIsAiLoading: jest.fn(),
        setError: jest.fn(),
        setShowConfirmModal: jest.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleSendWithMeta("start staged flow");
    });
    await act(async () => {
      await result.current.handleSendWithMeta("weiter");
    });
    expect(result.current.pendingChange).not.toBeNull();
    await act(async () => {
      await result.current.applyChanges();
    });

    expect(updateProjectFiles).toHaveBeenCalled();
    expect(result.current.pendingPlan?.mode).toBe("staged");
    expect(result.current.pendingPlan?.stagedNextBlockIndex).toBe(2);
    expect(result.current.pendingChange).toBeNull();
    expect(addChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining('Bitte mit "weiter" fortsetzen.'),
      }),
    );
  });
});
