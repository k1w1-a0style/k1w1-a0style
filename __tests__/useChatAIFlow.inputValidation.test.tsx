import { act, renderHook } from "@testing-library/react-native";
import { useChatAIFlow } from "../hooks/useChatAIFlow";
import * as validators from "../lib/validators";
import { runOrchestrator } from "../lib/orchestrator";
import type { ChatMessage } from "../shared/types/chat";
import type { ProjectFile } from "../shared/types/project";
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
type FlowOptions = {
  messages?: ChatMessage[];
  projectFiles?: ProjectFile[];
};
const createFlow = (options: FlowOptions = {}) => {
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
      messages: options.messages ?? [],
      projectFiles:
        options.projectFiles ?? [{ path: "App.tsx", content: "export default function App() { return null; }" }],
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
  it("keeps normal history but filters local preview/meta-only history out of provider context", async () => {
    const { result } = createFlow({
      messages: [
        {
          id: "msg-user",
          role: "user",
          content: "Bitte passe den Button an",
          timestamp: new Date("2026-03-20T00:00:00.000Z").toISOString(),
        },
        {
          id: "msg-preview",
          role: "assistant",
          content: "📄 **src/local.ts**\n\n```ts\nconst secret = 'preview';\n```",
          timestamp: new Date("2026-03-20T00:00:01.000Z").toISOString(),
          meta: { localOnly: true, metaCommand: true, containsFilePreview: true },
        },
        {
          id: "msg-meta",
          role: "assistant",
          content: "📂 Aktuelle Projektdateien ...",
          timestamp: new Date("2026-03-20T00:00:02.000Z").toISOString(),
          meta: { localOnly: true, metaCommand: true },
        },
      ],
    });
    await act(async () => {
      await result.current.handleSendWithMeta("Bitte ändere die Button-Farbe");
    });
    const builderMessages = mockedRunOrchestrator.mock.calls[0]?.[3] ?? [];
    const joined = JSON.stringify(builderMessages);
    expect(joined).toContain("Bitte passe den Button an");
    expect(joined).not.toContain("src/local.ts");
    expect(joined).not.toContain("Aktuelle Projektdateien");
  });
  it("surfaces runtime fallback notes as visible system chat messages", async () => {
    mockedRunOrchestrator.mockReset();
    mockedRunOrchestrator.mockResolvedValueOnce({
      ok: true,
      text: JSON.stringify([
        { path: "components/Button.tsx", content: "export const Button = () => null;" },
      ]),
      provider: "openai",
      model: "gpt-4o",
      runtimeNote: "ℹ️ Runtime-Fallback aktiv: gemini/gemini-2.5-flash -> openai/gpt-4o",
      fallbackUsed: true,
    } as any);

    const { result, addChatMessage } = createFlow();

    await act(async () => {
      await result.current.handleSendWithMeta("Bitte aktualisiere App.tsx");
    });

    expect(addChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "system",
        content: "ℹ️ Runtime-Fallback aktiv: gemini/gemini-2.5-flash -> openai/gpt-4o",
        meta: expect.objectContaining({ runtimeNote: true, fallbackUsed: true }),
      }),
    );
  });

  it("redacts token/header/credential patterns before provider handoff", async () => {
    const { result } = createFlow({
      messages: [
        {
          id: "msg-secret-history",
          role: "assistant",
          content: "Cookie: session=abc123\npassword=hunter2\nclient_secret=super-secret",
          timestamp: new Date("2026-03-20T00:00:03.000Z").toISOString(),
        },
      ],
    });
    await act(async () => {
      await result.current.handleSendWithMeta(
        "Bitte nutze Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345 und x-api-key: sk_test_1234567890abcdef",
      );
    });
    const builderMessages = mockedRunOrchestrator.mock.calls[0]?.[3] ?? [];
    const joined = builderMessages.map((message: { content: string }) => message.content).join("\n---\n");
    expect(joined).toContain("Bearer <redacted>");
    expect(joined).toContain('password="<redacted>"');
    expect(joined).toContain('client_secret="<redacted>"');
    expect(joined).toContain("Cookie: <redacted>");
    expect(joined).not.toContain("abcdefghijklmnopqrstuvwxyz012345");
    expect(joined).not.toContain("sk_test_1234567890abcdef");
    expect(joined).not.toContain("hunter2");
    expect(joined).not.toContain("super-secret");
  });
});
