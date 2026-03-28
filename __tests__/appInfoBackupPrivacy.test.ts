import { maskApiKey } from "../lib/apiKeyMasking";
import type { AIConfig } from "../contexts/AIContext";
import { sanitizeAiConfigFromBackup, validateApiBackupJson } from "../lib/appInfoBackup";

// Minimal AIConfig fallback for unit tests (keep it aligned with contexts/AIContext.tsx)
const baseConfig: AIConfig = {
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
    expect(() => validateApiBackupJson({})).toThrow();
    expect(() => validateApiBackupJson({ version: 2, config: {} })).toThrow();
    expect(() =>
      validateApiBackupJson({ version: 1, config: { apiKeys: "nope" } })
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

    const next = sanitizeAiConfigFromBackup(raw, baseConfig);
    expect(next.apiKeys.openai).toEqual(["a", "b"]);
    expect(next.apiKeys.groq).toEqual(["x"]);
  });

  test("sanitizeAiConfigFromBackup keeps provider/quality/mode fallback for foreign payload values", () => {
    const next = sanitizeAiConfigFromBackup(
      {
        selectedChatProvider: "unknown-provider",
        selectedAgentProvider: 123,
        selectedChatMode: 42,
        selectedAgentMode: { id: "bad" },
        qualityMode: "best",
      },
      baseConfig,
    );

    expect(next.selectedChatProvider).toBe(baseConfig.selectedChatProvider);
    expect(next.selectedAgentProvider).toBe(baseConfig.selectedAgentProvider);
    expect(next.selectedChatMode).toBe(baseConfig.selectedChatMode);
    expect(next.selectedAgentMode).toBe(baseConfig.selectedAgentMode);
    expect(next.qualityMode).toBe("quality");
  });

  test("sanitizeAiConfigFromBackup accepts legacy selectedAutofixProvider but ignores malformed config/apiKeys", () => {
    const next = sanitizeAiConfigFromBackup(
      {
        config: "legacy-non-object",
        apiKeys: "invalid",
        selectedAutofixProvider: "anthropic",
        qualityMode: "review",
      },
      baseConfig,
    );

    expect(next.selectedAgentProvider).toBe("anthropic");
    expect(next.apiKeys.openai).toEqual([]);
    expect(next.qualityMode).toBe("review");
  });

  test("sanitizeAiConfigFromBackup tolerates incomplete config/apiKeys payloads", () => {
    const next = sanitizeAiConfigFromBackup(
      {
        apiKeys: {
          openai: [" key-1 ", "", "key-1"],
          huggingface: "bad",
        },
        agentEnabled: "yes",
      },
      baseConfig,
    );

    expect(next.apiKeys.openai).toEqual(["key-1"]);
    expect(next.apiKeys.huggingface).toEqual([]);
    expect(next.agentEnabled).toBe(baseConfig.agentEnabled);
  });
});
