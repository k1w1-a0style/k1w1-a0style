import React from "react";
import { act, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useDiagnosticPreferences } from "../screens/DiagnosticScreen/hooks/useDiagnosticPreferences";

function createHarness<T>(useHook: () => T) {
  let api: T | null = null;

  function Harness() {
    api = useHook();
    return null;
  }

  return {
    Harness,
    getApi: () => {
      if (!api) throw new Error("Hook API not ready");
      return api;
    },
  };
}

function flushMicrotasks() {
  return Promise.resolve();
}

describe("useDiagnosticPreferences hydration gate", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (AsyncStorage as any).__resetMockStorage?.();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not save defaults before async load completes", async () => {
    // stored preference: syncFixesToGitHub = true
    (AsyncStorage as any).__setMockStorage?.({
      k1w1_diag_sync_fixes: "1",
    });

    // Simulate slow storage: multiGet resolves after 800ms.
    const origMultiGet = AsyncStorage.multiGet;
    (AsyncStorage.multiGet as any) = jest.fn((keys: string[]) => {
      return new Promise((resolve) => {
        setTimeout(async () => {
          const res = await origMultiGet(keys);
          resolve(res);
        }, 800);
      });
    });

    const { Harness, getApi } = createHarness(() =>
      useDiagnosticPreferences({
        projectData: {
          name: "p",
          files: [],
          chatHistory: [],
          createdAt: "now",
          lastModified: "now",
        } as any,
        linkedRepo: "k1w1-a0style/k1w1-a0style",
        recommendedMode: "preview",
      }),
    );

    render(<Harness />);

    // Before hydration: default is linkedRepo => true, but we care about "no early write".
    // Advance 500ms: this would normally trigger the debounced save.
    await act(async () => {
      jest.advanceTimersByTime(500);
      await flushMicrotasks();
    });

    expect(AsyncStorage.multiSet).not.toHaveBeenCalled();

    // Complete the slow load.
    await act(async () => {
      jest.advanceTimersByTime(800);
      await flushMicrotasks();
    });

    // After hydration, a save is allowed (debounced).
    await act(async () => {
      jest.advanceTimersByTime(600);
      await flushMicrotasks();
    });

    // Ensure at least one save happened after hydration.
    expect(AsyncStorage.multiSet).toHaveBeenCalled();

    // Ensure the saved value reflects the loaded storage ("1"), not an overwritten default.
    const calls = (AsyncStorage.multiSet as jest.Mock).mock.calls;
    const lastPairs = calls[calls.length - 1][0] as Array<[string, string]>;
    const map = new Map(lastPairs);
    expect(map.get("k1w1_diag_sync_fixes")).toBe("1");

    // Sanity: the hook state also reflects the loaded value.
    expect(getApi().syncFixesToGitHub).toBe(true);
  });
});
