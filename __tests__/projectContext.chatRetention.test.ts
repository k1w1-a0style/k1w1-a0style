import type { ChatMessage } from "../shared/types/chat";
import { appendChatMessageWithRetention } from "../contexts/ProjectContext";

const msg = (id: string, ts: string): ChatMessage => ({
  id,
  role: "user",
  content: id,
  timestamp: ts,
});

describe("appendChatMessageWithRetention", () => {
  it("keeps only newest entries within retention limit", () => {
    const history = [
      msg("1", "2026-01-01T00:00:00.000Z"),
      msg("2", "2026-01-01T00:00:01.000Z"),
    ];

    const result = appendChatMessageWithRetention(
      history,
      msg("3", "2026-01-01T00:00:02.000Z"),
      2,
    );

    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(["2", "3"]);
  });

  it("supports limit zero as hard-clear behavior", () => {
    const result = appendChatMessageWithRetention(
      [msg("1", "2026-01-01T00:00:00.000Z")],
      msg("2", "2026-01-01T00:00:01.000Z"),
      0,
    );

    expect(result).toEqual([]);
  });
});
