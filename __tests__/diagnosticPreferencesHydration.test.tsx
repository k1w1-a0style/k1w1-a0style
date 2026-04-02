import React from "react";
import { act, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useDiagnosticPreferences } from "../screens/DiagnosticScreen/hooks/useDiagnosticPreferences";
import { resetMockAsyncStorage, seedMockAsyncStorage } from "./helpers/asyncStorageMockHelpers";
import { makeProjectData } from "./helpers/projectTestHelpers";

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
    resetMockAsyncStorage();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not save defaults before async load completes", async () => {
    // stored preference: syncFixesToGitHub = true
    seedMockAsyncStorage({
      k1w1_diag_sync_fixes: "1",
    });

    // Simulate slow storage: multiGet resolves after 800ms.
    const origMultiGet = AsyncStorage.multiGet.bind(AsyncStorage);
    jest.spyOn(AsyncStorage, "multiGet").mockImplementation((keys) => {
      return new Promise((resolve) => {
        setTimeout(async () => {
          const res = await origMultiGet(keys);
          resolve(res);
        }, 800);
      });
    });

    const { Harness, getApi } = createHarness(() =>
      useDiagnosticPreferences({
        projectData: makeProjectData({
          name: "p",
          files: [],
          chatHistory: [],
          createdAt: "now",
          lastModified: "now",
        }),
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

    // After hydration, writes are allowed (debounced), but only needed when values changed.
    await act(async () => {
      jest.advanceTimersByTime(600);
      await flushMicrotasks();
    });

    // Sanity: the hook state reflects the loaded value.
    expect(getApi().syncFixesToGitHub).toBe(true);

    // If a persistence write happened, it must not overwrite the loaded "1".
    const calls = (AsyncStorage.multiSet as jest.Mock).mock.calls;
    if (calls.length > 0) {
      const lastPairs = calls[calls.length - 1][0] as Array<[string, string]>;
      const map = new Map(lastPairs);
      expect(map.get("k1w1_diag_sync_fixes")).toBe("1");
    }
  });
});
