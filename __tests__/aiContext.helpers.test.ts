import {
  buildProviderSelectionPatch,
  hasAnyApiKeys,
  normalizeApiKeys,
  resolveRehydratedApiKeys,
} from "../contexts/AIContext/helpers";

describe("aiContext helpers", () => {
  test("normalizeApiKeys trims entries and fails safe for non-arrays", () => {
    const normalized = normalizeApiKeys({
      groq: ["  a ", "", "  ", 42],
      openai: "invalid" as unknown,
      anthropic: [" key1 ", null],
    });

    expect(normalized.groq).toEqual(["a", "42"]);
    expect(normalized.openai).toEqual([]);
    expect(normalized.anthropic).toEqual(["key1"]);
    expect(normalized.gemini).toEqual([]);
    expect(normalized.huggingface).toEqual([]);
  });

  test("resolveRehydratedApiKeys migrates legacy keys when secure store is empty", () => {
    const resolved = resolveRehydratedApiKeys({
      loadedApiKeys: {
        groq: [" legacy-groq "],
        openai: ["legacy-openai"],
      },
      secureApiKeys: {
        groq: [],
        gemini: [],
        openai: [],
        anthropic: [],
        huggingface: [],
      },
    });

    expect(resolved.shouldMigrateLegacyToSecure).toBe(true);
    expect(resolved.finalKeys.groq).toEqual(["legacy-groq"]);
    expect(resolved.finalKeys.openai).toEqual(["legacy-openai"]);
  });

  test("resolveRehydratedApiKeys keeps secure keys authoritative when any secure key exists", () => {
    const resolved = resolveRehydratedApiKeys({
      loadedApiKeys: {
        groq: ["legacy-groq"],
      },
      secureApiKeys: {
        groq: [],
        openai: ["secure-openai"],
      },
    });

    expect(resolved.shouldMigrateLegacyToSecure).toBe(false);
    expect(resolved.finalKeys.groq).toEqual([]);
    expect(resolved.finalKeys.openai).toEqual(["secure-openai"]);
  });

  test("hasAnyApiKeys reports true only when at least one provider key exists", () => {
    expect(
      hasAnyApiKeys({
        groq: [],
        gemini: [],
        openai: [],
        anthropic: [],
        huggingface: [],
      }),
    ).toBe(false);

    expect(
      hasAnyApiKeys({
        groq: ["k"],
        gemini: [],
        openai: [],
        anthropic: [],
        huggingface: [],
      }),
    ).toBe(true);
  });

  test("buildProviderSelectionPatch resolves chat provider and mode from quality fallback", () => {
    const patch = buildProviderSelectionPatch({
      providerType: "chat",
      provider: "openai",
      qualityMode: "quality",
    });

    expect(patch).toEqual({
      selectedChatProvider: "openai",
      selectedChatMode: "gpt-5.4-pro",
    });
  });

  test("buildProviderSelectionPatch resolves agent provider and mode from speed fallback", () => {
    const patch = buildProviderSelectionPatch({
      providerType: "agent",
      provider: "groq",
      qualityMode: "speed",
    });

    expect(patch).toEqual({
      selectedAgentProvider: "groq",
      selectedAgentMode: "llama-3.1-8b-instant",
    });
  });
});
