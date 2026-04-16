import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { renderHook, act, waitFor } from "@testing-library/react-native";

import { AIProvider, useAI } from "../contexts/AIContext";
import { AI_KEYS_SECURE_KEY, CONFIG_STORAGE_KEY } from "../contexts/AIContext/helpers";

describe("AIContext redacted config persistence", () => {
  beforeEach(() => {
    const storage = AsyncStorage as typeof AsyncStorage & {
      __resetMockStorage?: () => void;
      __setMockStorage?: (next: Record<string, string>) => void;
    };
    storage.__resetMockStorage?.();
    const secureStore = SecureStore as typeof SecureStore & {
      __resetMockStorage?: () => void;
    };
    secureStore.__resetMockStorage?.();
    jest.clearAllMocks();
  });


  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("debounces redacted AsyncStorage writes across quick successive config updates", async () => {
    jest.useFakeTimers();

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AIProvider>{children}</AIProvider>
    );

    const { result } = renderHook(() => useAI(), { wrapper });

    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalled();
    });

    act(() => {
      jest.runOnlyPendingTimers();
    });
    await act(async () => {
      await Promise.resolve();
    });

    (AsyncStorage.setItem as jest.Mock).mockClear();

    act(() => {
      result.current.setSelectedChatMode("gpt-5.4");
      result.current.setAgentEnabled(false);
    });

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(349);
    });

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      CONFIG_STORAGE_KEY,
      expect.any(String),
    );

    const persisted = JSON.parse(
      String((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]),
    ) as { selectedChatMode: string; agentEnabled: boolean; apiKeys: Record<string, unknown[]> };

    expect(persisted.selectedChatMode).toBe("gpt-5.4");
    expect(persisted.agentEnabled).toBe(false);
    expect(persisted.apiKeys).toEqual({
      groq: [],
      gemini: [],
      openai: [],
      anthropic: [],
      huggingface: [],
    });
  });

  it("does not treat semantically broken secure payload as empty and avoids secure writes/deletes", async () => {
    (AsyncStorage as typeof AsyncStorage & { __setMockStorage?: (next: Record<string, string>) => void }).__setMockStorage?.({
      [CONFIG_STORAGE_KEY]: JSON.stringify({
        version: 4,
        selectedChatProvider: "groq",
        selectedChatMode: "llama-3.1-8b-instant",
        selectedAgentProvider: "anthropic",
        selectedAgentMode: "claude-sonnet-4-20250514",
        qualityMode: "speed",
        agentEnabled: true,
      }),
    });
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error("secure unreadable"));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AIProvider>{children}</AIProvider>
    );
    const { result } = renderHook(() => useAI(), { wrapper });

    await waitFor(() => {
      expect(result.current.config.selectedChatMode).toBe("llama-3.1-8b-instant");
    });
    await waitFor(() => {
      expect(SecureStore.getItemAsync).toHaveBeenCalled();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.config.apiKeys.groq).toEqual([]);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();

    await expect(result.current.addApiKey("groq", "new-key")).rejects.toThrow("SecureStore nicht lesbar");
    expect(result.current.config.apiKeys.groq).toEqual([]);
    expect(() =>
      result.current.applyImportedConfig({
        ...result.current.config,
        apiKeys: {
          ...result.current.config.apiKeys,
          openai: ["sk-imported-openai"],
        },
      }),
    ).toThrow("SecureStore ist nicht lesbar");
    expect(result.current.config.apiKeys.openai).toEqual([]);

    act(() => {
      result.current.setAgentEnabled(false);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("allows imported api keys when SecureStore is readable", async () => {
    (AsyncStorage as typeof AsyncStorage & { __setMockStorage?: (next: Record<string, string>) => void }).__setMockStorage?.({
      [CONFIG_STORAGE_KEY]: JSON.stringify({
        version: 4,
        selectedChatProvider: "groq",
        selectedChatMode: "llama-3.1-8b-instant",
        selectedAgentProvider: "anthropic",
        selectedAgentMode: "claude-sonnet-4-20250514",
        qualityMode: "speed",
        agentEnabled: true,
      }),
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AIProvider>{children}</AIProvider>
    );
    const { result } = renderHook(() => useAI(), { wrapper });

    await waitFor(() => {
      expect(result.current.config.selectedChatMode).toBe("llama-3.1-8b-instant");
    });

    act(() => {
      result.current.applyImportedConfig({
        ...result.current.config,
        apiKeys: {
          groq: [],
          gemini: [],
          openai: ["sk-imported-openai"],
          anthropic: [],
          huggingface: [],
        },
      });
    });

    await waitFor(() => {
      expect(result.current.config.apiKeys.openai).toEqual(["sk-imported-openai"]);
    });
  });
});
