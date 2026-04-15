import * as SecureStore from "expo-secure-store";
import {
  AI_KEYS_SECURE_KEY,
  buildProviderSelectionPatch,
  hasAnyApiKeys,
  loadSecureApiKeys,
  normalizeApiKeys,
  resolveRehydratedApiKeys,
  saveSecureApiKeys,
} from "../contexts/AIContext/helpers";

describe("aiContext helpers", () => {
  beforeEach(() => {
    const secureStore = SecureStore as typeof SecureStore & {
      __resetMockStorage?: () => void;
      __setMockStorage?: (next: Record<string, string>) => void;
    };
    secureStore.__resetMockStorage?.();
    jest.clearAllMocks();
  });

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

  test("loadSecureApiKeys returns unreadable when SecureStore read fails", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error("read failed"));
    const result = await loadSecureApiKeys();

    expect(result.state).toBe("unreadable");
    expect(result.keys).toEqual({
      groq: [],
      gemini: [],
      openai: [],
      anthropic: [],
      huggingface: [],
    });
  });

  test("loadSecureApiKeys reports missing when no secure keys are persisted", async () => {
    const result = await loadSecureApiKeys();
    expect(result.state).toBe("missing");
  });

  test.each([
    { label: "json parse error", payload: "{invalid-json" },
    { label: "json string payload", payload: JSON.stringify("abc") },
    { label: "json array payload", payload: JSON.stringify(["sk-x"]) },
    { label: "empty object payload", payload: JSON.stringify({}) },
    { label: "wrong provider value type", payload: JSON.stringify({ groq: "sk-x" }) },
    { label: "provider array contains non-string", payload: JSON.stringify({ groq: [123] }) },
    {
      label: "semantically empty provider arrays",
      payload: JSON.stringify({
        groq: [],
        gemini: [],
        openai: [],
        anthropic: [],
        huggingface: [],
      }),
    },
  ])("loadSecureApiKeys returns unreadable for $label", async ({ payload }) => {
    const secureStore = SecureStore as typeof SecureStore & {
      __setMockStorage?: (next: Record<string, string>) => void;
    };
    secureStore.__setMockStorage?.({ [AI_KEYS_SECURE_KEY]: payload });

    const result = await loadSecureApiKeys();
    expect(result.state).toBe("unreadable");
  });

  test("loadSecureApiKeys returns loaded for structurally valid secure payload", async () => {
    const secureStore = SecureStore as typeof SecureStore & {
      __setMockStorage?: (next: Record<string, string>) => void;
    };
    secureStore.__setMockStorage?.({
      [AI_KEYS_SECURE_KEY]: JSON.stringify({
        groq: ["sk-groq-valid"],
        gemini: [],
        openai: [],
        anthropic: [],
        huggingface: [],
      }),
    });

    const result = await loadSecureApiKeys();
    expect(result.state).toBe("loaded");
    expect(result.keys.groq).toEqual(["sk-groq-valid"]);
  });

  test("saveSecureApiKeys deletes slot only for legitimate empty state", async () => {
    await saveSecureApiKeys({
      groq: [],
      gemini: [],
      openai: [],
      anthropic: [],
      huggingface: [],
    });

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(AI_KEYS_SECURE_KEY);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});
