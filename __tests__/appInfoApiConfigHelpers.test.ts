import type { AIConfig } from "../contexts/AIContext";
import { applyImportedApiConfig } from "../screens/AppInfoScreen/hooks/appInfoApiConfigHelpers";

const baseConfig: AIConfig = {
  version: 4,
  selectedChatProvider: "groq",
  selectedChatMode: "llama",
  selectedAgentProvider: "anthropic",
  selectedAgentMode: "claude",
  qualityMode: "speed",
  agentEnabled: true,
  apiKeys: {
    groq: ["groq-local"],
    gemini: ["gemini-local", "gemini-local-2"],
    openai: [],
    anthropic: ["anthropic-local"],
    huggingface: [],
  },
};

describe("appInfoApiConfigHelpers", () => {
  test("applyImportedApiConfig keeps local API keys and returns deterministic total", () => {
    const { nextConfig, totalKeysImported } = applyImportedApiConfig(
      {
        version: 99,
        selectedChatProvider: "openai",
        selectedChatMode: "new-mode",
        apiKeys: {
          groq: ["remote-should-not-override"],
          openai: ["remote-openai"],
        },
      },
      baseConfig,
    );

    expect(nextConfig.selectedChatProvider).toBe("openai");
    expect(nextConfig.selectedChatMode).toBe("new-mode");
    expect(nextConfig.apiKeys).toEqual(baseConfig.apiKeys);
    expect(totalKeysImported).toBe(4);
  });
});
