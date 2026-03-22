import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, act, waitFor } from "@testing-library/react-native";

import { AIProvider, useAI } from "../contexts/AIContext";
import { CONFIG_STORAGE_KEY } from "../contexts/AIContext/helpers";

describe("AIContext redacted config persistence", () => {
  beforeEach(() => {
    const storage = AsyncStorage as typeof AsyncStorage & {
      __resetMockStorage?: () => void;
    };
    storage.__resetMockStorage?.();
    jest.clearAllMocks();
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
      result.current.setSelectedChatMode("gpt-4o");
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

    expect(persisted.selectedChatMode).toBe("gpt-4o");
    expect(persisted.agentEnabled).toBe(false);
    expect(persisted.apiKeys).toEqual({
      groq: [],
      gemini: [],
      openai: [],
      anthropic: [],
      huggingface: [],
    });
  });
});
