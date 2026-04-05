import {
  buildAssistantMessage,
  buildChatMessage,
  buildSystemMessage,
  buildUserMessage,
} from "../hooks/chatAIFlowChatMessageFactory";

describe("chatAIFlowChatMessageFactory", () => {
  it("builds messages with id/timestamp/role/content and optional meta", () => {
    const msg = buildChatMessage({
      role: "assistant",
      content: "Hallo",
      meta: { error: true },
    });

    expect(typeof msg.id).toBe("string");
    expect(msg.id.length).toBeGreaterThan(0);
    expect(msg.role).toBe("assistant");
    expect(msg.content).toBe("Hallo");
    expect(msg.meta).toEqual({ error: true });
    expect(new Date(msg.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("provides role-specific convenience builders", () => {
    expect(buildAssistantMessage("A").role).toBe("assistant");
    expect(buildSystemMessage("S").role).toBe("system");
    expect(buildUserMessage("U").role).toBe("user");
  });
});
