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

type HookRuntime = {
  addChatMessage: jest.Mock;
  updateProjectFiles: jest.Mock;
  setShowConfirmModal: jest.Mock;
};

const renderFlow = ({ projectId = "p1" }: { projectId?: string } = {}) => {
  const addChatMessage = jest.fn();
  const updateProjectFiles = jest.fn().mockResolvedValue(undefined);
  const setShowConfirmModal = jest.fn();
  const hook = renderHook<ReturnType<typeof useChatAIFlow>, { pid: string }>(
    ({ pid }: { pid: string }) =>
      useChatAIFlow({
        config: makeConfig(),
        projectId: pid,
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
    { initialProps: { pid: projectId } },
  );

  return {
    ...hook,
    addChatMessage,
    updateProjectFiles,
    setShowConfirmModal,
  } satisfies HookRuntime & typeof hook;
};

describe("useChatAIFlow staged screen-near regressions", () => {
  beforeEach(() => {
    mockedUseChatAIRequestController.mockReset();
  });

  it("clears staged pending state when projectId changes (cross-screen project switch)", async () => {
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
        return false;
      };
    });

    const flow = renderFlow({ projectId: "project-a" });

    await act(async () => {
      await flow.result.current.handleSendWithMeta("start staged flow");
    });
    await act(async () => {
      await flow.result.current.handleSendWithMeta("weiter");
    });

    expect(flow.result.current.pendingPlan?.mode).toBe("staged");
    expect(flow.result.current.pendingChange).not.toBeNull();

    await act(async () => {
      flow.rerender({ pid: "project-b" });
    });

    expect(flow.result.current.pendingPlan).toBeNull();
    expect(flow.result.current.pendingChange).toBeNull();
  });

  it("supports manual retry after auto-continue failure and keeps confirm-modal lifecycle stable", async () => {
    let block2Attempts = 0;
    mockedUseChatAIRequestController.mockImplementation((args) => {
      return async (userContent: string, _isAutoFix?: boolean, forceBuilder?: boolean) => {
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
          block2Attempts += 1;
          if (block2Attempts === 1) return false;
          args.setPendingChange(makePendingChange("export default function App(){return <></>;}"));
          return true;
        }

        return false;
      };
    });

    const flow = renderFlow();

    await act(async () => {
      await flow.result.current.handleSendWithMeta("start staged flow");
    });
    await act(async () => {
      await flow.result.current.handleSendWithMeta("weiter");
    });
    expect(flow.result.current.pendingPlan?.stagedNextBlockIndex).toBe(2);
    expect(flow.result.current.pendingChange).not.toBeNull();

    await act(async () => {
      await flow.result.current.applyChanges();
    });

    expect(flow.updateProjectFiles).toHaveBeenCalled();
    expect(flow.setShowConfirmModal).toHaveBeenCalledWith(false);
    expect(flow.result.current.pendingPlan?.stagedNextBlockIndex).toBe(2);
    expect(flow.result.current.pendingChange).toBeNull();
    expect(flow.addChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining('Bitte mit "weiter" fortsetzen.'),
      }),
    );

    await act(async () => {
      await flow.result.current.handleSendWithMeta("weiter");
    });

    expect(block2Attempts).toBe(2);
    expect(flow.result.current.pendingPlan?.stagedNextBlockIndex).toBe(3);
    expect(flow.result.current.pendingChange).not.toBeNull();
  });

  it("handles abort during in-flight auto-continue and allows clean staged restart", async () => {
    let pendingBlock2Resolver: ((value: boolean) => void) | null = null;
    let block2Attempts = 0;

    mockedUseChatAIRequestController.mockImplementation((args) => {
      return async (userContent: string, _isAutoFix?: boolean, forceBuilder?: boolean) => {
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
          block2Attempts += 1;
          return await new Promise<boolean>((resolve) => {
            pendingBlock2Resolver = resolve;
          });
        }

        return false;
      };
    });

    const flow = renderFlow();

    await act(async () => {
      await flow.result.current.handleSendWithMeta("start staged flow");
    });
    await act(async () => {
      await flow.result.current.handleSendWithMeta("weiter");
    });
    expect(flow.result.current.pendingPlan?.stagedNextBlockIndex).toBe(2);
    expect(flow.result.current.pendingChange).not.toBeNull();

    let applyPromise: Promise<void> | null = null;
    act(() => {
      applyPromise = flow.result.current.applyChanges();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(flow.updateProjectFiles).toHaveBeenCalled();
    expect(block2Attempts).toBe(1);
    expect(pendingBlock2Resolver).not.toBeNull();

    act(() => {
      flow.result.current.abortCurrentRequest();
    });

    expect(flow.result.current.pendingPlan).toBeNull();
    expect(flow.result.current.pendingChange).toBeNull();
    expect(flow.addChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining("Anfrage manuell abgebrochen"),
      }),
    );

    await act(async () => {
      pendingBlock2Resolver?.(false);
      await applyPromise;
    });

    await act(async () => {
      await flow.result.current.handleSendWithMeta("start staged flow");
    });
    await act(async () => {
      await flow.result.current.handleSendWithMeta("weiter");
    });

    expect(block2Attempts).toBe(1);
    expect(flow.result.current.pendingPlan?.mode).toBe("staged");
    expect(flow.result.current.pendingPlan?.stagedNextBlockIndex).toBe(2);
    expect(flow.result.current.pendingChange).not.toBeNull();
  });
});
