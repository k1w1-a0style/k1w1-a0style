import {
  announceContextBudgetNoteEffect,
  announceRuntimeNoteEffect,
  notifyKeyRotationEffect,
} from "../hooks/chatAIFlowRequestSideEffects";

describe("chatAIFlowRequestSideEffects", () => {
  it("emits runtime note system message when orchestrator returns one", () => {
    const addChatMessage = jest.fn();

    announceRuntimeNoteEffect({
      result: { ok: true, runtimeNote: "note", fallbackUsed: true },
      addChatMessage,
    });

    expect(addChatMessage).toHaveBeenCalledTimes(1);
    expect(addChatMessage.mock.calls[0][0].content).toContain("note");
    expect(addChatMessage.mock.calls[0][0].meta).toEqual(
      expect.objectContaining({ runtimeNote: true, fallbackUsed: true }),
    );
  });

  it("emits context-budget notice only once per identical marker", () => {
    const addChatMessage = jest.fn();
    const lastContextBudgetNoticeRef = { current: "" };
    const llmMessages = [
      {
        role: "system",
        content: "[intern] Kontext gekürzt (ältere History: -2, Snapshot-Dateien: -1).",
      },
    ];

    announceContextBudgetNoteEffect({
      llmMessages,
      lastContextBudgetNoticeRef,
      addChatMessage,
    });
    announceContextBudgetNoteEffect({
      llmMessages,
      lastContextBudgetNoticeRef,
      addChatMessage,
    });

    expect(addChatMessage).toHaveBeenCalledTimes(1);
    expect(addChatMessage.mock.calls[0][0].meta).toEqual(
      expect.objectContaining({ contextBudgetNote: true }),
    );
  });

  it("emits key-rotation system message when keysRotated is positive", () => {
    const addChatMessage = jest.fn();

    notifyKeyRotationEffect({
      result: { ok: true, keysRotated: 2, provider: "openai" },
      addChatMessage,
    });

    expect(addChatMessage).toHaveBeenCalledTimes(1);
    expect(addChatMessage.mock.calls[0][0].content).toContain("Key rotiert (2x)");
    expect(addChatMessage.mock.calls[0][0].meta).toEqual(
      expect.objectContaining({ keyRotation: true, provider: "openai" }),
    );
  });
});
