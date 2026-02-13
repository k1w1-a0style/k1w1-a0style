import AsyncStorage from "@react-native-async-storage/async-storage";

import { loadProjectFromStorage } from "../contexts/projectStorage";

describe("chat history migration", () => {
  beforeEach(() => {
    (AsyncStorage as any).__resetMockStorage?.();
    jest.clearAllMocks();
  });

  it("adds ids to old chatHistory entries that lack id", async () => {
    const legacyProject: any = {
      name: "legacy",
      files: [],
      chatHistory: [
        { role: "user", content: "hi", timestamp: "2026-01-01T00:00:00.000Z" },
        { role: "assistant", content: "yo", timestamp: "2026-01-01T00:00:01.000Z" },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      lastModified: "2026-01-01T00:00:00.000Z",
    };

    (AsyncStorage as any).__setMockStorage?.({
      k1w1_project_data: JSON.stringify(legacyProject),
    });

    const loaded = await loadProjectFromStorage();
    expect(loaded).toBeTruthy();
    expect(loaded?.chatHistory?.length).toBe(2);

    for (const m of loaded!.chatHistory) {
      expect(typeof m.id).toBe("string");
      expect(m.id.length).toBeGreaterThan(0);
      expect(typeof m.timestamp).toBe("string");
      expect(m.timestamp.length).toBeGreaterThan(0);
      expect(typeof m.content).toBe("string");
    }
  });

  it("migrates old 'messages' property to chatHistory and adds ids", async () => {
    const legacyProject: any = {
      name: "legacy2",
      files: [],
      messages: [{ role: "user", content: "old", timestamp: "2026-01-02T00:00:00.000Z" }],
      createdAt: "2026-01-02T00:00:00.000Z",
      lastModified: "2026-01-02T00:00:00.000Z",
    };

    (AsyncStorage as any).__setMockStorage?.({
      k1w1_project_data: JSON.stringify(legacyProject),
    });

    const loaded = await loadProjectFromStorage();
    expect(loaded).toBeTruthy();
    expect(loaded?.chatHistory?.length).toBe(1);
    expect(typeof loaded!.chatHistory[0].id).toBe("string");
    expect(loaded!.chatHistory[0].id.length).toBeGreaterThan(0);
  });
});
