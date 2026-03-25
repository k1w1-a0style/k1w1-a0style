import { maskApiKey } from "../lib/apiKeyMasking";
import { sanitizeAiConfigFromBackup, validateApiBackupJson } from "../lib/appInfoBackup";

// Minimal AIConfig fallback for unit tests (keep it aligned with contexts/AIContext.tsx)
const baseConfig: any = {
  version: 1,
  selectedChatProvider: "openai",
  selectedChatMode: "llama-3.1-8b-instant",
  selectedAgentProvider: "openai",
  selectedAgentMode: "claude-4-opus-202502",
  qualityMode: "balanced",
  agentEnabled: true,
  apiKeys: {
    groq: [],
    gemini: [],
    openai: [],
    anthropic: [],
    huggingface: [],
  },
};

describe("AppInfo backup privacy helpers", () => {
  test("maskApiKey masks middle and keeps ends", () => {
    const v = maskApiKey("sk-1234567890ABCDEFGHIJ");
    expect(v.startsWith("sk-1")).toBe(true);
    expect(v.endsWith("GHIJ")).toBe(true);
    expect(v.includes("1234567890ABCD")).toBe(false);
  });

  test("validateApiBackupJson rejects invalid shapes", () => {
    expect(() => validateApiBackupJson({} as any)).toThrow();
    expect(() => validateApiBackupJson({ version: 2, config: {} } as any)).toThrow();
    expect(() =>
      validateApiBackupJson({ version: 1, config: { apiKeys: "nope" } } as any)
    ).toThrow();
  });

  test("sanitizeAiConfigFromBackup dedupes and trims keys", () => {
    const raw = {
      apiKeys: {
        openai: ["  a", "a", "", "b  "],
        groq: ["x"],
      },
      selectedChatProvider: "openai",
    };

    const next = sanitizeAiConfigFromBackup(raw as any, baseConfig);
    expect(next.apiKeys.openai).toEqual(["a", "b"]);
    expect(next.apiKeys.groq).toEqual(["x"]);
  });
});
