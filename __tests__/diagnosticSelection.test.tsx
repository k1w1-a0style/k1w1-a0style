import React from "react";
import { act, render } from "@testing-library/react-native";

import { useDiagnosticSelection } from "../screens/DiagnosticScreen/hooks/useDiagnosticSelection";

function createHarness<T>(useHook: () => T) {
  let api: T | null = null;
  function Harness() {
    api = useHook();
    return null;
  }
  render(<Harness />);
  if (!api) throw new Error("Harness did not initialize");
  return () => api as T;
}

describe("useDiagnosticSelection", () => {
  test("toggles ids and counts selected correctly", () => {
    const getApi = createHarness(() => useDiagnosticSelection({ a: true }));

    expect(getApi().selected).toEqual({ a: true });
    expect(getApi().selectedCount).toBe(1);

    act(() => {
      getApi().toggleSelectedId("b");
    });
    expect(getApi().selected).toEqual({ a: true, b: true });
    expect(getApi().selectedCount).toBe(2);

    act(() => {
      getApi().toggleSelectedId("a");
    });
    expect(getApi().selected.a).toBe(false);
    expect(getApi().selectedCount).toBe(1);
  });

  test("setSelectedIds and clearSelection work", () => {
    const getApi = createHarness(() => useDiagnosticSelection());

    act(() => {
      getApi().setSelectedIds(["x", "y"]);
    });
    expect(getApi().selected).toEqual({ x: true, y: true });
    expect(getApi().selectedCount).toBe(2);

    act(() => {
      getApi().setSelectedIds(["x"], false);
    });
    expect(getApi().selected).toEqual({ y: true });

    act(() => {
      getApi().clearSelection();
    });
    expect(getApi().selected).toEqual({});
    expect(getApi().selectedCount).toBe(0);
  });
});
